# CSI2000 Strategy Dashboard

Vercel serves the static dashboard from the `docs/` output directory.

Public static website snapshot for strategy follow-up.

This repository intentionally contains only the sanitized published page. The
research notebook, Python reproduction script, model implementation, Tushare
cache, and backtest detail files are kept out of the public repository.

Published content:

- `docs/index.html`
- `docs/data/dashboard.json`
- `vercel.json`

The page is data-driven. Future public updates should replace the sanitized
`docs/data/dashboard.json` snapshot and push the site again; no research code or
raw data is required in the public repository.

## Deployment and Update Path

This repository is published through Vercel only. GitHub Pages is intentionally
disabled and should not be re-enabled.

Vercel configuration:

- Branch: `main`
- Framework preset: Other / static
- Build command: none
- Output directory: `docs`
- Config file: `vercel.json`

Update workflow:

1. Regenerate the sanitized dashboard payload locally.
2. Replace only `docs/data/dashboard.json`, unless the public page layout itself
   needs a deliberate update in `docs/index.html`.
3. Run `git status --ignored -sb` before committing. The local research paths
   `data/`, `outputs/`, `scripts/`, `requirements.txt`, and
   `strategy_dashboard.html` must remain ignored and uncommitted.
4. Commit and push to `main`; Vercel will redeploy automatically from `docs/`.

Do not add a root `index.html`, `.nojekyll`, GitHub Pages settings, raw cache
files, notebooks, model scripts, holdings, signal details, or backtest details
to this public repository.

Current snapshot uses market data through `2026-05-26`.
