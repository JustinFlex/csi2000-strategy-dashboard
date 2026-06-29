# CSI2000 Hybrid Strategy Dashboard

Website: https://quant002.gofintech.cn/

Vercel serves the static dashboard from the `docs/` output directory.

Public static website snapshot for CSI2000 hybrid strategy follow-up.

This repository intentionally contains only the sanitized published page. The
research notebook, Python reproduction script, model implementation, Tushare
cache, and backtest detail files are kept out of the public repository.

Published content:

- `docs/index.html`
- `docs/data/dashboard.json`
- `docs/favicon.svg`
- `vercel.json`

The page is data-driven. Future public updates should regenerate and replace the
sanitized `docs/data/dashboard.json` snapshot and push the site again; no raw
research cache or notebook is required in the public repository.

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

1. Regenerate the sanitized dashboard payload locally with the private hybrid
   strategy reproduction script:
   `python3 scripts/reproduce_hybrid_main_gap_cool2.py`
2. Replace only `docs/data/dashboard.json`, unless the public page layout itself
   needs a deliberate update in `docs/index.html`.
3. Run `git status --ignored -sb` before committing. The local research paths
   `data/`, `outputs/`, `scripts/`, `requirements.txt`, and
   `strategy_dashboard.html` must remain ignored and uncommitted.
4. Commit and push to `main`; Vercel will redeploy automatically from `docs/`.

Do not add a root `index.html`, `.nojekyll`, GitHub Pages settings, raw cache
files, notebooks, model scripts, holdings, signal details, or backtest details
to this public repository.

Current snapshot uses market data through `2026-06-25`.
