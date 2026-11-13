# Popoly: Tech Dominion

Hardcore Big Tech economic strategy (local / LAN).

## Quick start (dev)

```bash
npm install
npm run dev
```

## Docker (home LAN, no nginx)

Build and run:

```bash
docker compose up --build -d
```

Open on this machine:

```text
http://localhost:3000
```

From phone / tablet on the same Wi‑Fi:

1. Find your PC IP (e.g. `ipconfig` / `hostname -I`)
2. Open `http://<PC-IP>:3000`

Stop:

```bash
docker compose down
```

Rebuild after code changes:

```bash
docker compose up --build -d
```

## Stack

Vite + React 19 + TypeScript + Zustand + Tailwind v4
