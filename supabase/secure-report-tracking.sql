-- Apply after reports.sql and duplicate-report-review-flow.sql.

drop function if exists public.report_find_duplicate(text, text, text);
drop function if exists public.report_tracking_contact(text, text);

create or replace function public.require_reporter_contact()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    phone_digits text;
begin
    new.reporter_name := btrim(coalesce(new.reporter_name, ''));
    phone_digits := regexp_replace(coalesce(new.reporter_phone, ''), '\D', '', 'g');

    if length(phone_digits) = 12 and left(phone_digits, 2) = '91' then
        phone_digits := right(phone_digits, 10);
    elsif length(phone_digits) = 11 and left(phone_digits, 1) = '0' then
        phone_digits := right(phone_digits, 10);
    end if;

    if new.reporter_name = ''
        or char_length(new.reporter_name) > 100
        or phone_digits !~ '^[6-9][0-9]{9}$' then
        raise exception using
            errcode = '22023',
            message = 'Enter your name and a valid Indian mobile number to submit and track this report.';
    end if;

    new.reporter_phone := '+91' || phone_digits;
    return new;
end;
$$;

drop trigger if exists reports_require_reporter_contact on public.reports;
create trigger reports_require_reporter_contact
    before insert or update of reporter_name, reporter_phone on public.reports
    for each row execute function public.require_reporter_contact();

alter table public.reports
    add column if not exists report_sms_sent_at timestamptz;

create or replace function public.track_report_by_name(
    p_report_number text,
    p_reporter_name text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
    matched_report_number text;
begin
    select report_number
    into matched_report_number
    from public.reports
    where report_number = upper(btrim(coalesce(p_report_number, '')))
      and lower(regexp_replace(btrim(coalesce(reporter_name, '')), '\s+', ' ', 'g'))
            = lower(regexp_replace(btrim(coalesce(p_reporter_name, '')), '\s+', ' ', 'g'))
    limit 1;

    if matched_report_number is null then
        return null;
    end if;

    return public.track_report(matched_report_number);
end;
$$;

revoke all on function public.track_report_by_name(text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.track_report_by_name(text, text) to anon, authenticated;

revoke all on function public.track_report(text)
    from public, anon, authenticated, service_role;
grant execute on function public.track_report(text) to service_role;

notify pgrst, 'reload schema';
