-- Run this in the Supabase SQL Editor if the tracking page shows "Under Review"
-- after an admin sets a report to "Report Submitted".

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
                    'status', case lower(btrim(coalesce(status, '')))
                        when 'submitted' then 'Report Submitted'
                        when 'report submitted' then 'Report Submitted'
                        when 'in progress' then 'Under Process'
                        when 'under process' then 'Under Process'
                        else coalesce(status, 'Pending Review')
                    end,
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

revoke all on function public.track_report(text) from public, anon, authenticated;
grant execute on function public.track_report(text) to service_role;

notify pgrst, 'reload schema';
