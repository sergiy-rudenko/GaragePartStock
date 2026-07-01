# DEPLOYMENT.md

How GaragePartStock gets from local dev to publicly reachable — and the guardrails
that keep it safe.

## The golden rule

**Do not expose the app publicly until auth Stage 3 (ownership enforcement) is done
and verified.** Before Stage 3, anyone who reaches the URL has full access to all
data. Stage 3 is now complete (see AUTH_PLAN.md), so this guardrail is satisfied —
but it stays here as the reason the sequence is ordered the way it is.

## The go-live sequence (in strict order)

Each step depends on the one before it.

1. **Auth Stages 1–4 + admin** — DONE. Makes it safe to be reached.
2. **Deploy the app into the k8s cluster** — the Cloudflare Tunnel points at the
   cluster ingress, so the app must actually run there first. (Next build.)
3. **Buy a domain** — safe to do anytime; owning a name exposes nothing. Cloudflare
   Registrar recommended (at-cost, same dashboard as the tunnel).
4. **Flip cookie `secure: true`** — the session cookie is `secure: false` for local
   HTTP. Behind HTTPS it MUST be `true`. Hard checklist item.
5. **Cloudflare Tunnel live** — point the tunnel at the ingress, go public.

## Current environment facts

- **Server:** `192.168.0.117` (sergoserver), Ubuntu 22.04, kubeadm cluster.
- **Container runtime:** containerd 2.2.2 — locally built images must be imported into
  containerd's `k8s.io` namespace (a plain `docker build` won't be visible to the
  kubelet). Use `nerdctl` (builds straight into the k8s namespace) or
  `docker build` + `ctr -n k8s.io images import`. Manifests use
  `imagePullPolicy: IfNotPresent`.
- **Ingress:** ingress-nginx already running.
- **Storage:** local-path-provisioner available; media stack uses hostPath under
  `/srv/media`. Our app uses hostPath under `/srv/garagepartstock`.
- **Dev laptop LAN IP:** `192.168.0.158` (wlp191s0). Note a VPN (`vpn0`) is present and
  can interfere with LAN reachability from the phone.

## Media stack — no interference

The app lives in its own `garagepartstock` namespace. The media stack is in `media`.
Namespaces isolate resources, DNS, and kubectl scope. Key difference from the media
apps: **Postgres does NOT use `hostNetwork: true`** (the *arr apps do). The DB stays
cluster-internal on a ClusterIP service — no host port taken, no collision with any
media port, better isolation. Only shared resources are the physical server and the
k8s control plane, same as every other namespace already running there.

## Planned cluster layout (namespace: garagepartstock)

- **postgres** — Deployment + ClusterIP Service, hostPath `/srv/garagepartstock/postgres`,
  password in a Secret, internal-only. Recreate strategy.
- **backend** — Deployment + Service; `DATABASE_URL` → `postgres:5432` (in-cluster DNS);
  uploads on hostPath `/srv/garagepartstock/uploads`; `SESSION_SECRET` from a Secret.
- **frontend** — Deployment + Service; nginx serving the built SPA, proxying `/api`
  and `/uploads` to the backend service.
- **ingress** — one host (e.g. `garage.<domain>`) via ingress-nginx.

Dockerfiles (server, client) and `k8s/garagepartstock.yaml` were drafted earlier and
live in the repo.

## Local dev (current working setup)

- DB: `docker compose` in `database/` (postgres:16, user/pw carparts, db car_parts,
  port 5432). Schema auto-loads on a fresh volume via
  `/docker-entrypoint-initdb.d`; reload manually with
  `docker exec -i garagepartstock-db psql -U carparts -d car_parts < server/schema.sql`.
- `server/.env`: `DATABASE_URL=postgresql://carparts:carparts@localhost:5432/car_parts`,
  `PORT=4000`, `CORS_ORIGIN` allow-list (never wildcard with credentials),
  `SESSION_SECRET=...`.
- Run: `cd server && npm run dev` and `cd client && npm run dev`.

## Phone access on the LAN (private, no domain)

- `cd client && npm run dev -- --host` → serves on `192.168.0.158:5173`.
- `CORS_ORIGIN` must include the phone origin; restart backend.
- Camera/barcode (getUserMedia) will NOT work over plain HTTP from the phone — only
  https or localhost. HTTPS via the tunnel fixes this permanently.
- If the phone can't connect: disconnect the laptop VPN first, then check firewall
  (`sudo ufw allow 5173`), then confirm same Wi-Fi.

## Backups

Before any migration or risky change:
`docker exec garagepartstock-db pg_dump -U carparts car_parts > ~/garagepartstock-backup-$(date +%F).sql`