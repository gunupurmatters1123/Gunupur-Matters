-- Run this in the Supabase SQL Editor to show report deletion reasons on the
-- public tracking page, including after an archived report is permanently deleted.

alter table public.reports add column if not exists archive_reason text;

create table if not exists public.deleted_report_tracking (
    report_number text primary key,
    deletion_reason text not null,
    deleted_at timestamptz not null default now()
);

alter table public.deleted_report_tracking enable row level security;
revoke all privileges on table public.deleted_report_tracking from public, anon, authenticated;
grant all privileges on table public.deleted_report_tracking to service_role;

create or replace function public.admin_archive_report(
    p_reason text,
    p_report_number text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
        raise exception using errcode = '42501', message = 'Admin access required.';
    end if;
    if p_report_number is null or btrim(p_report_number) = ''
        or char_length(btrim(coalesce(p_reason, ''))) < 3
        or char_length(coalesce(p_reason, '')) > 2000 then
        raise exception using errcode = '22023', message = 'A report number and deletion reason are required.';
    end if;

    update public.reports
    set archived_status = status,
        status = 'Archived',
        archived_at = now(),
        archive_reason = btrim(p_reason)
    where report_number = p_report_number
      and status <> 'Archived';
    return found;
end;
$$;

revoke all on function public.admin_archive_report(text, text) from public;
grant execute on function public.admin_archive_report(text, text) to authenticated;

create or replace function public.admin_delete_archived_report(p_report_number text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
        raise exception using errcode = '42501', message = 'Admin access required.';
    end if;
    if p_report_number is null or btrim(p_report_number) = '' then
        raise exception using errcode = '22023', message = 'A report number is required.';
    end if;
    if not exists (
        select 1 from public.reports
        where report_number = p_report_number and status = 'Archived'
    ) then
        return false;
    end if;

    insert into public.deleted_report_tracking (
        report_number, deletion_reason, deleted_at
    )
    select
        report_number,
        coalesce(nullif(btrim(archive_reason), ''), 'No reason was recorded.'),
        now()
    from public.reports
    where report_number = p_report_number and status = 'Archived'
    on conflict (report_number) do update
    set deletion_reason = excluded.deletion_reason,
        deleted_at = excluded.deleted_at;

    delete from public.reports
    where report_number = p_report_number and status = 'Archived';
    return found;
end;
$$;

revoke all on function public.admin_delete_archived_report(text) from public;
grant execute on function public.admin_delete_archived_report(text) to authenticated;

create or replace function public.track_report(p_report_number text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
    select tracked.report
    from (
        select
            case
                when status = 'Archived' then jsonb_build_object(
                    'id', report_number,
                    'status', 'Archived',
                    'deleted', true,
                    'deleteReason', coalesce(nullif(btrim(archive_reason), ''), 'No reason was recorded.'),
                    'date', created_at,
                    'lastUpdated', updated_at
                )
                else jsonb_build_object(
                    'id', report_number,
                    'title', coalesce(title, ''),
                    'category', coalesce(category, ''),
                    'priority', coalesce(priority, 'Medium'),
                    'description', coalesce(description, ''),
                    'location', coalesce(location, ''),
                    'status', coalesce(status, 'Pending Review'),
                    'deleted', false,
                    'deleteReason', '',
                    'date', created_at,
                    'lastUpdated', updated_at
                )
            end as report,
            0 as sort_order
        from public.reports
        where report_number = p_report_number

        union all

        select
            jsonb_build_object(
                'id', report_number,
                'status', 'Archived',
                'deleted', true,
                'deleteReason', coalesce(nullif(btrim(deletion_reason), ''), 'No reason was recorded.'),
                'date', null,
                'lastUpdated', deleted_at
            ) as report,
            1 as sort_order
        from public.deleted_report_tracking
        where report_number = p_report_number
    ) tracked
    order by tracked.sort_order
    limit 1;
$$;

revoke all on function public.track_report(text) from public;
grant execute on function public.track_report(text) to anon, authenticated;

notify pgrst, 'reload schema';
