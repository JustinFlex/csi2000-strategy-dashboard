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

1. Regenerate the sanitized dashboard payload locally with the private
   entry-close reference publisher:
   `.venv/bin/python scripts/build_entry_close_dashboard.py`
   The daily updater uses this same entry point. The legacy reproduction script
   is retained for research and is no longer the public snapshot generator.
2. Replace only `docs/data/dashboard.json`, unless the public page layout itself
   needs a deliberate update in `docs/index.html`.
3. Run `git status --ignored -sb` before committing. The local research paths
   `data/`, `outputs/`, `scripts/`, `requirements.txt`, and
   `strategy_dashboard.html` must remain ignored and uncommitted.
4. Commit and push to `main`; Vercel will redeploy automatically from `docs/`.

Do not add a root `index.html`, `.nojekyll`, GitHub Pages settings, raw cache
files, notebooks, model scripts, holdings, signal details, or backtest details
to this public repository.

The displayed backtest is the archived **entry-close, all-holiday-gap** version
through `2026-09-22`: 159531 ETF annualized return **38.31%**, maximum drawdown
**4.30%**, Calmar **8.90**, and 87 completed trades. The index uses the corrected
signal-availability calculation (22.35% annualized). Metrics, component rows,
equity curves, and historical trades share this fixed reference period and
include idle trading days. Daily market candles and the entry-close observation
calendar continue to refresh separately; the page labels both dates.

The current market snapshot is through `2026-09-23`. Performance assumes fills
at historical open/close prices; after-close execution remains unverified.

## Local shared market store

The Mac research scripts now read and update market files in
`../stock_data/market/csi2000/` through `scripts/market_storage.py`.
The shared provider client lives in `../stock_data/stockdata/client.py`.
Project-local market caches and automatic BigFall/Windows fallback paths have
been removed. See the local `MACOS_SETUP.md` for update commands.

Important research records are versioned in a separate local Git repository at
`research/`, without a remote. Its results, frozen inputs, reproduction code, and
verification receipts remain excluded from this public repository.
