import { DemoRequestDetailsClient } from "./demoRequestDetailsClient";

export default function DemoRequestPage() {
  const now = new Date();
  return (
    <DemoRequestDetailsClient
      requestId="demo"
      initialRequest={{
        id: "demo-12345678",
        local_cliente: "Av. Roberto Silveira, 123 • Icaraí",
        cidade: "Niterói",
        status: "PROPOSTAS",
        accepted_proposal_id: null,
        created_at: now.toISOString(),
      }}
      initialProposals={[
        {
          id: "prop-1",
          partner_id: "partner-1",
          valor: 180,
          eta_minutes: 18,
          accepted: false,
          created_at: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
        },
        {
          id: "prop-2",
          partner_id: "partner-2",
          valor: 160,
          eta_minutes: 25,
          accepted: true,
          created_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        },
      ]}
      initialTrip={{ id: "trip-demo", status: "a_caminho" }}
    />
  );
}

