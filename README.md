# Disc Golf Manager & Caddie

Mobile-first disc golf practice, inventory, analytics, and future round/caddie application. The shipped
client is React + Vite with Supabase, an offline-first repository transition, PWA installation, and a
Capacitor-ready path to iOS and Android.

## Start here

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Required local variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never commit `.env` or
service-role/API secrets.

## Documentation map

- [AGENTS.md](AGENTS.md) — mandatory architecture and Codex working rules.
- [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) — current product sequence and deferrals.
- [PHASE_A_ARCHITECTURE.md](PHASE_A_ARCHITECTURE.md) — approved shared contracts.
- [SCREEN_SPECS.md](SCREEN_SPECS.md) — screen integration authority.
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — implementation tracks and dependencies.
- [FEATURE_BACKLOG.md](FEATURE_BACKLOG.md) — status ledger; rejected ideas remain recorded.
- [docs/README.md](docs/README.md) — engineering, operations, mobile, and decision records.
- [CONTRIBUTING.md](CONTRIBUTING.md) — branch, review, verification, and release workflow.
- [SECURITY.md](SECURITY.md) — security and vulnerability handling.
- [DEVLOG.md](DEVLOG.md) — detailed engineering history; newest first.

## Verification

```powershell
npm test
npm run lint
npm run build
git diff --check
```

Vercel deploys the Vite `dist` output. Production pushes are gated by the workflow in
`CONTRIBUTING.md`; direct pushes to `main` are reserved for explicitly approved low-risk maintenance.
