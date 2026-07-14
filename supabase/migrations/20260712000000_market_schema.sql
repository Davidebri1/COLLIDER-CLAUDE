-- Imagine Market backend schema: market_items, market_likes, market_comments.
-- Run this in the Supabase SQL editor for the project referenced in
-- src/services/supabase.ts (https://gmenftvasdbhkbinkdux.supabase.co).
--
-- MVP auth model: there is no real user-auth system in the app yet. Every
-- device generates a stable per-install UUID (see src/services/market.ts ->
-- getDeviceId()) which is stored in AsyncStorage and sent as `device_id` /
-- `author_device_id`. RLS therefore uses permissive "true" policies for
-- select/insert (this is an anonymous public app using the publishable key,
-- so there is no server-side notion of "this request belongs to device X" to
-- enforce against). Delete policies are intentionally NOT created for
-- market_items/market_comments in this MVP (no backend delete path from the
-- app yet); market_likes gets an "true" delete policy because unliking is a
-- core, expected flow (insert/delete a like row = toggle).

create extension if not exists pgcrypto;

-- ── market_items ────────────────────────────────────────────────────────────
create table if not exists public.market_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image', 'video', 'music', 'coding')),
  prompt text not null,
  model text not null,
  author text not null,
  author_device_id text,
  likes int not null default 0,
  url text,
  created_at timestamptz not null default now()
);

alter table public.market_items enable row level security;

drop policy if exists "market_items_select_all" on public.market_items;
create policy "market_items_select_all" on public.market_items
  for select using (true);

drop policy if exists "market_items_insert_all" on public.market_items;
create policy "market_items_insert_all" on public.market_items
  for insert with check (true);

-- No update/delete policy for market_items in this MVP: publishing is
-- append-only from the app's perspective; removing a published item is not
-- yet a supported flow, so we don't open a delete surface for it.

-- ── market_likes ────────────────────────────────────────────────────────────
create table if not exists public.market_likes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.market_items(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  unique (item_id, device_id)
);

alter table public.market_likes enable row level security;

drop policy if exists "market_likes_select_all" on public.market_likes;
create policy "market_likes_select_all" on public.market_likes
  for select using (true);

drop policy if exists "market_likes_insert_all" on public.market_likes;
create policy "market_likes_insert_all" on public.market_likes
  for insert with check (true);

drop policy if exists "market_likes_delete_all" on public.market_likes;
create policy "market_likes_delete_all" on public.market_likes
  for delete using (true);

-- Keep market_items.likes in sync with market_likes via trigger, so the
-- feed can just read the denormalized counter instead of a count(*) join.
create or replace function public.market_likes_sync_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.market_items set likes = likes + 1 where id = new.item_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.market_items set likes = greatest(0, likes - 1) where id = old.item_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists market_likes_after_insert on public.market_likes;
create trigger market_likes_after_insert
  after insert on public.market_likes
  for each row execute function public.market_likes_sync_count();

drop trigger if exists market_likes_after_delete on public.market_likes;
create trigger market_likes_after_delete
  after delete on public.market_likes
  for each row execute function public.market_likes_sync_count();

-- ── market_comments ─────────────────────────────────────────────────────────
create table if not exists public.market_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.market_items(id) on delete cascade,
  device_id text not null,
  author_label text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.market_comments enable row level security;

drop policy if exists "market_comments_select_all" on public.market_comments;
create policy "market_comments_select_all" on public.market_comments
  for select using (true);

drop policy if exists "market_comments_insert_all" on public.market_comments;
create policy "market_comments_insert_all" on public.market_comments
  for insert with check (true);

-- No update/delete policy for market_comments in this MVP either.

create index if not exists market_items_created_at_idx on public.market_items (created_at desc);
create index if not exists market_items_kind_idx on public.market_items (kind);
create index if not exists market_likes_item_id_idx on public.market_likes (item_id);
create index if not exists market_comments_item_id_idx on public.market_comments (item_id);

