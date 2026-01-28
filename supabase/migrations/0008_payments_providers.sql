alter table public.payments alter column stripe_intent_id drop not null;

alter table public.payments drop constraint if exists payments_status_check;

alter table public.payments add column if not exists provider text not null default 'stripe';
alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists method text;

create unique index if not exists payments_provider_payment_id_unique_idx
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

