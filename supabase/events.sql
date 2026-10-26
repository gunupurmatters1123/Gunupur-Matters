-- Run once in the Supabase SQL Editor to enable the shared events timeline.
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(btrim(title)) between 1 and 180),
    description text not null check (char_length(btrim(description)) between 1 and 5000),
    location text check (location is null or char_length(location) <= 180),
    activity_date date not null,
    image_url text not null,
    created_at timestamptz not null default now()
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
alter table public.event_comments enable row level security;

revoke all on public.events from public, anon, authenticated;
revoke all on public.event_comments from public, anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert on public.events to authenticated;
grant select, insert on public.event_comments to anon, authenticated;

drop policy if exists events_public_read on public.events;
create policy events_public_read
    on public.events for select to anon, authenticated
    using (true);

drop policy if exists events_admin_publish on public.events;
create policy events_admin_publish
    on public.events for insert to authenticated
    with check (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

drop policy if exists event_comments_public_read on public.event_comments;
create policy event_comments_public_read
    on public.event_comments for select to anon, authenticated
    using (true);

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
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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
create policy events_photo_admin_upload
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'events'
        and coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin'
        and name ~ '^events/[0-9a-f-]{36}\.(jpg|png|webp|gif)$'
    );

drop policy if exists events_photo_admin_delete on storage.objects;
create policy events_photo_admin_delete
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'events'
        and coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin'
    );

-- Seed a launch post so the feed has a real, shareable activity card on setup.
insert into public.events (title, description, location, activity_date, image_url)
select
    'Our community, our story',
    'This is where we will share photos and updates from our community activities. Check back for the latest moments from Gunupur.',
    'Gunupur',
    current_date,
    'Photos/prom_team.png'
where not exists (select 1 from public.events);
