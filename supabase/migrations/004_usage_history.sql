-- ViraLoop Database Schema — Migration 004
-- Tabel usage_history untuk anti-repeat hook/angle per user
-- identity_key masih placeholder (anon_id/user_id), integrasi penuh dengan cookie di Task 4

create table if not exists usage_history (
  id uuid primary key default gen_random_uuid(),
  identity_key text not null,
  category_id text not null,
  hook_pattern_value_used text,
  topic text,
  created_at timestamptz default now()
);

-- Index untuk query cepat: cari riwayat terakhir milik identity_key + category
create index if not exists idx_usage_history_identity_category
  on usage_history (identity_key, category_id, created_at desc);

-- ========================
-- RLS (Row Level Security)
-- ========================

alter table usage_history enable row level security;

-- Policy: PUBLIC READ — siapa saja bisa baca (dibutuhkan untuk cek riwayat)
drop policy if exists "Public read usage_history" on usage_history;
create policy "Public read usage_history"
  on usage_history
  for select
  using (true);

-- NOTE:
-- - SELECT: anon key bisa karena ada policy "for select using (true)"
-- - INSERT/UPDATE/DELETE: anon key DITOLAK karena tidak ada policy untuk operasi tsb
-- - Service role key: tetap bisa write karena bypass RLS sepenuhnya