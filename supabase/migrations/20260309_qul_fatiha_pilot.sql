-- QUL Pilot (Fatiha, Turkish-first)
-- Date: 2026-03-09

-- ========================
-- Surah metadata enrichment
-- ========================
alter table public.surahs
  add column if not exists transliteration_tr text,
  add column if not exists transliteration_en text,
  add column if not exists source text default 'legacy',
  add column if not exists is_fallback boolean not null default false;

-- ========================
-- Verse text variants + provenance
-- ========================
alter table public.verses
  add column if not exists verse_text_uthmani text,
  add column if not exists verse_text_plain text,
  add column if not exists verse_text_tajweed text,
  add column if not exists text_source text default 'legacy',
  add column if not exists text_is_fallback boolean not null default false,
  add column if not exists qul_import_batch text,
  add column if not exists qul_imported_at timestamptz;

create index if not exists idx_verses_text_source on public.verses (text_source);
create index if not exists idx_verses_surah_verse on public.verses (surah_id, verse_number);

-- Backfill defaults from current verse body.
update public.verses
set
  verse_text_uthmani = coalesce(verse_text_uthmani, verse_text),
  verse_text_plain = coalesce(verse_text_plain, verse_without_vowel, verse_simplified, verse_text),
  verse_text_tajweed = coalesce(verse_text_tajweed, verse_text)
where surah_id = 1 and verse_number between 1 and 7;

-- ========================
-- Word-level morphology + provenance
-- ========================
alter table public.verse_words
  add column if not exists source text default 'legacy',
  add column if not exists is_fallback boolean not null default false,
  add column if not exists grammar_pos text,
  add column if not exists grammar_pos_ar text,
  add column if not exists grammar_lemma text,
  add column if not exists grammar_lemma_ar text,
  add column if not exists grammar_stem text,
  add column if not exists grammar_root text,
  add column if not exists grammar_pattern text,
  add column if not exists grammar_case text,
  add column if not exists grammar_mood text,
  add column if not exists grammar_person text,
  add column if not exists grammar_gender text,
  add column if not exists grammar_number text,
  add column if not exists grammar_voice text,
  add column if not exists grammar_aspect text,
  add column if not exists grammar_state text,
  add column if not exists grammar_form text,
  add column if not exists grammar_i3rab text,
  add column if not exists grammar_details jsonb;

create index if not exists idx_verse_words_source on public.verse_words (source);
create index if not exists idx_verse_words_verse_sort on public.verse_words (verse_id, sort_number);

delete from public.verse_words a
using public.verse_words b
where a.ctid < b.ctid
  and a.verse_id = b.verse_id
  and a.sort_number = b.sort_number;

create unique index if not exists uq_verse_words_verse_sort on public.verse_words (verse_id, sort_number);
