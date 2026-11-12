# Deploying Nakili

Nakili is a static Vite build (`dist/`). There is no server component and no
database to provision — hosting is just HTTPS + those files.

## Current state

Three instances are live:

| Instance | URL | Lifetime |
|---|---|---|
| **Public (durable)** | `https://longlivesam.github.io/nakili/` | permanent, deployed by GitHub Actions |
| Local production build | `http://127.0.0.1:4173` | while the server process runs |
| Public HTTPS quick tunnel | `https://icons-chemical-diana-cst.trycloudflare.com` | while the `cloudflared` process runs |

The GitHub Pages site is the canonical URL. Every push to `main` runs the
tests, builds with the `/nakili/` base path and publishes. The quick tunnel is
only a scratch instance for trying uncommitted builds on a phone; its URL
changes whenever it restarts.

`scripts/live.sh` rebuilds, serves `dist/` locally and starts a fresh quick
tunnel in one step:

```bash
./scripts/live.sh
```

Without a tunnel:

```bash
npm run build
python3 -m http.server 4173 --directory dist
```

`localhost` counts as a secure context, so the microphone and Web Speech API
work there. Opening the same build over a plain-HTTP LAN address does **not**
work — browsers block `getUserMedia` outside HTTPS/localhost.

A durable public URL requires an account or credentials that are not on this
machine (see [What is still missing](#what-is-still-missing)).

## GitHub Pages (live)

`.github/workflows/deploy-pages.yml` runs the tests, builds with the correct
subpath, and publishes on every push to `main`.

The repository is `LongLiveSam/nakili`; Pages is enabled with
**Source: GitHub Actions**, so the site is at:

```
https://longlivesam.github.io/nakili/
```

The workflow detects the `<you>.github.io` user-site case and builds for the
domain root instead.

`vite.config.ts` reads `VITE_BASE`; the workflow passes `/<repo>/`
automatically, and `index.html`, the service worker and the manifest all honour
it.

To deploy a change:

```bash
git push github main
```

To watch the run:

```bash
gh run watch
```

## Netlify

```bash
npx netlify-cli login          # opens a browser; needs a Netlify account
npx netlify-cli deploy --prod --dir=dist
```

`netlify.toml` already sets the build command, publish directory and cache
headers. Drag-and-drop of the `dist/` folder onto app.netlify.com works too.

## Vercel

```bash
npx vercel login
npx vercel --prod
```

`vercel.json` supplies the build settings and cache headers.

## Cloudflare Pages

Create a Pages project, connect the repository, and use:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22 (env `NODE_VERSION=22`) |

## Post-deploy checklist

- `https://…/` loads and shows the library screen.
- Chrome/Edge asks for microphone permission on the first recording.
- DevTools → Application → Service Workers: `sw.js` is **activated** and the
  cache is `nakili-v2`.
- DevTools → Application → Manifest: name and icon resolve without 404s.
- Record ~10 seconds, stop, reopen the clip from the editor.
- Reload once with DevTools → Network set to **Offline**: the shell should
  still load from cache.
- If the site is on a subpath, confirm `/favicon.svg`, the manifest and
  `/assets/*` all return 200 (not 404 under the site root).

## Custom domain (optional)

The site is live on the provider subdomain. To use your own domain:

1. Repository → **Settings → Pages → Custom domain**, enter the domain.
2. Add a `CNAME` DNS record pointing at `longlivesam.github.io` (or the apex
   records GitHub prints).
3. Tick **Enforce HTTPS** once the certificate is issued.

No code change is needed; the workflow keeps publishing to the same Pages site.
