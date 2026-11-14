# Popoly: Tech Dominion

Hardcore Big Tech economic strategy (local / LAN).

## Play from Docker (recommended)

Image is built automatically on every push to `main` and published to GitHub Container Registry:

```text
ghcr.io/skrskr7799-design/popoly:latest
```

### First time

1. If the package is **private**, log in once:

```bash
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Create a token at GitHub → Settings → Developer settings → Personal access tokens  
(classic: `read:packages`, or fine-grained: Packages read).

If you make the package **Public** (GitHub → Packages → popoly → Package settings → Change visibility), login is not required to pull.

2. Start:

```bash
docker compose pull
docker compose up -d
```

3. Open:

- This PC: **http://localhost:3847**
- Phone / tablet (same Wi‑Fi): **http://&lt;PC-IP&gt;:3847**

### Update after you push code to GitHub

Wait ~1–3 minutes for Actions to finish, then:

```bash
docker compose pull
docker compose up -d
```

Stop:

```bash
docker compose down
```

### Build only on this machine (no GHCR)

```bash
docker compose up --build -d
```

(Uncomment `build: .` in `docker-compose.yml` if you prefer local builds always.)

## Dev without Docker

```bash
npm install
npm run dev
```

## Ports

| Where | Port |
|--------|------|
| Host (your PC / LAN) | **3847** |
| Inside container | 3000 |

## Stack

Vite + React 19 + TypeScript + Zustand + Tailwind v4
