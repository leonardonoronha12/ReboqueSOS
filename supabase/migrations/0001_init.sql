create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  telefone text,
  role text not null check (role in ('cliente', 'reboque', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tow_partners (
  id uuid primary key references public.users (id) on delete cascade,
  empresa_nome text not null,
  cidade text not null,
  lat double precision,
  lng double precision,
  whatsapp_number text,
  ativo boolean not null default true,
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tow_requests (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.users (id) on delete restrict,
  local_cliente text not null,
  cidade text not null,
  lat double precision not null,
  lng double precision not null,
  telefone_cliente text,
  modelo_veiculo text,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'PROPOSTA_RECEBIDA', 'ACEITO', 'A_CAMINHO', 'CHEGUEI', 'EM_SERVICO', 'CONCLUIDO', 'PAGO')),
  accepted_proposal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tow_requests_cidade_created_at_idx on public.tow_requests (cidade, created_at desc);

create table if not exists public.tow_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.tow_requests (id) on delete cascade,
  partner_id uuid not null references public.tow_partners (id) on delete cascade,
  valor numeric(10,2) not null check (valor > 0),
  eta_minutes int not null check (eta_minutes > 0),
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, partner_id)
);

create index if not exists tow_proposals_request_id_created_at_idx on public.tow_proposals (request_id, created_at desc);

alter table public.tow_requests
  add constraint tow_requests_accepted_proposal_fk
  foreign key (accepted_proposal_id) references public.tow_proposals (id) on delete set null;

create table if not exists public.tow_trips (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.tow_requests (id) on delete cascade,
  driver_id uuid not null references public.tow_partners (id) on delete restrict,
  status text not null default 'a_caminho' check (status in ('a_caminho', 'chegou', 'em_servico', 'concluido', 'finalizado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tow_live_location (
  trip_id uuid primary key references public.tow_trips (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.tow_requests (id) on delete cascade,
  stripe_intent_id text not null,
  amount int not null check (amount > 0),
  currency text not null default 'brl',
  status text not null check (status in ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded')),
  platform_fee_amount int not null default 0,
  driver_amount int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tow_ratings (
  request_id uuid primary key references public.tow_requests (id) on delete cascade,
  cliente_id uuid not null references public.users (id) on delete restrict,
  driver_id uuid not null references public.tow_partners (id) on delete restrict,
  rating int not null check (rating between 1 and 5),
  comentario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.tow_partners enable row level security;
alter table public.tow_requests enable row level security;
alter table public.tow_proposals enable row level security;
alter table public.tow_trips enable row level security;
alter table public.tow_live_location enable row level security;
alter table public.payments enable row level security;
alter table public.tow_ratings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

create policy users_select_self on public.users
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy users_update_self on public.users
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy partners_select_public on public.tow_partners
for select
to authenticated
using (ativo = true or public.is_admin() or id = auth.uid());

create policy partners_update_self on public.tow_partners
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy requests_insert_self on public.tow_requests
for insert
to authenticated
with check (cliente_id = auth.uid());

create policy requests_select_client_or_partner_city on public.tow_requests
for select
to authenticated
using (
  public.is_admin()
  or cliente_id = auth.uid()
  or exists (
    select 1
    from public.tow_partners tp
    where tp.id = auth.uid()
      and tp.ativo = true
      and tp.cidade = tow_requests.cidade
  )
  or exists (
    select 1
    from public.tow_proposals p
    where p.request_id = tow_requests.id
      and p.partner_id = auth.uid()
  )
);

create policy requests_update_client_or_admin on public.tow_requests
for update
to authenticated
using (public.is_admin() or cliente_id = auth.uid())
with check (public.is_admin() or cliente_id = auth.uid());

create policy proposals_select_client_or_partner on public.tow_proposals
for select
to authenticated
using (
  public.is_admin()
  or partner_id = auth.uid()
  or exists (
    select 1
    from public.tow_requests r
    where r.id = tow_proposals.request_id
      and r.cliente_id = auth.uid()
  )
);

create policy proposals_insert_partner on public.tow_proposals
for insert
to authenticated
with check (partner_id = auth.uid());

create policy proposals_update_partner_or_client on public.tow_proposals
for update
to authenticated
using (
  public.is_admin()
  or partner_id = auth.uid()
  or exists (
    select 1
    from public.tow_requests r
    where r.id = tow_proposals.request_id
      and r.cliente_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or partner_id = auth.uid()
  or exists (
    select 1
    from public.tow_requests r
    where r.id = tow_proposals.request_id
      and r.cliente_id = auth.uid()
  )
);

create policy trips_select_client_or_driver on public.tow_trips
for select
to authenticated
using (
  public.is_admin()
  or driver_id = auth.uid()
  or exists (
    select 1
    from public.tow_requests r
    where r.id = tow_trips.request_id
      and r.cliente_id = auth.uid()
  )
);

create policy trips_update_driver_or_admin on public.tow_trips
for update
to authenticated
using (public.is_admin() or driver_id = auth.uid())
with check (public.is_admin() or driver_id = auth.uid());

create policy live_location_select_client_or_driver on public.tow_live_location
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.tow_trips t
    where t.id = tow_live_location.trip_id
      and t.driver_id = auth.uid()
  )
  or exists (
    select 1
    from public.tow_trips t
    join public.tow_requests r on r.id = t.request_id
    where t.id = tow_live_location.trip_id
      and r.cliente_id = auth.uid()
  )
);

create policy live_location_upsert_driver on public.tow_live_location
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.tow_trips t
    where t.id = tow_live_location.trip_id
      and t.driver_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.tow_trips t
    where t.id = tow_live_location.trip_id
      and t.driver_id = auth.uid()
  )
);

create policy payments_select_client_or_driver on public.payments
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.tow_requests r
    where r.id = payments.request_id
      and r.cliente_id = auth.uid()
  )
  or exists (
    select 1
    from public.tow_trips t
    join public.tow_requests r on r.id = t.request_id
    where r.id = payments.request_id
      and t.driver_id = auth.uid()
  )
);

create policy ratings_select_client_or_driver on public.tow_ratings
for select
to authenticated
using (
  public.is_admin()
  or cliente_id = auth.uid()
  or driver_id = auth.uid()
);

create policy ratings_insert_client on public.tow_ratings
for insert
to authenticated
with check (cliente_id = auth.uid() or public.is_admin());

create policy ratings_update_client on public.tow_ratings
for update
to authenticated
using (cliente_id = auth.uid() or public.is_admin())
with check (cliente_id = auth.uid() or public.is_admin());

alter publication supabase_realtime add table public.tow_proposals;
alter publication supabase_realtime add table public.tow_trips;
alter publication supabase_realtime add table public.tow_live_location;

