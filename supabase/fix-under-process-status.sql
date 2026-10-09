-- Run this in the Supabase SQL Editor to standardize the active report status.

update public.reports
set status = 'Under Process'
where lower(btrim(status)) in ('in progress', 'under process');

update public.reports
set archived_status = 'Under Process'
where lower(btrim(archived_status)) in ('in progress', 'under process');

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
        when 'report submitted' then 'Under Review'
        when 'submitted' then 'Under Review'
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
            'Pending Review', 'Under Review', 'Follow-up Initiated',
            'Under Process', 'Completed', 'Closed', 'Resolved', 'Rejected'
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
