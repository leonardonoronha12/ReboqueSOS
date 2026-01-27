alter table public.tow_requests add column if not exists destino_local text;
alter table public.tow_requests add column if not exists destino_lat double precision;
alter table public.tow_requests add column if not exists destino_lng double precision;

