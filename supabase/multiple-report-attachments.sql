-- Apply this migration in the Supabase SQL Editor to allow up to four media
-- files per report. Each file remains limited to 30 MB.

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
    attachment_list jsonb := p_report->'attachments';
    attachment jsonb;
    attachment_path text;
    attachment_name text;
    attachment_media_type text;
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

    if attachment_list is null then
        if nullif(btrim(coalesce(p_report->>'file_path', '')), '') is null then
            attachment_list := '[]'::jsonb;
        else
            attachment_list := jsonb_build_array(jsonb_build_object(
                'file_name', p_report->'file_name',
                'file_path', p_report->'file_path',
                'media_type', p_report->'media_type',
                'content_type', p_report->'file_content_type',
                'file_size', p_report->'file_size'
            ));
        end if;
    end if;

    if jsonb_typeof(attachment_list) <> 'array' then
        raise exception 'Uploaded file metadata is invalid.';
    end if;

    if jsonb_array_length(attachment_list) > 4 then
        raise exception 'A report can include up to 4 photos or videos.';
    end if;

    for attachment in
        select value from jsonb_array_elements(attachment_list) as items(value)
    loop
        if nullif(btrim(coalesce(attachment->>'file_name', '')), '') is null
            or nullif(btrim(coalesce(attachment->>'file_path', '')), '') is null
            or coalesce(attachment->>'media_type', '') not in ('image', 'video')
            or coalesce(attachment->>'content_type', '') not in (
                'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                'image/heic', 'image/heif',
                'video/mp4', 'video/quicktime', 'video/webm',
                'video/x-msvideo', 'video/x-matroska', 'video/mpeg'
            )
            or not (
                (attachment->>'media_type' = 'image' and attachment->>'content_type' like 'image/%')
                or (attachment->>'media_type' = 'video' and attachment->>'content_type' like 'video/%')
            )
            or attachment->>'file_path' not like
                'https://alptdaggxnvilkwlnfrr.supabase.co/storage/v1/object/public/report-media/reports/%'
            or coalesce(attachment->>'file_size', '') !~ '^[0-9]+$'
            or (attachment->>'file_size')::bigint <= 0
            or (attachment->>'file_size')::bigint > 31457280 then
            raise exception 'Uploaded file metadata is invalid.';
        end if;
    end loop;

    attachment_path := nullif(btrim(coalesce(attachment_list->0->>'file_path', '')), '');
    attachment_name := nullif(btrim(coalesce(attachment_list->0->>'file_name', '')), '');
    attachment_media_type := nullif(btrim(coalesce(attachment_list->0->>'media_type', '')), '');

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
        'Pending Review'
    )
    returning report_number into saved_report_number;

    for attachment in
        select value from jsonb_array_elements(attachment_list) as items(value)
    loop
        insert into public.report_attachments (
            report_number, file_name, file_path, media_type, content_type, file_size
        ) values (
            saved_report_number,
            attachment->>'file_name',
            attachment->>'file_path',
            attachment->>'media_type',
            attachment->>'content_type',
            (attachment->>'file_size')::bigint
        );
    end loop;

    return saved_report_number;
end;
$$;

revoke all on function public.submit_report(jsonb) from public;
grant execute on function public.submit_report(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
