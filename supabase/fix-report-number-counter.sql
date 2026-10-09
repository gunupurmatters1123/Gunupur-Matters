-- Run this in the Supabase SQL Editor to repair report submissions when the
-- report-number trigger exists but its counter table is missing.

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
