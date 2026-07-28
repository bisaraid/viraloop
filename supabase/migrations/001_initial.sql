-- ViraLoop Database Schema — Migration 001
-- Tabel inti untuk crawl results, pattern insight, dan script generation

-- 1. CONTENT_CATEGORIES
create table if not exists content_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

-- 2. CONTENT_SAMPLES
create table if not exists content_samples (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references content_categories(id),
  platform text not null,
  external_id text not null,
  title text not null,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  duration_seconds integer,
  published_at timestamptz,
  pattern_tags jsonb,
  captured_at timestamptz default now(),
  unique(platform, external_id)
);

-- 3. PATTERN_INSIGHTS
create table if not exists pattern_insights (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references content_categories(id),
  pattern_key text not null,
  pattern_value text not null,
  avg_view_count numeric,
  sample_count integer,
  low_confidence boolean default true,
  computed_at timestamptz default now()
);

-- 4. SCRIPT_GENERATIONS
create table if not exists script_generations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references content_categories(id),
  user_input text,
  hook_pattern_used text,
  final_script text,
  llm_provider text,
  created_at timestamptz default now()
);

-- ========================
-- RLS (Row Level Security)
-- ========================

-- Aktifkan RLS di semua tabel
alter table content_categories enable row level security;
alter table content_samples enable row level security;
alter table pattern_insights enable row level security;
alter table script_generations enable row level security;

-- Policy: PUBLIC READ untuk content_samples — siapa saja bisa baca
drop policy if exists "Public read content_samples" on content_samples;
create policy "Public read content_samples"
  on content_samples
  for select
  using (true);

-- Policy: PUBLIC READ untuk pattern_insights — siapa saja bisa baca
drop policy if exists "Public read pattern_insights" on pattern_insights;
create policy "Public read pattern_insights"
  on pattern_insights
  for select
  using (true);

-- Policy: PUBLIC READ untuk content_categories — siapa saja bisa baca
drop policy if exists "Public read content_categories" on content_categories;
create policy "Public read content_categories"
  on content_categories
  for select
  using (true);

-- HANYA SELECT policy yang dibuat.
-- INSERT/UPDATE/DELETE TIDAK punya policy, jadi anon key akan ditolak otomatis oleh RLS.
-- Service role key tetap bisa write karena bypass RLS.
drop policy if exists "Public read script_generations" on script_generations;
create policy "Public read script_generations"
  on script_generations
  for select
  using (true);

-- NOTE: 
-- - SELECT: anon key bisa karena ada policy "for select using (true)"
-- - INSERT/UPDATE/DELETE: anon key DITOLAK karena tidak ada policy untuk operasi tsb
-- - Service role key: tetap bisa write karena bypass RLS sepenuhnya
