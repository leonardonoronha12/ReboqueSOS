alter table public.tow_requests alter column cliente_id drop not null;
alter table public.tow_requests drop constraint if exists tow_requests_cliente_id_fkey;
alter table public.tow_requests
  add constraint tow_requests_cliente_id_fkey
  foreign key (cliente_id) references public.users (id) on delete set null;

alter table public.tow_requests add column if not exists cliente_nome text;

