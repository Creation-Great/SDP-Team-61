# Peer Review Backend (v1.3.1)

- Postgres schema + RLS + views/MV
- REST: submissions / assign / reviews / me/* / instructor/overview
- /assign supports revive (canceled -> pending)
- MV concurrent refresh (unique index + SECURITY DEFINER)
- RLS write policies integrated

## Quickstart
```bash
docker compose up -d
npm i && cp .env.sample .env
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/peerreview
npm run migrate && npm run seed
npm run dev
```