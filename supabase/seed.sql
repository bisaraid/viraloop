-- ViraLoop Seed Data
-- Isi content_categories dengan 6 kategori dari kode existing

insert into content_categories (slug, name) values
  ('horror', 'Horror'),
  ('psikologi', 'Psikologi'),
  ('romance', 'Romance'),
  ('motivasi', 'Motivasi'),
  ('edukasi', 'Edukasi'),
  ('affiliate', 'Affiliate')
on conflict (slug) do nothing;