-- Run this migration in the Supabase SQL Editor for the configured project.
-- The publishable key is safe for browser use; RLS restricts its database access.

create table if not exists public.reports (
    id text primary key default gen_random_uuid()::text,
    report_number text not null,
    title text,
    category text,
    priority text not null default 'Medium',
    description text,
    location text,
    location_details text,
    ward_number text,
    street text,
    area text,
    landmark text,
    pin_code text,
    latitude text,
    longitude text,
    reporter_name text,
    reporter_phone text,
    reporter_email text,
    file_name text,
    file_path text,
    media_type text,
    status text not null default 'Under Review',
    admin_remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.reports add column if not exists report_number text;
alter table public.reports add column if not exists title text;
alter table public.reports add column if not exists category text;
alter table public.reports add column if not exists priority text not null default 'Medium';
alter table public.reports add column if not exists description text;
alter table public.reports add column if not exists location text;
alter table public.reports add column if not exists location_details text;
alter table public.reports add column if not exists ward_number text;
alter table public.reports add column if not exists street text;
alter table public.reports add column if not exists area text;
alter table public.reports add column if not exists landmark text;
alter table public.reports add column if not exists pin_code text;
alter table public.reports add column if not exists latitude text;
alter table public.reports add column if not exists longitude text;
alter table public.reports add column if not exists reporter_name text;
alter table public.reports add column if not exists reporter_phone text;
alter table public.reports add column if not exists reporter_email text;
alter table public.reports add column if not exists file_name text;
alter table public.reports add column if not exists file_path text;
alter table public.reports add column if not exists media_type text;
alter table public.reports add column if not exists status text not null default 'Under Review';
alter table public.reports add column if not exists admin_remarks text;
alter table public.reports add column if not exists archived_at timestamptz;
alter table public.reports add column if not exists archived_status text;
alter table public.reports add column if not exists archive_reason text;
alter table public.reports add column if not exists created_at timestamptz not null default now();
alter table public.reports add column if not exists updated_at timestamptz not null default now();

do $$
declare
    reports_id_type text;
begin
    select data_type into reports_id_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reports'
      and column_name = 'id';

    if reports_id_type = 'uuid' then
        alter table public.reports alter column id set default gen_random_uuid();
    elsif reports_id_type in ('text', 'character varying', 'character') then
        alter table public.reports alter column id set default gen_random_uuid()::text;
    else
        raise exception 'Unsupported public.reports.id type: %', reports_id_type;
    end if;
end;
$$;

update public.reports
set report_number = 'GM-LEGACY-' || id::text
where report_number is null or btrim(report_number) = '';

update public.reports
set status = 'Under Review'
where status is null or btrim(status) = '';

alter table public.reports
    alter column report_number set not null,
    alter column status set default 'Under Review';
alter table public.reports
    alter column title drop not null;

create unique index if not exists reports_report_number_unique
    on public.reports (report_number);

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

create table if not exists public.deleted_report_tracking (
    report_number text primary key,
    deletion_reason text not null,
    deleted_at timestamptz not null default now()
);

alter table public.deleted_report_tracking enable row level security;
revoke all privileges on table public.deleted_report_tracking from public, anon, authenticated;
grant all privileges on table public.deleted_report_tracking to service_role;

create table if not exists public.report_number_counters (
    year_code text primary key,
    last_value integer not null check (last_value >= 0)
);

revoke all on table public.report_number_counters from public, anon, authenticated;
grant all on table public.report_number_counters to service_role;

insert into public.report_number_counters (year_code, last_value)
select
    to_char(current_date, 'YY'),
    coalesce(max(substring(report_number from 7)::integer), 0)
from public.reports
where report_number ~ ('^GM-' || to_char(current_date, 'YY') || '-[0-9]{4,}$')
on conflict (year_code) do update
set last_value = greatest(
    public.report_number_counters.last_value,
    excluded.last_value
);

create or replace function public.assign_report_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    current_year text := to_char(current_date, 'YY');
    next_value integer;
begin
    insert into public.report_number_counters (year_code, last_value)
    values (current_year, 1)
    on conflict (year_code) do update
    set last_value = public.report_number_counters.last_value + 1
    returning last_value into next_value;

    new.report_number := 'GM-' || current_year || '-' || lpad(next_value::text, 4, '0');
    return new;
end;
$$;

revoke all on function public.assign_report_number() from public, anon, authenticated;
drop trigger if exists reports_assign_report_number on public.reports;
create trigger reports_assign_report_number
    before insert on public.reports
    for each row execute function public.assign_report_number();

alter table public.reports enable row level security;
do $$
declare
    existing_policy record;
begin
    for existing_policy in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'reports'
    loop
        execute format(
            'drop policy %I on public.reports',
            existing_policy.policyname
        );
    end loop;
end;
$$;
revoke all privileges on table public.reports from public, anon, authenticated;
grant all on table public.reports to service_role;
grant insert (
    report_number, title, category, priority, description, location,
    location_details, ward_number, street, area, landmark, pin_code,
    latitude, longitude, reporter_name, reporter_phone, reporter_email,
    file_name, file_path, media_type, status
) on public.reports to anon;

create policy reports_public_submit
    on public.reports
    for insert
    to anon
    with check (
        status = 'Under Review'
        and report_number ~ '^GM-[0-9]{2}-[0-9]{4,}$'
        and char_length(coalesce(description, '')) between 15 and 1000
        and nullif(btrim(category), '') is not null
        and nullif(btrim(location), '') is not null
    );

-- Admin accounts must be authenticated users with app_metadata.role = 'admin'.
-- Keep admin reads and updates behind these role-checked RPCs, not the publishable key.
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
                'title', coalesce(nullif(btrim(title), ''), nullif(left(description, 80), ''), 'Untitled Issue'),
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
                    when lower(btrim(status)) in ('submitted', 'report submitted') then 'Under Review'
                    when lower(btrim(status)) in ('in progress', 'under process') then 'Under Process'
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

revoke all on function public.admin_list_reports() from public;
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'report-media',
    'report-media',
    true,
    31457280,
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
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
        and (
            name ~ '^reports/[0-9a-f-]{36}-'
            or name ~ '^GM-[0-9]{4}-[A-F0-9]{16}/'
        )
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
        report_priority := 'Medium';
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
        nullif(btrim(coalesce(p_report->>'file_name', '')), ''),
        nullif(btrim(coalesce(p_report->>'file_path', '')), ''),
        nullif(btrim(coalesce(p_report->>'media_type', '')), ''),
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

create or replace function public.set_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
    before update on public.reports
    for each row execute function public.set_reports_updated_at();

notify pgrst, 'reload schema';

-- After creating an admin user in Supabase Authentication, assign the server-managed role:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where email = 'admin@example.com';
-- Sign out and back in after changing app_metadata so the user's JWT includes the role.
