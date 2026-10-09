-- Run this once in Supabase SQL Editor to enable the admin report dashboard.
-- Admin access requires a Supabase Auth user with app_metadata.role = 'admin'.

create unique index if not exists reports_report_number_unique
    on public.reports (report_number);

alter table public.reports add column if not exists archived_at timestamptz;
alter table public.reports add column if not exists archived_status text;
alter table public.reports add column if not exists archive_reason text;

create table if not exists public.report_attachments (
    id uuid primary key default gen_random_uuid(),
    report_number text not null references public.reports(report_number) on delete cascade,
    file_name text not null,
    file_path text not null,
    media_type text not null check (media_type in ('image', 'video')),
    content_type text not null,
    file_size bigint not null check (file_size > 0 and file_size <= 31457280),
    created_at timestamptz not null default now()
);

create index if not exists report_attachments_report_number_created_at_idx
    on public.report_attachments (report_number, created_at);

alter table public.report_attachments enable row level security;
revoke all privileges on table public.report_attachments from public, anon, authenticated;
grant all privileges on table public.report_attachments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'report-media',
    'report-media',
    true,
    31457280,
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/heic', 'image/heif',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
        'video/x-matroska', 'video/mpeg'
    ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists report_media_public_upload on storage.objects;
create policy report_media_public_upload
    on storage.objects
    for insert
    to anon
    with check (
        bucket_id = 'report-media'
        and name ~ '^reports/[0-9a-f-]{36}-'
    );

create or replace function public.submit_report(p_report jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    saved_report_number text;
    report_description text := btrim(coalesce(p_report->>'description', ''));
    report_category text := btrim(coalesce(p_report->>'category', ''));
    report_location text := btrim(coalesce(p_report->>'location', ''));
    report_priority text := coalesce(p_report->>'priority', 'Medium');
    attachment_path text := nullif(btrim(coalesce(p_report->>'file_path', '')), '');
    attachment_name text := nullif(btrim(coalesce(p_report->>'file_name', '')), '');
    attachment_media_type text := nullif(btrim(coalesce(p_report->>'media_type', '')), '');
    attachment_content_type text := nullif(btrim(coalesce(p_report->>'file_content_type', '')), '');
    attachment_size bigint := nullif(p_report->>'file_size', '')::bigint;
begin
    if jsonb_typeof(p_report) <> 'object'
        or report_category = ''
        or report_location = ''
        or char_length(report_description) < 15
        or char_length(report_description) > 1000
        or (
            coalesce(p_report->>'require_address', 'false') = 'true'
            and (
                nullif(btrim(coalesce(p_report->>'ward_number', '')), '') is null
                or nullif(btrim(coalesce(p_report->>'street', '')), '') is null
            )
        ) then
        raise exception 'Category, location, and a 15-1000 character description are required; this report also requires a ward number and street.';
    end if;

    if report_priority not in ('Low', 'Medium', 'High', 'Urgent') then
        raise exception 'A valid report priority is required.';
    end if;

    insert into public.reports (
        title, category, priority, description, location, location_details,
        ward_number, street, area, landmark, pin_code, latitude, longitude,
        reporter_name, reporter_phone, reporter_email, file_name, file_path,
        media_type, status
    ) values (
        nullif(btrim(coalesce(p_report->>'title', '')), ''),
        report_category,
        report_priority,
        report_description,
        report_location,
        nullif(btrim(coalesce(p_report->>'location_details', '')), ''),
        nullif(btrim(coalesce(p_report->>'ward_number', '')), ''),
        nullif(btrim(coalesce(p_report->>'street', '')), ''),
        nullif(btrim(coalesce(p_report->>'area', '')), ''),
        nullif(btrim(coalesce(p_report->>'landmark', '')), ''),
        nullif(btrim(coalesce(p_report->>'pin_code', '')), ''),
        nullif(btrim(coalesce(p_report->>'latitude', '')), ''),
        nullif(btrim(coalesce(p_report->>'longitude', '')), ''),
        nullif(btrim(coalesce(p_report->>'reporter_name', '')), ''),
        nullif(btrim(coalesce(p_report->>'reporter_phone', '')), ''),
        nullif(btrim(coalesce(p_report->>'reporter_email', '')), ''),
        attachment_name,
        attachment_path,
        attachment_media_type,
        'Under Review'
    )
    returning report_number into saved_report_number;

    if attachment_path is not null then
        if attachment_name is null
            or attachment_media_type is null
            or attachment_media_type not in ('image', 'video')
            or attachment_content_type not in (
                'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                'image/heic', 'image/heif',
                'video/mp4', 'video/quicktime', 'video/webm',
                'video/x-msvideo', 'video/x-matroska', 'video/mpeg'
            )
            or attachment_path not like
                'https://alptdaggxnvilkwlnfrr.supabase.co/storage/v1/object/public/report-media/reports/%'
            or attachment_size is null
            or attachment_size <= 0
            or attachment_size > 31457280 then
            raise exception 'Uploaded file metadata is invalid.';
        end if;

        insert into public.report_attachments (
            report_number, file_name, file_path, media_type, content_type, file_size
        ) values (
            saved_report_number,
            attachment_name,
            attachment_path,
            attachment_media_type,
            attachment_content_type,
            attachment_size
        );
    end if;

    return saved_report_number;
end;
$$;

revoke all on function public.submit_report(jsonb) from public;
grant execute on function public.submit_report(jsonb) to anon, authenticated;

create or replace function public.admin_list_reports()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
        raise exception using errcode = '42501', message = 'Admin access required.';
    end if;

    return coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', report_number,
                'title', coalesce(
                    nullif(btrim(title), ''),
                    nullif(left(description, 80), ''),
                    'Untitled Issue'
                ),
                'category', coalesce(category, 'General'),
                'priority', coalesce(priority, 'Medium'),
                'location', coalesce(location, 'Unknown location'),
                'description', coalesce(description, ''),
                'name', coalesce(reporter_name, ''),
                'contact', coalesce(reporter_phone, reporter_email, ''),
                'file_name', coalesce(file_name, ''),
                'photo', coalesce(file_path, ''),
                'media_type', coalesce(media_type, ''),
                'status', case
                    when status = 'Submitted' then 'Under Review'
                    else status
                end,
                'date', created_at,
                'lastUpdated', coalesce(updated_at, created_at),
                'admin_remarks', coalesce(admin_remarks, ''),
                'attachments', coalesce((
                    select jsonb_agg(
                        jsonb_build_object(
                            'file_name', attachment.file_name,
                            'file_path', attachment.file_path,
                            'media_type', attachment.media_type,
                            'content_type', attachment.content_type,
                            'file_size', attachment.file_size
                        )
                        order by attachment.created_at
                    )
                    from public.report_attachments attachment
                    where attachment.report_number = reports.report_number
                ), case
                    when nullif(reports.file_path, '') is not null then jsonb_build_array(
                        jsonb_build_object(
                            'file_name', coalesce(reports.file_name, 'Uploaded file'),
                            'file_path', reports.file_path,
                            'media_type', coalesce(reports.media_type, 'image'),
                            'content_type', '',
                            'file_size', null
                        )
                    )
                    else '[]'::jsonb
                end),
                'activity', '[]'::jsonb
            )
            order by created_at desc
        )
        from public.reports
        where status <> 'Archived'
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_reports() from public, anon, authenticated;
grant execute on function public.admin_list_reports() to authenticated;

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
    normalized_status text := case p_status
        when 'Report Submitted' then 'Under Review'
        when 'Submitted' then 'Under Review'
        when 'Under Process' then 'In Progress'
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
            'In Progress', 'Completed', 'Closed', 'Resolved', 'Rejected'
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

