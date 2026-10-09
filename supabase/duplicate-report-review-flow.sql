-- Run in the Supabase SQL Editor to reject duplicate reports and start new
-- reports at Pending Review until an admin advances them.

alter table public.reports
    alter column status set default 'Pending Review';

drop policy if exists reports_public_submit on public.reports;
create policy reports_public_submit
    on public.reports
    for insert
    to anon
    with check (
        status = 'Pending Review'
        and report_number ~ '^GM-[0-9]{2}-[0-9]{4,}$'
        and char_length(coalesce(description, '')) between 15 and 1000
        and nullif(btrim(category), '') is not null
        and nullif(btrim(location), '') is not null
    );

create or replace function public.report_is_duplicate(
    p_category text,
    p_location text,
    p_description text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1
        from public.reports
        where lower(regexp_replace(btrim(coalesce(category, '')), '\s+', ' ', 'g'))
                = lower(regexp_replace(btrim(coalesce(p_category, '')), '\s+', ' ', 'g'))
          and lower(regexp_replace(btrim(coalesce(location, '')), '\s+', ' ', 'g'))
                = lower(regexp_replace(btrim(coalesce(p_location, '')), '\s+', ' ', 'g'))
          and lower(regexp_replace(btrim(coalesce(description, '')), '\s+', ' ', 'g'))
                = lower(regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g'))
    );
$$;

revoke all on function public.report_is_duplicate(text, text, text) from public;
grant execute on function public.report_is_duplicate(text, text, text) to anon, authenticated;

create or replace function public.reject_duplicate_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    duplicate_report_number text;
    duplicate_key text;
begin
    new.status := 'Pending Review';

    duplicate_key := concat_ws(
        chr(31),
        lower(regexp_replace(btrim(coalesce(new.category, '')), '\s+', ' ', 'g')),
        lower(regexp_replace(btrim(coalesce(new.location, '')), '\s+', ' ', 'g')),
        lower(regexp_replace(btrim(coalesce(new.description, '')), '\s+', ' ', 'g'))
    );

    perform pg_advisory_xact_lock(hashtextextended(duplicate_key, 0));

    select report_number
    into duplicate_report_number
    from public.reports
    where lower(regexp_replace(btrim(coalesce(category, '')), '\s+', ' ', 'g'))
            = lower(regexp_replace(btrim(coalesce(new.category, '')), '\s+', ' ', 'g'))
      and lower(regexp_replace(btrim(coalesce(location, '')), '\s+', ' ', 'g'))
            = lower(regexp_replace(btrim(coalesce(new.location, '')), '\s+', ' ', 'g'))
      and lower(regexp_replace(btrim(coalesce(description, '')), '\s+', ' ', 'g'))
            = lower(regexp_replace(btrim(coalesce(new.description, '')), '\s+', ' ', 'g'))
    limit 1;

    if duplicate_report_number is not null then
        raise exception using
            errcode = '23505',
            message = 'This issue has already been reported. Please track the existing report instead of submitting it again.';
    end if;

    return new;
end;
$$;

drop trigger if exists reports_reject_duplicate_submission on public.reports;
create trigger reports_reject_duplicate_submission
    before insert on public.reports
    for each row execute function public.reject_duplicate_report();

create or replace function public.admin_update_report(
    p_report_number text,
    p_status text,
    p_note text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    normalized_status text := case lower(btrim(coalesce(p_status, '')))
        when 'report submitted' then 'Report Submitted'
        when 'submitted' then 'Report Submitted'
        when 'under process' then 'Under Process'
        when 'in progress' then 'Under Process'
        else p_status
    end;
begin
    if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
        raise exception using errcode = '42501', message = 'Admin access required.';
    end if;

    if p_report_number is null or btrim(p_report_number) = ''
        or normalized_status is null
        or normalized_status not in (
            'Pending Review', 'Report Submitted', 'Under Review',
            'Follow-up Initiated', 'Under Process', 'Completed',
            'Closed', 'Resolved', 'Rejected'
        )
        or char_length(coalesce(p_note, '')) > 2000 then
        raise exception using errcode = '22023', message = 'Invalid report update.';
    end if;

    update public.reports
    set status = normalized_status,
        admin_remarks = nullif(btrim(coalesce(p_note, '')), '')
    where report_number = p_report_number;

    return found;
end;
$$;

revoke all on function public.admin_update_report(text, text, text) from public;
grant execute on function public.admin_update_report(text, text, text) to authenticated;

notify pgrst, 'reload schema';
