-- Employee-managed profile details. HR-owned job and reporting fields remain
-- in public.employees / the protected columns on public.profiles.
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists phone text,
  add column if not exists bio text;

-- Private profile images. Every signed-in colleague may view the images, but
-- only the owner may create, replace, or remove files in their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Profile images are visible to colleagues" on storage.objects;
create policy "Profile images are visible to colleagues"
on storage.objects for select
to authenticated
using (bucket_id = 'profile-images');

drop policy if exists "Users upload their profile image" on storage.objects;
create policy "Users upload their profile image"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users replace their profile image" on storage.objects;
create policy "Users replace their profile image"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users remove their profile image" on storage.objects;
create policy "Users remove their profile image"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create table if not exists public.company_engagement_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('health_challenge', 'promotion', 'prize')),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 500),
  details text,
  recipient_name text,
  starts_on date,
  ends_on date,
  cta_label text,
  cta_url text,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_engagement_post_dates check (
    ends_on is null or starts_on is null or ends_on >= starts_on
  )
);

create index if not exists company_engagement_posts_published_kind_idx
  on public.company_engagement_posts (published, kind, starts_on desc, created_at desc);

alter table public.company_engagement_posts enable row level security;
revoke all on table public.company_engagement_posts from anon, authenticated;
grant select on table public.company_engagement_posts to authenticated;

drop policy if exists "Colleagues read published company posts" on public.company_engagement_posts;
create policy "Colleagues read published company posts"
on public.company_engagement_posts for select
to authenticated
using (published = true);

drop policy if exists "Admins read all company posts" on public.company_engagement_posts;
create policy "Admins read all company posts"
on public.company_engagement_posts for select
to authenticated
using (
  exists (
    select 1 from public.profiles viewer
    where viewer.id = (select auth.uid()) and viewer.role = 'admin'
  )
);
