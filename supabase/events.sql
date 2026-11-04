-- Run in the Supabase SQL Editor to enable the shared events timeline and secure comments.
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(btrim(title)) between 1 and 180),
    description text not null check (char_length(btrim(description)) between 1 and 5000),
    location text check (location is null or char_length(location) <= 180),
    activity_date date not null,
    image_url text not null,
    media_urls text[] not null default array[]::text[]
        check (cardinality(media_urls) <= 10),
    media_aspect_ratio text check (
        media_aspect_ratio is null
        or media_aspect_ratio in ('portrait', 'square', 'landscape')
    ),
    archived_at timestamptz,
    created_at timestamptz not null default now()
);

alter table public.events
    add column if not exists media_aspect_ratio text check (
        media_aspect_ratio is null
        or media_aspect_ratio in ('portrait', 'square', 'landscape')
    );

alter table public.events
    add column if not exists archived_at timestamptz;

alter table public.events
    add column if not exists deleted_at timestamptz;

alter table public.events
    add column if not exists media_urls text[] not null default array[]::text[]
        check (cardinality(media_urls) <= 10);

update public.events
set media_urls = array[image_url]
where cardinality(media_urls) = 0
    and image_url is not null;

create table if not exists public.event_drafts (
    id uuid primary key default gen_random_uuid(),
    description text not null default '' check (char_length(description) <= 5000),
    location text check (location is null or char_length(location) <= 180),
    activity_date date,
    image_url text,
    media_urls text[] not null default array[]::text[]
        check (cardinality(media_urls) <= 10),
    media_aspect_ratio text check (
        media_aspect_ratio is null
        or media_aspect_ratio in ('portrait', 'square', 'landscape')
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists events_activity_date_created_at_idx
    on public.events (activity_date desc, created_at desc);

alter table public.event_drafts
    add column if not exists media_urls text[] not null default array[]::text[]
        check (cardinality(media_urls) <= 10);

update public.event_drafts
set media_urls = array[image_url]
where cardinality(media_urls) = 0
    and image_url is not null;

create table if not exists public.event_comments (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    author_name text not null,
    comment_text text not null check (char_length(btrim(comment_text)) between 1 and 1000),
    created_at timestamptz not null default now(),
    constraint event_comments_author_name_valid check (
        char_length(btrim(author_name)) between 2 and 80
        and author_name ~ '[[:alnum:]]'
    )
);

create index if not exists event_comments_event_created_at_idx
    on public.event_comments (event_id, created_at);

create table if not exists public.event_comment_reports (
    id uuid primary key default gen_random_uuid(),
    comment_id uuid not null references public.event_comments(id) on delete cascade,
    reporter_hash text not null check (reporter_hash ~ '^[0-9a-f]{64}$'),
    created_at timestamptz not null default now(),
    unique (comment_id, reporter_hash)
);

create index if not exists event_comment_reports_comment_id_idx
    on public.event_comment_reports (comment_id);

create table if not exists public.event_comment_rate_events (
    id bigint generated always as identity primary key,
    ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
    action text not null check (action in ('comment', 'report')),
    created_at timestamptz not null default now()
);

create index if not exists event_comment_rate_events_lookup_idx
    on public.event_comment_rate_events (ip_hash, action, created_at desc);
create index if not exists event_comment_rate_events_created_at_idx
    on public.event_comment_rate_events (created_at);

alter table public.events enable row level security;
alter table public.event_drafts enable row level security;
alter table public.event_comments enable row level security;
alter table public.event_comment_reports enable row level security;
alter table public.event_comment_rate_events enable row level security;

revoke all on public.events from public, anon, authenticated;
revoke all on public.event_drafts from public, anon, authenticated;
revoke all on public.event_comments from public, anon, authenticated;
revoke all on public.event_comment_reports from public, anon, authenticated;
revoke all on public.event_comment_rate_events from public, anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update on public.events to authenticated;
grant select, insert, update, delete on public.event_drafts to authenticated;
grant select on public.event_comments to anon, authenticated;
grant delete on public.event_comments to authenticated;
grant select on public.event_comment_reports to authenticated;
revoke delete on public.events from public, anon, authenticated;
grant delete on public.events to authenticated;

drop policy if exists events_public_read on public.events;
create policy events_public_read
    on public.events for select to anon, authenticated
    using (archived_at is null and deleted_at is null);

drop policy if exists events_admin_read on public.events;
create policy events_admin_read
    on public.events for select to authenticated
    using (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

drop policy if exists events_admin_publish on public.events;
create policy events_admin_publish
    on public.events for insert to authenticated
    with check (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

drop policy if exists events_admin_update on public.events;
create policy events_admin_update
    on public.events for update to authenticated
    using (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin')
    with check (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

drop policy if exists events_admin_delete on public.events;
create policy events_admin_delete
    on public.events for delete to authenticated
    using (
        deleted_at is not null
        and coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin'
    );

drop policy if exists event_drafts_admin_manage on public.event_drafts;
create policy event_drafts_admin_manage
    on public.event_drafts for all to authenticated
    using (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin')
    with check (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

drop policy if exists event_comments_public_read on public.event_comments;
create policy event_comments_public_read
    on public.event_comments for select to anon, authenticated
    using (
        exists (
            select 1
            from public.events
            where events.id = event_comments.event_id
                and events.archived_at is null
                and events.deleted_at is null
        )
    );

drop policy if exists event_comments_public_submit on public.event_comments;
drop policy if exists event_comments_admin_delete on public.event_comments;
create policy event_comments_admin_delete
    on public.event_comments for delete to authenticated
    using (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

drop policy if exists event_comment_reports_admin_read on public.event_comment_reports;
create policy event_comment_reports_admin_read
    on public.event_comment_reports for select to authenticated
    using (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

create or replace function public.submit_event_comment(
    p_event_id uuid,
    p_author_name text,
    p_comment_text text,
    p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    inserted_comment public.event_comments;
    recent_count integer;
begin
    if p_ip_hash is null
        or p_ip_hash !~ '^[0-9a-f]{64}$'
        or p_author_name is null
        or char_length(btrim(p_author_name)) not between 2 and 80
        or p_author_name !~ '[[:alnum:]]'
        or p_comment_text is null
        or char_length(btrim(p_comment_text)) not between 1 and 1000 then
        raise exception 'INVALID_COMMENT';
    end if;

    if not exists (
        select 1
        from public.events
        where id = p_event_id
            and archived_at is null
            and deleted_at is null
    ) then
        raise exception 'COMMENT_NOT_FOUND';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
    delete from public.event_comment_rate_events
    where created_at < now() - interval '24 hours';

    select count(*) into recent_count
    from public.event_comment_rate_events
    where ip_hash = p_ip_hash
        and action = 'comment'
        and created_at >= now() - interval '10 minutes';

    if recent_count >= 3 then
        raise exception 'COMMENT_RATE_LIMIT';
    end if;

    insert into public.event_comment_rate_events (ip_hash, action)
    values (p_ip_hash, 'comment');

    insert into public.event_comments (event_id, author_name, comment_text)
    values (p_event_id, btrim(p_author_name), btrim(p_comment_text))
    returning * into inserted_comment;

    return to_jsonb(inserted_comment);
end;
$$;

create or replace function public.report_event_comment(
    p_comment_id uuid,
    p_ip_hash text,
    p_report_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    recent_count integer;
    inserted_count integer;
begin
    if p_ip_hash is null
        or p_ip_hash !~ '^[0-9a-f]{64}$'
        or p_report_hash is null
        or p_report_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'INVALID_REPORT';
    end if;

    if not exists (
        select 1
        from public.event_comments
        where id = p_comment_id
    ) then
        raise exception 'COMMENT_NOT_FOUND';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
    delete from public.event_comment_rate_events
    where created_at < now() - interval '24 hours';

    select count(*) into recent_count
    from public.event_comment_rate_events
    where ip_hash = p_ip_hash
        and action = 'report'
        and created_at >= now() - interval '1 hour';

    if recent_count >= 5 then
        raise exception 'REPORT_RATE_LIMIT';
    end if;

    insert into public.event_comment_rate_events (ip_hash, action)
    values (p_ip_hash, 'report');

    insert into public.event_comment_reports (comment_id, reporter_hash)
    values (p_comment_id, p_report_hash)
    on conflict (comment_id, reporter_hash) do nothing;
    get diagnostics inserted_count = row_count;

    return inserted_count > 0;
end;
$$;

revoke all on function public.submit_event_comment(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_event_comment(uuid, text, text, text) to service_role;
revoke all on function public.report_event_comment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_event_comment(uuid, text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'events',
    'events',
    true,
    8388608,
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/quicktime', 'video/webm'
    ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists events_photo_public_read on storage.objects;
create policy events_photo_public_read
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'events');

drop policy if exists events_photo_admin_upload on storage.objects;
drop policy if exists events_media_admin_upload on storage.objects;
create policy events_media_admin_upload
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'events'
        and coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin'
        and name ~ '^events/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$'
    );

drop policy if exists events_photo_admin_delete on storage.objects;
create policy events_photo_admin_delete
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'events'
        and coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin'
    );

drop function if exists public.admin_publish_event_draft(uuid, text, text, date, text, text);
drop function if exists public.admin_publish_event_draft(uuid, text, text, date, text, text, text[]);

create function public.admin_publish_event_draft(
    p_draft_id uuid,
    p_description text,
    p_location text,
    p_activity_date date,
    p_image_url text,
    p_media_aspect_ratio text,
    p_media_urls text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    published_event_id uuid;
begin
    if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
        raise exception 'Administrator access is required.';
    end if;

    if p_media_urls is null
        or cardinality(p_media_urls) not between 1 and 10
        or p_media_urls[1] is distinct from p_image_url then
        raise exception 'Choose between 1 and 10 media files.';
    end if;

    perform 1
    from public.event_drafts
    where id = p_draft_id
    for update;

    if not found then
        raise exception 'The draft was not found.';
    end if;

    insert into public.events (
        title,
        description,
        location,
        activity_date,
        image_url,
        media_urls,
        media_aspect_ratio
    )
    values (
        left(btrim(p_description), 180),
        btrim(p_description),
        nullif(btrim(p_location), ''),
        p_activity_date,
        p_image_url,
        p_media_urls,
        p_media_aspect_ratio
    )
    returning id into published_event_id;

    delete from public.event_drafts where id = p_draft_id;
    return published_event_id;
end;
$$;

revoke all on function public.admin_publish_event_draft(uuid, text, text, date, text, text, text[]) from public;
grant execute on function public.admin_publish_event_draft(uuid, text, text, date, text, text, text[]) to authenticated;

create or replace function public.admin_publish_event(
    p_description text,
    p_location text,
    p_activity_date date,
    p_media_urls text[],
    p_media_aspect_ratio text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    published_event_id uuid;
    media_path text;
begin
    if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
        raise exception 'Administrator access is required.';
    end if;

    if p_description is null
        or char_length(btrim(p_description)) not between 1 and 5000
        or p_activity_date is null
        or p_media_urls is null
        or cardinality(p_media_urls) not between 1 and 10
        or p_media_aspect_ratio not in ('portrait', 'square', 'landscape') then
        raise exception 'The post details or media are invalid.';
    end if;

    foreach media_path in array p_media_urls loop
        if media_path is null
            or media_path !~ '^events/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$' then
            raise exception 'The post contains an invalid media path.';
        end if;
    end loop;

    if cardinality(p_media_urls) > 1
        and exists (
            select 1
            from unnest(p_media_urls) as media(path)
            where media.path ~ '\.(mp4|mov|webm)$'
        ) then
        raise exception 'Choose up to 10 photos or one video.';
    end if;

    insert into public.events (
        title,
        description,
        location,
        activity_date,
        image_url,
        media_urls,
        media_aspect_ratio
    )
    values (
        left(btrim(p_description), 180),
        btrim(p_description),
        nullif(btrim(p_location), ''),
        p_activity_date,
        p_media_urls[1],
        p_media_urls,
        p_media_aspect_ratio
    )
    returning id into published_event_id;

    return published_event_id;
end;
$$;

revoke all on function public.admin_publish_event(text, text, date, text[], text) from public, anon;
grant execute on function public.admin_publish_event(text, text, date, text[], text) to authenticated;

notify pgrst, 'reload schema';
