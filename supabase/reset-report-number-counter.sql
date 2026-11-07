-- Run in the Supabase SQL Editor to restart numbering at GM-26-0001.
-- Removes tracking tombstones for the two confirmed trial reports only.

begin;

do $$
begin
    if to_char(current_date, 'YY') <> '26' then
        raise exception 'This reset only supports GM-26 report numbering.';
    end if;

    if exists (
        select 1
        from public.reports
        where report_number ~ '^GM-26-[0-9]{4,}$'
    ) then
        raise exception 'GM-26 reports still exist. Refusing to reset the counter.';
    end if;

    delete from public.deleted_report_tracking
    where report_number in ('GM-26-0001', 'GM-26-0002');

    if exists (
        select 1
        from public.deleted_report_tracking
        where report_number ~ '^GM-26-[0-9]{4,}$'
    ) then
        raise exception 'Other deleted GM-26 tracking records still exist. Refusing to reset the counter.';
    end if;

    insert into public.report_number_counters (year_code, last_value)
    values ('26', 0)
    on conflict (year_code) do update
    set last_value = 0;
end;
$$;

notify pgrst, 'reload schema';

commit;