-- ── Seed: the 18 curated DEFAULT_MARKET_ITEMS from src/state.tsx ───────────
-- (Only the hand-authored items are seeded — NOT the procedurally generated
-- generateMoreMarketItems() fakes, per the task spec.)
insert into public.market_items (kind, prompt, model, author, likes, url, created_at) values
  ('image', 'A glowing orange nebula shaped like a mechanical butterfly, unreal engine rendering', 'img/flux-schnell', '@cosmic_render', 1420, null, now() - interval '18 days'),
  ('image', 'Detailed cyberpunk samurai standing under neon rain, dramatic lighting, 8k resolution', 'img/sdxl', '@pixel_ronin', 980, null, now() - interval '17 days'),
  ('image', 'Magical library hidden inside a giant hollow oak tree, fantasy painting style', 'img/midjourney-v6', '@spellbound', 2310, null, now() - interval '16 days'),
  ('image', 'A majestic crystalline white stag walking through an enchanted emerald forest', 'img/flux-dev', '@aurora_art', 880, null, now() - interval '15 days'),
  ('image', 'Retro-futuristic astronaut lounge on Mars, vaporwave aesthetic, warm shadows', 'img/dalle-3', '@red_planet', 1250, null, now() - interval '14 days'),
  ('image', 'Ethereal glass palace floating above a sea of clouds during a golden sunset', 'img/imagen-3', '@stratus_design', 3100, null, now() - interval '13 days'),

  ('video', 'Cinematic flythrough of a translucent glass skyscraper city during a meteor shower', 'vid/sora-2', '@glass_lens', 4500, 'https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-futuristic-tunnel-with-neon-lights-42292-large.mp4', now() - interval '12 days'),
  ('video', 'Macro video of tiny mechanical robots farming moss on a basalt rock, photorealistic', 'vid/veo-3', '@nano_nature', 2800, 'https://assets.mixkit.co/videos/preview/mixkit-digital-circuit-board-background-42289-large.mp4', now() - interval '11 days'),
  ('video', 'A surreal cosmic black hole swallowing a glowing blue solar system, fluid dynamics, high motion', 'vid/luma-dream', '@event_horizon', 3400, 'https://assets.mixkit.co/videos/preview/mixkit-rotating-planet-earth-in-outer-space-42358-large.mp4', now() - interval '10 days'),
  ('video', 'Slow motion close-up of clockwork gear mechanisms rotating inside a crystal sphere', 'vid/kling-ai', '@crono_watch', 1900, 'https://assets.mixkit.co/videos/preview/mixkit-clockwork-clock-gears-moving-macro-32752-large.mp4', now() - interval '9 days'),

  ('music', 'Nocturnal synthwave with deep cello swells and retro analog drum beat', 'mus/udio', '@retro_wave', 1850, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', now() - interval '8 days'),
  ('music', 'Minimalist piano solo transitioning into a cinematic ambient string crescendo', 'mus/suno', '@mozart_ambient', 2900, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', now() - interval '7 days'),
  ('music', 'Glitch-hop lo-fi instrumental beat with vinyl crackles and jazz trumpet accents', 'mus/musiclm', '@groove_vinyl', 1100, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', now() - interval '6 days'),
  ('music', 'Dark industrial warehouse techno loop with heavy modular synth modulation', 'mus/riffusion', '@heavy_voltage', 950, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', now() - interval '5 days'),

  ('coding', 'Contrast/debate helper: Give a safe option, a bold alternative, and a contrarian critique', 'pro/gpt-5-code', '@dialectic_ai', 3200, null, now() - interval '4 days'),
  ('coding', 'React 3D canvas preset: Render an interactive procedural marble shader sphere', 'or/qwen-coder-72b', '@react_specular', 2500, null, now() - interval '3 days'),
  ('coding', 'Fast rust game engine boilerplate: Initialize a 60fps game loop with input handling', 'pro/claude-4.5-code', '@rust_gear', 4100, null, now() - interval '2 days'),
  ('coding', 'Automated regex compiler: Synthesize and explain complex regex search patterns', 'elite/o1-code', '@parser_regex', 1800, null, now() - interval '1 days')
on conflict do nothing;
