alter table public.tow_partners add column if not exists mp_user_id text;
alter table public.tow_partners add column if not exists mp_access_token text;
alter table public.tow_partners add column if not exists mp_refresh_token text;
alter table public.tow_partners add column if not exists mp_token_expires_at timestamptz;

