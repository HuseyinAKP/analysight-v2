-- Portfolio positions table
-- Supabase SQL Editor'da çalıştır

create table if not exists portfolio_positions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  symbol      text not null,
  quantity    numeric(18,6) not null,
  avg_price   numeric(18,6) not null,
  currency    text not null default 'TRY',
  note        text default '',
  created_at  timestamptz not null default now()
);

-- Her kullanıcı sadece kendi satırlarını görsün
alter table portfolio_positions enable row level security;

create policy "Users see own positions"
  on portfolio_positions for select
  using (auth.uid() = user_id);

create policy "Users insert own positions"
  on portfolio_positions for insert
  with check (auth.uid() = user_id);

create policy "Users delete own positions"
  on portfolio_positions for delete
  using (auth.uid() = user_id);

create policy "Users update own positions"
  on portfolio_positions for update
  using (auth.uid() = user_id);
