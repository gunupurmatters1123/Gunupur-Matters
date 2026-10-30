-- Run once in the Supabase SQL Editor to enable the shared events timeline.
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(btrim(title)) between 1 and 180),
    description text not null check (char_length(btrim(description)) between 1 and 5000),
    location text check (location is null or char_length(location) <= 180),
    activity_date date not null,
    image_url text not null,
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

create table if not exists public.event_drafts (
    id uuid primary key default gen_random_uuid(),
    description text not null default '' check (char_length(description) <= 5000),
    location text check (location is null or char_length(location) <= 180),
    activity_date date,
    image_url text,
    media_aspect_ratio text check (
        media_aspect_ratio is null
        or media_aspect_ratio in ('portrait', 'square', 'landscape')
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists events_activity_date_created_at_idx
    on public.events (activity_date desc, created_at desc);

create table if not exists public.event_comments (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
    comment_text text not null check (char_length(btrim(comment_text)) between 1 and 1000),
    created_at timestamptz not null default now()
);

create index if not exists event_comments_event_created_at_idx
    on public.event_comments (event_id, created_at);

alter table public.events enable row level security;
alter table public.event_drafts enable row level security;
alter table public.event_comments enable row level security;

revoke all on public.events from public, anon, authenticated;
revoke all on public.event_drafts from public, anon, authenticated;
revoke all on public.event_comments from public, anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_drafts to authenticated;
grant select, insert on public.event_comments to anon, authenticated;

drop policy if exists events_public_read on public.events;
create policy events_public_read
    on public.events for select to anon, authenticated
    using (archived_at is null);

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
    using (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

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
        )
    );

drop policy if exists event_comments_public_submit on public.event_comments;
create policy event_comments_public_submit
    on public.event_comments for insert to anon, authenticated
    with check (
        char_length(btrim(author_name)) between 1 and 80
        and char_length(btrim(comment_text)) between 1 and 1000
    );

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

create or replace function public.admin_publish_event_draft(
    p_draft_id uuid,
    p_description text,
    p_location text,
    p_activity_date date,
    p_image_url text,
    p_media_aspect_ratio text
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
        media_aspect_ratio
    )
    values (
        left(btrim(p_description), 180),
        btrim(p_description),
        nullif(btrim(p_location), ''),
        p_activity_date,
        p_image_url,
        p_media_aspect_ratio
    )
    returning id into published_event_id;

    delete from public.event_drafts where id = p_draft_id;
    return published_event_id;
end;
$$;

revoke all on function public.admin_publish_event_draft(uuid, text, text, date, text, text) from public;
grant execute on function public.admin_publish_event_draft(uuid, text, text, date, text, text) to authenticated;
