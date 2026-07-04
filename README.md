# Disc Golf Manager & Caddie

React + Vite SPA. See `CLAUDE.md` for architecture, `DEVELOPMENT_PLAN.md` for the execution plan, `DEVLOG.md` for build history, `FEATURE_BACKLOG.md` for feature status.

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`, `npm test`.

## Deploying (Vercel)

1. Push this repo to GitHub and connect it in the Vercel dashboard (auto-deploy on push to `main`).
2. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (Vercel's Vite preset sets these automatically).
3. In **Project Settings → Environment Variables**, set for Production/Preview/Development:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   Same values as your local `.env` — the Supabase anon key is meant to be public client-side (protected by RLS), so this is safe to set directly in the dashboard.
4. `vercel.json` already rewrites all paths to `index.html` so client-side routes (e.g. `/practice/history`) work on a hard refresh or direct link.

The app is a PWA (`vite-plugin-pwa`): manifest + a service worker that precaches the built app shell only. It installs to a phone home screen, but does not cache Supabase data — that's still fully live/online (offline data buffering is a separate, later feature).
