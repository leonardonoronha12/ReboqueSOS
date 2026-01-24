ReboqueSOS — app para solicitar reboque, receber propostas e acompanhar em tempo real.

## Getting Started

1) Instale as dependências:

```bash
npm install
```

2) Crie o arquivo `.env.local` a partir do `.env.example`:

```bash
copy .env.example .env.local
```

3) Rode o servidor:

```bash
npm run dev -- --port 3000
```

Abra http://localhost:3000

## Setup (Supabase + Google Maps)

- Supabase: preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
- Google Maps: preencha `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` e habilite no Google Cloud:
  - Maps JavaScript API
  - Geocoding API

Tela de setup local:
- http://localhost:3000/setup

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1) Suba o repositório para o GitHub.
2) Na Vercel, clique em “Add New → Project” e importe o repositório.
3) Em “Environment Variables”, configure (pelo menos):
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
