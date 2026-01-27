alter table public.tow_requests drop constraint if exists tow_requests_status_check;
alter table public.tow_requests
  add constraint tow_requests_status_check
  check (status in ('PENDENTE', 'PROPOSTA_RECEBIDA', 'ACEITO', 'A_CAMINHO', 'CHEGUEI', 'EM_SERVICO', 'CONCLUIDO', 'PAGO', 'CANCELADO'));

alter table public.tow_trips drop constraint if exists tow_trips_status_check;
alter table public.tow_trips
  add constraint tow_trips_status_check
  check (status in ('a_caminho', 'chegou', 'em_servico', 'concluido', 'finalizado', 'cancelado'));

alter table public.tow_trips add column if not exists canceled_at timestamptz;
alter table public.tow_trips add column if not exists canceled_by_role text;
alter table public.tow_trips add column if not exists canceled_fee_cents int not null default 0;
alter table public.tow_trips add column if not exists canceled_after_seconds int not null default 0;

