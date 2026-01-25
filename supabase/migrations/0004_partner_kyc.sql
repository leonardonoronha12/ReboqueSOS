alter table public.tow_partners add column if not exists cpf text;
alter table public.tow_partners add column if not exists caminhao_modelo text;
alter table public.tow_partners add column if not exists caminhao_placa text;
alter table public.tow_partners add column if not exists caminhao_tipo text;
alter table public.tow_partners add column if not exists foto_parceiro_path text;
alter table public.tow_partners add column if not exists foto_caminhao_path text;

create unique index if not exists tow_partners_cpf_unique_idx on public.tow_partners (cpf) where cpf is not null;

drop policy if exists partners_select_public on public.tow_partners;
create policy partners_select_public on public.tow_partners
for select
to authenticated
using (public.is_admin() or id = auth.uid());

