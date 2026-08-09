-- The Albatross Files — database schema (run once in Supabase → SQL Editor).

-- One row per submission.
create table if not exists results (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null,
  phone       text not null,
  cluster     text not null,
  score       int  not null,
  total       int  not null,
  time_ms     bigint not null,
  answers     jsonb
);

-- One attempt per person (Name + Phone, case-insensitive). This is the
-- race-proof backstop for concurrent submissions.
create unique index if not exists results_person_unique
  on results (lower(name), lower(phone));

-- Small key/value table (used to remember the Telegram leaderboard message id).
create table if not exists app_meta (
  key   text primary key,
  value text
);
