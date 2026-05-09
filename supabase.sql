create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  date date not null,
  amount numeric not null default 0,
  odds numeric not null default 1,
  book text,
  friend text not null default 'Grupo',
  pick text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost')),
  created_at timestamptz not null default now()
);

alter table public.bets enable row level security;

drop policy if exists "La banda puede leer apuestas" on public.bets;
drop policy if exists "La banda puede crear apuestas" on public.bets;
drop policy if exists "La banda puede actualizar apuestas" on public.bets;
drop policy if exists "La banda puede borrar apuestas" on public.bets;

create policy "La banda puede leer apuestas"
on public.bets for select
to anon
using (true);

create policy "La banda puede crear apuestas"
on public.bets for insert
to anon
with check (true);

create policy "La banda puede actualizar apuestas"
on public.bets for update
to anon
using (true)
with check (true);

create policy "La banda puede borrar apuestas"
on public.bets for delete
to anon
using (true);
