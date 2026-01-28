alter table public.tow_ratings alter column cliente_id drop not null;
alter table public.tow_ratings drop constraint if exists tow_ratings_cliente_id_fkey;
alter table public.tow_ratings
  add constraint tow_ratings_cliente_id_fkey
  foreign key (cliente_id) references public.users (id) on delete set null;

alter table public.tow_ratings add column if not exists driver_id uuid references public.users (id) on delete restrict;

