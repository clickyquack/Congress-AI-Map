# Congress map on politicalwillai.org

The map app lives in **[Congress AI Map](https://github.com/clickyquack/Congress-AI-Map)**. It is **not** deployed from that repo anymore.

**[political-will-ai](https://github.com/clickyquack/political-will-ai)** builds a copy into `public/congress-map/` and publishes it at:

**https://www.politicalwillai.org/congress-map/**

## Update the live map

1. Push changes to Congress AI Map `main` (data, UI, etc.).
2. Trigger a rebuild of the main site—either push anything to political-will-ai `main`, or run **Deploy to GitHub Pages** manually on political-will-ai.

CI checks out `clickyquack/Congress-AI-Map` at the latest `main` on each site deploy. No PAT or cross-repo secret is required.

## Local build (political-will-ai)

With both repos as siblings (`../Congress AI Map`):

```bash
cd political-will-ai
npm run build:congress-map   # only the map → public/congress-map/
npm run build                # map + Astro site
```

Or set an explicit path:

```bash
CONGRESS_MAP_DIR="C:/Users/you/Documents/GitHub/Congress AI Map" npm run build:congress-map
```

Vite in the map repo uses `base: '/congress-map/'` so asset paths match production.

## Nav link

The site nav entry is in political-will-ai `src/site.ts` (`href: "/congress-map/"`).
