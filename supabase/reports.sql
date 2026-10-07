-- Run this migration in the Supabase SQL Editor for the configured project.
-- The publishable key is safe for browser use; RLS restricts its database access.

create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
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
alter table public.reports add column if not exists created_at timestamptz not null default now();
alter table public.reports add column if not exists updated_at timestamptz not null default now();

alter table public.reports
    alter column status type text using status::text;

update public.reports
set report_number = 'GM-LEGACY-' || id::text
where report_number is null or btrim(report_number) = '';

update public.reports
set status = 'Under Review'
where status is null or btrim(status) = '';

alter table public.reports
    alter column report_number set not null,
    alter column status set default 'Under Review';

create unique index if not exists reports_report_number_unique
    on public.reports (report_number);

alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;
grant all on table public.reports to service_role;
grant insert (
    report_number, title, category, priority, description, location,
    location_details, ward_number, street, area, landmark, pin_code,
    latitude, longitude, reporter_name, reporter_phone, reporter_email,
    file_name, file_path, media_type
) on public.reports to anon;

drop policy if exists reports_public_submit on public.reports;
create policy reports_public_submit
    on public.reports
    for insert
    to anon
    with check (
        status = 'Under Review'
        and report_number ~ '^GM-[0-9]{4}-[A-F0-9]{16}$'
        and char_length(coalesce(description, '')) between 15 and 1000
        and nullif(btrim(category), '') is not null
        and nullif(btrim(location), '') is not null
    );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'report-media',
    'report-media',
    true,
    31457280,
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
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
        and name ~ '^GM-[0-9]{4}-[A-F0-9]{16}/'
    );

create or replace function public.track_report(p_report_number text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
    select jsonb_build_object(
        'id', report_number,
        'title', coalesce(title, ''),
        'category', coalesce(category, ''),
        'priority', coalesce(priority, 'Medium'),
        'description', coalesce(description, ''),
        'location', coalesce(location, ''),
        'status', coalesce(status, 'Pending Review'),
        'date', created_at,
        'lastUpdated', updated_at
    )
    from public.reports
    where report_number = p_report_number
    limit 1;
$$;

revoke all on function public.track_report(text) from public;
grant execute on function public.track_report(text) to anon, authenticated;

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
