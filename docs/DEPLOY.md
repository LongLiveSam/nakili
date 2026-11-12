# Deploying Nakili

Nakili is a static Vite build (`dist/`). There is no server component and no
database to provision — hosting is just HTTPS + those files.

## Current state

Two instances are live right now:

| Instance | URL | Lifetime |
|---|---|---|
| Local production build | `http://127.0.0.1:4173` | while the server process runs |
| Public HTTPS quick tunnel | `https://icons-chemical-diana-cst.trycloudflare.com` | while the `cloudflared` process runs |

The public URL is a **temporary Cloudflare quick tunnel** — no account, no
durable host, and the URL changes every time it restarts. It exists so the app
can be tried on a phone or another machine immediately. For a permanent URL,
use one of the hosts below.

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

## GitHub Pages (workflow included)

`.github/workflows/deploy-pages.yml` runs the tests, builds with the correct
subpath, and publishes on every push to `main`.

One-time setup:

1. Create an empty repository on GitHub (no README, no license).
2. Point the local repo at it and push:

   ```bash
   git remote set-url origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```

3. Repository → **Settings → Pages → Build and deployment → Source**:
   choose **GitHub Actions**.

The app is then at `https://<you>.github.io/<repo>/`. The workflow detects the
`<you>.github.io` user-site case and builds for the domain root instead.

`vite.config.ts` reads `VITE_BASE`; the workflow passes `/<repo>/`
automatically, and `index.html`, the service worker and the manifest all honour
it.

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

## What is still missing

Going public needs **one** of the following, supplied by the account owner:

- A GitHub repository URL plus push access (SSH key or `gh auth login`), for
  the Pages workflow.
- A Netlify, Vercel or Cloudflare account token / interactive login.
- A domain, if it should not live on the provider's subdomain.

Until one exists, the local server and temporary tunnel above are the live
instances. Neither is durable: the tunnel URL changes when the process
restarts, and the local build only exists on this machine.
