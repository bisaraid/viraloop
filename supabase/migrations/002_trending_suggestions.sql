-- ViraLoop Database Schema — Migration 002
-- Tabel untuk menyimpan trending suggestions hasil generate LLM (di-cache)

-- 1. TRENDING_SUGGESTIONS
create table if not exists trending_suggestions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references content_categories(id),
  suggestion_text text not null,   -- angle/tema umum, BUKAN judul mentah
  source_pattern text,             -- catatan pattern yang mendasari (opsional, untuk debug)
  generated_at timestamptz default now()
);

-- Index untuk query per kategori (diurutkan berdasarkan generated_at DESC)
create index if not exists idx_trending_suggestions_category
  on trending_suggestions (category_id, generated_at desc);

-- ========================
-- RLS (Row Level Security)
-- ========================

alter table trending_suggestions enable row level security;

-- Policy: PUBLIC READ — siapa saja bisa baca suggestions
drop policy if exists "Public read trending_suggestions" on trending_suggestions;
create policy "Public read trending_suggestions"
  on trending_suggestions
  for select
  using (true);

-- NOTE:
-- - SELECT: anon key bisa karena ada policy "for select using (true)"
-- - INSERT/UPDATE/DELETE: anon key DITOLAK karena tidak ada policy untuk operasi tsb
-- - Service role key: tetap bisa write karena bypass RLS sepenuhnya