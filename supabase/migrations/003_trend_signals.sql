-- ViraLoop Database Schema — Migration 003
-- Tabel trend_signals: menyimpan data trending dari Google Trends & Reddit
-- Data ini TERPISAH dari content_samples (yang video-specific).
-- Digunakan sebagai sinyal tambahan untuk suggestion/insight di masa depan.

-- 1. TREND_SIGNALS
create table if not exists trend_signals (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references content_categories(id),
  source text not null,           -- 'google_trends' | 'reddit'
  keyword text not null,
  signal_value numeric,           -- google trends: interest score 0-100;
                                   -- reddit: upvote/engagement score
  raw_context text,               -- reddit: judul post; google trends: null
  captured_at timestamptz default now()
);

-- Index untuk query per kategori + source
create index if not exists idx_trend_signals_category
  on trend_signals (category_id, source, captured_at desc);

-- ========================
-- RLS (Row Level Security)
-- ========================

alter table trend_signals enable row level security;

-- Policy: PUBLIC READ — siapa saja bisa baca trend signals
drop policy if exists "Public read trend_signals" on trend_signals;
create policy "Public read trend_signals"
  on trend_signals
  for select
  using (true);

-- NOTE:
-- - SELECT: anon key bisa karena ada policy "for select using (true)"
-- - INSERT/UPDATE/DELETE: anon key DITOLAK karena tidak ada policy untuk operasi tsb
-- - Service role key: tetap bisa write karena bypass RLS sepenuhnya