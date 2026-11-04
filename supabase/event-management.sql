-- Apply once to an existing project to enable admin edit, archive, and recoverable trash.
-- Run events.sql afterward to enable rate-limited event comments and reporting.
alter table public.events
    add column if not exists archived_at timestamptz,
    add column if not exists deleted_at timestamptz,
    add column if not exists media_urls text[] not null default array[]::text[]
        check (cardinality(media_urls) <= 10),
    add column if not exists media_aspect_ratio text check (
        media_aspect_ratio is null
        or media_aspect_ratio in ('portrait', 'square', 'landscape')
    );

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

alter table public.event_drafts
    add column if not exists media_urls text[] not null default array[]::text[]
        check (cardinality(media_urls) <= 10);

update public.event_drafts
set media_urls = array[image_url]
where cardinality(media_urls) = 0
    and image_url is not null;

alter table public.events enable row level security;
alter table public.event_drafts enable row level security;
alter table public.event_comments enable row level security;

revoke all on public.events from public, anon, authenticated;
revoke all on public.event_comments from public, anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update on public.events to authenticated;
revoke delete on public.events from public, anon, authenticated;
grant select on public.event_comments to anon, authenticated;
grant delete on public.event_comments to authenticated;

revoke all on public.event_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.event_drafts to authenticated;

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

alter table public.event_comments
    drop constraint if exists event_comments_author_name_check;
alter table public.event_comments
    drop constraint if exists event_comments_author_name_valid;
alter table public.event_comments
    add constraint event_comments_author_name_valid check (
        char_length(btrim(author_name)) between 2 and 80
        and author_name ~ '[[:alnum:]]'
    ) not valid;

notify pgrst, 'reload schema';