drop function if exists public.admin_archive_report(text, text);
create function public.admin_archive_report(
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

create or replace function public.admin_list_archived_reports()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
        raise exception using errcode = '42501', message = 'Admin access required.';
    end if;

    return coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', report_number,
                'title', coalesce(nullif(btrim(title), ''), nullif(left(description, 80), ''), 'Untitled Issue'),
                'category', coalesce(category, 'General'),
                'priority', coalesce(priority, 'Medium'),
                'location', coalesce(location, 'Unknown location'),
                'status', coalesce(archived_status, 'Under Review'),
                'archivedAt', archived_at,
                'deleteReason', coalesce(archive_reason, ''),
                'attachments', coalesce((
                    select jsonb_agg(
                        jsonb_build_object(
                            'file_path', attachment.file_path,
                            'media_type', attachment.media_type
                        )
                    )
                    from public.report_attachments attachment
                    where attachment.report_number = reports.report_number
                ), case
                    when nullif(reports.file_path, '') is not null then jsonb_build_array(
                        jsonb_build_object(
                            'file_path', reports.file_path,
                            'media_type', coalesce(reports.media_type, 'image')
                        )
                    )
                    else '[]'::jsonb
                end)
            )
            order by archived_at desc
        )
        from public.reports
        where status = 'Archived'
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_archived_reports() from public;
grant execute on function public.admin_list_archived_reports() to authenticated;

create or replace function public.admin_restore_report(p_report_number text)
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

    update public.reports
    set status = coalesce(nullif(archived_status, ''), 'Under Review'),
        archived_status = null,
        archived_at = null,
        archive_reason = null
    where report_number = p_report_number
      and status = 'Archived';
    return found;
end;
$$;

revoke all on function public.admin_restore_report(text) from public;
grant execute on function public.admin_restore_report(text) to authenticated;

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

    delete from public.reports
    where report_number = p_report_number and status = 'Archived';
    return found;
end;
$$;

revoke all on function public.admin_delete_archived_report(text) from public;
grant execute on function public.admin_delete_archived_report(text) to authenticated;

create or replace function public.report_statistics()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select jsonb_build_object(
        'total', count(*),
        'under_review', count(*) filter (
            where status in ('Pending Review', 'Under Review', 'Submitted')
        ),
        'followups', count(*) filter (
            where status = 'Follow-up Initiated'
        ),
        'closed', count(*) filter (
            where status in ('Completed', 'Closed', 'Resolved')
        )
    )
    from public.reports
    where status <> 'Archived';
$$;

revoke all on function public.report_statistics() from public;
grant execute on function public.report_statistics() to anon, authenticated;

notify pgrst, 'reload schema';
