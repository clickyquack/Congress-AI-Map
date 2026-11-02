# Deploy at politicalwillai.org/congress-map

The map lives in **[Congress AI Map](https://github.com/clickyquack/Congress-AI-Map)**. Built files are pushed into **[political-will-ai](https://github.com/clickyquack/political-will-ai)** at `public/congress-map/`.

The main site is Astro with GitHub Pages from **Actions** (not raw `main`). Astro copies everything under `public/` into the published `dist/`, so the map is served at:

**https://www.politicalwillai.org/congress-map/**

(Use the same path on the apex domain if DNS redirects `politicalwillai.org` → `www`.)

Each map deploy commits to `main` on political-will-ai, which **re-runs that repo’s deploy workflow** and republishes the full site including the updated map.

## One-time setup (Congress AI Map repo)

1. Create a [fine-grained personal access token](https://github.com/settings/tokens?type=beta) with **Contents: Read and write** on **only** `clickyquack/political-will-ai`.
2. In **Congress AI Map** → **Settings → Secrets and variables → Actions**, add:
   - Name: `POLITICAL_WILL_AI_DEPLOY_TOKEN`
   - Value: the token
3. Push to `main` on Congress AI Map (or run **Deploy to politicalwillai.org** manually under Actions).

The workflow replaces only `public/congress-map/`; Astro source and the rest of `public/` are untouched.

## Link from the main site (political-will-ai)

Add a nav entry in `src/site.ts`, for example under Resources:

```ts
{
  id: "congress-map",
  href: "/congress-map/",
  label: "Congress AI map",
},
```

Use a root-absolute `href` (not `sitePath(...)`) so the link targets the static app, not an Astro route.

## Local dev (Congress AI Map)

Vite `base` is `/congress-map/`:

```bash
npm run dev
npm run build && npm run preview
```

Preview URLs include the `/congress-map/` prefix, matching production.
