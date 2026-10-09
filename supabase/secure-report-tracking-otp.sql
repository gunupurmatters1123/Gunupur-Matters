-- Require SMS verification before public report tracking.
-- Configure Twilio Verify secrets on the report-tracking-otp Edge Function.

create table if not exists public.deleted_report_tracking (
    report_number text primary key,
    deletion_reason text not null,
    reporter_phone text,
    deleted_at timestamptz not null default now()
);

alter table public.deleted_report_tracking
    add column if not exists reporter_phone text;

alter table public.deleted_report_tracking enable row level security;
revoke all privileges on table public.deleted_report_tracking
    from public, anon, authenticated;
grant all privileges on table public.deleted_report_tracking
    to service_role;

alter table public.reports
    add column if not exists archive_reason text;

alter table public.reports enable row level security;
revoke all privileges on table public.reports from public, anon, authenticated;
grant all privileges on table public.reports to service_role;
grant insert (
    report_number, title, category, priority, description, location,
    location_details, ward_number, street, area, landmark, pin_code,
    latitude, longitude, reporter_name, reporter_phone, reporter_email,
    file_name, file_path, media_type, status
) on public.reports to anon;

create or replace function public.validate_report_tracking_phone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    compact_phone text;
begin
    compact_phone := regexp_replace(btrim(coalesce(new.reporter_phone, '')), '[[:space:]().-]', '', 'g');
    if compact_phone !~ '^([+][1-9][0-9]{7,14}|00[1-9][0-9]{7,14}|0[6-9][0-9]{9}|[6-9][0-9]{9})$' then
        raise exception using
            errcode = '22023',
            message = 'A valid mobile phone number is required for SMS report tracking.';
    end if;
    return new;
end;
$$;

drop trigger if exists reports_validate_tracking_phone on public.reports;
create trigger reports_validate_tracking_phone
    before insert on public.reports
    for each row execute function public.validate_report_tracking_phone();

create table if not exists public.report_tracking_otp_rate_limits (
    rate_key text primary key,
    window_started_at timestamptz not null,
    last_requested_at timestamptz not null,
    request_count integer not null check (request_count between 1 and 5)
);

alter table public.report_tracking_otp_rate_limits enable row level security;
revoke all privileges on table public.report_tracking_otp_rate_limits
    from public, anon, authenticated;
grant all privileges on table public.report_tracking_otp_rate_limits
    to service_role;

create or replace function public.claim_report_tracking_otp(
    p_rate_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    claimed boolean := false;
begin
    if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
        raise exception using errcode = '42501', message = 'Service role required.';
    end if;
    if p_rate_key is null or btrim(p_rate_key) = '' then
        raise exception using errcode = '22023', message = 'A rate-limit key is required.';
    end if;

    insert into public.report_tracking_otp_rate_limits (
        rate_key, window_started_at, last_requested_at, request_count
    )
    values (p_rate_key, now(), now(), 1)
    on conflict (rate_key) do update
    set window_started_at = case
            when report_tracking_otp_rate_limits.window_started_at <= now() - interval '1 hour'
                then now()
            else report_tracking_otp_rate_limits.window_started_at
        end,
        last_requested_at = now(),
        request_count = case
            when report_tracking_otp_rate_limits.window_started_at <= now() - interval '1 hour'
                then 1
            else report_tracking_otp_rate_limits.request_count + 1
        end
    where report_tracking_otp_rate_limits.last_requested_at <= now() - interval '60 seconds'
      and (
          report_tracking_otp_rate_limits.window_started_at <= now() - interval '1 hour'
          or report_tracking_otp_rate_limits.request_count < 5
      )
    returning true into claimed;

    return claimed;
end;
$$;

revoke all on function public.claim_report_tracking_otp(text) from public, anon, authenticated;
grant execute on function public.claim_report_tracking_otp(text) to service_role;

revoke all on function public.track_report(text) from public, anon, authenticated;
grant execute on function public.track_report(text) to service_role;

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
        report_number, deletion_reason, reporter_phone, deleted_at
    )
    select
        report_number,
        coalesce(nullif(btrim(archive_reason), ''), 'No reason was recorded.'),
        reporter_phone,
        now()
    from public.reports
    where report_number = p_report_number and status = 'Archived'
    on conflict (report_number) do update
    set deletion_reason = excluded.deletion_reason,
        reporter_phone = excluded.reporter_phone,
        deleted_at = excluded.deleted_at;

    delete from public.reports
    where report_number = p_report_number and status = 'Archived';
    return found;
end;
$$;

revoke all on function public.admin_delete_archived_report(text) from public;
grant execute on function public.admin_delete_archived_report(text) to authenticated;

notify pgrst, 'reload schema';
