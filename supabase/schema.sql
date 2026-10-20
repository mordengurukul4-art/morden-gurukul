-- Modern Gurukul initial schema
-- Run this in Supabase Dashboard > SQL Editor.
-- Then set your own account's role to admin using the final query below.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'Technology',
  level text not null default 'Beginner',
  active boolean not null default true,
  is_coming_soon boolean not null default false,
  lesson_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  video_path text,
  video_url text,
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "Profiles can read own profile" on public.profiles;
create policy "Profiles can read own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users can update own name" on public.profiles;
create policy "Users can update own name" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'student');

drop policy if exists "Courses visible to everyone" on public.courses;
create policy "Courses visible to everyone" on public.courses
for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists "Admins manage courses" on public.courses;
create policy "Admins manage courses" on public.courses
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Lessons visible to everyone" on public.lessons;
create policy "Lessons visible to everyone" on public.lessons
for select to anon, authenticated using (true);

drop policy if exists "Admins manage lessons" on public.lessons;
create policy "Admins manage lessons" on public.lessons
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users read own progress" on public.lesson_progress;
create policy "Users read own progress" on public.lesson_progress
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users manage own progress" on public.lesson_progress;
create policy "Users manage own progress" on public.lesson_progress
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create a private video bucket. This starter currently displays videos using public URLs;
-- switch to signed URLs for production if lectures must be protected from direct link sharing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-videos', 'course-videos', true, 104857600,
  array['video/mp4','video/webm','video/ogg','video/quicktime'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload course videos" on storage.objects;
create policy "Admins upload course videos" on storage.objects
for insert to authenticated with check (bucket_id = 'course-videos' and public.is_admin());

drop policy if exists "Admins update course videos" on storage.objects;
create policy "Admins update course videos" on storage.objects
for update to authenticated using (bucket_id = 'course-videos' and public.is_admin())
with check (bucket_id = 'course-videos' and public.is_admin());

drop policy if exists "Admins delete course videos" on storage.objects;
create policy "Admins delete course videos" on storage.objects
for delete to authenticated using (bucket_id = 'course-videos' and public.is_admin());

drop policy if exists "Public can read course videos" on storage.objects;
create policy "Public can read course videos" on storage.objects
for select to anon, authenticated using (bucket_id = 'course-videos');

-- Seed the one active course. Other course cards are shown as Coming Soon in the frontend.
insert into public.courses (title, description, category, level, active, is_coming_soon, lesson_count)
select 'AI-Powered Web Development',
       'Build real websites with modern tools, learn the fundamentals, and turn ideas into working projects.',
       'Web Development', 'Beginner', true, false, 0
where not exists (select 1 from public.courses where title = 'AI-Powered Web Development');

-- After you sign up on the site, find your user UUID in Authentication > Users.
-- Replace YOUR_USER_UUID below with that UUID and run this one-time command:
-- update public.profiles set role = 'admin' where id = 'YOUR_USER_UUID';
