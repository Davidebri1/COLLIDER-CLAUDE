-- Moderation tables for the Imagine Market's user-generated content.
--
-- Both App Store Guideline 1.2 (Safety > User Generated Content) and Google
-- Play's User Generated Content / AI-Generated Content policies require:
--   1. An in-app way for users to report or flag objectionable content
--      without leaving the app.
--   2. A way to block abusive users.
--   3. Evidence that reports get acted on (Apple specifically expects
--      action within 24 hours).
-- This migration adds the two tables the client (src/services/market.ts:
-- reportMarketItem / blockAuthor / unblockAuthor / getBlockedAuthors) needs
-- for that. There's no real auth system in this app yet (see
-- 20260712000000_market_schema.sql's comments), so both tables key off the
-- same per-install device id already used for likes/comments.

create table if not exists market_reports (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references market_items(id) on delete cascade,
  reporter_device_id text not null,
  reported_author text,
  reason text not null,
  -- open -> reviewed -> actioned | dismissed. Nothing in the client writes
  -- to this after insert; it's for whoever reviews reports server-side.
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists market_reports_status_idx on market_reports (status, created_at);

create table if not exists user_blocks (
  blocker_device_id text not null,
  blocked_author text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_device_id, blocked_author)
);

alter table market_reports enable row level security;
alter table user_blocks enable row level security;

-- Anyone can file a report (anon device id, no auth), but reports are not
-- readable by clients at all — only inserts. Review happens via the
-- Supabase dashboard or a future admin tool, not the app itself.
create policy "anyone can file a report" on market_reports
  for insert to anon with check (true);

-- A device can freely create/read/delete its own block list. Same
-- permissive, no-auth pattern the rest of this schema already uses for
-- market_likes.
create policy "device can manage its own blocks" on user_blocks
  for all to anon
  using (true)
  with check (true);
