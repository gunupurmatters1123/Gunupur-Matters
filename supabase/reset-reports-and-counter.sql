-- Permanently clears all reports and related database records.
-- Run once in the Supabase SQL Editor. The next report number will be GM-26-0001.

begin;

do $$
begin
    if to_char(current_date, 'YY') <> '26' then
        raise exception 'This reset only supports GM-26 report numbering.';
    end if;
end;
$$;

truncate table
    public.reports,
    public.deleted_report_tracking,
    public.report_number_counters
restart identity cascade;

insert into public.report_number_counters (year_code, last_value)
values ('26', 0);

notify pgrst, 'reload schema';

commit;
