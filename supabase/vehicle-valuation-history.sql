-- Run once in Supabase to store Canadian vehicle value snapshots over time.

create table if not exists public.vehicle_valuation_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value_cents bigint not null check (value_cents > 0),
  low_value_cents bigint check (low_value_cents is null or low_value_cents > 0),
  high_value_cents bigint check (high_value_cents is null or high_value_cents > 0),
  currency text not null default 'CAD' check (currency = 'CAD'),
  source text not null default 'Member update',
  source_type text not null default 'manual' check (source_type in ('provider', 'appraisal', 'manual', 'estimated')),
  note text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (low_value_cents is null or high_value_cents is null or low_value_cents <= high_value_cents)
);

create index if not exists vehicle_valuation_history_vehicle_date_idx
  on public.vehicle_valuation_history (vehicle_id, observed_at);

alter table public.vehicle_valuation_history enable row level security;

drop policy if exists "Members can read own vehicle valuations" on public.vehicle_valuation_history;
drop policy if exists "Members can insert own vehicle valuations" on public.vehicle_valuation_history;

create policy "Members can read own vehicle valuations"
  on public.vehicle_valuation_history for select
  using (auth.uid() = user_id and public.has_active_membership());

create policy "Members can insert own vehicle valuations"
  on public.vehicle_valuation_history for insert
  with check (
    auth.uid() = user_id
    and public.has_active_membership()
    and exists (
      select 1 from public.vehicles
      where vehicles.id = vehicle_id and vehicles.user_id = auth.uid()
    )
  );

-- Turn each existing Garage market value into the first recorded snapshot.
insert into public.vehicle_valuation_history (
  vehicle_id,
  user_id,
  value_cents,
  currency,
  source,
  source_type,
  note,
  observed_at
)
select
  vehicles.id,
  vehicles.user_id,
  (regexp_replace(vehicles.market_value, '[^0-9.]', '', 'g')::numeric * 100)::bigint,
  'CAD',
  'Existing Garage value',
  case when lower(vehicles.market_value) like '%estimated%' then 'estimated' else 'manual' end,
  'Imported when Canadian valuation history was enabled.',
  coalesce(vehicles.updated_at, now())
from public.vehicles
where nullif(regexp_replace(vehicles.market_value, '[^0-9.]', '', 'g'), '') is not null
  and (regexp_replace(vehicles.market_value, '[^0-9.]', '', 'g')::numeric > 0)
  and not exists (
    select 1
    from public.vehicle_valuation_history history
    where history.vehicle_id = vehicles.id
  );
