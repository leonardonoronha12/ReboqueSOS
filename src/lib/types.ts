export type UserRole = "cliente" | "reboque" | "admin";

export type TowRequestStatus =
  | "PENDENTE"
  | "PROPOSTA_RECEBIDA"
  | "ACEITO"
  | "A_CAMINHO"
  | "CHEGUEI"
  | "EM_SERVICO"
  | "CONCLUIDO"
  | "PAGO"
  | "CANCELADO";

export type TowTripStatus =
  | "a_caminho"
  | "chegou"
  | "em_servico"
  | "concluido"
  | "finalizado"
  | "cancelado";
