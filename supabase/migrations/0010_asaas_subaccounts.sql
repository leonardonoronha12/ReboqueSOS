alter table public.tow_partners add column if not exists asaas_account_id text;
alter table public.tow_partners add column if not exists asaas_wallet_id text;
alter table public.tow_partners add column if not exists asaas_api_key text;
alter table public.tow_partners add column if not exists asaas_income_value numeric;

