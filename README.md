# CSI2000 Strategy Dashboard

Vercel serves the static dashboard from the `docs/` output directory.

Public static website snapshot for strategy follow-up.

This repository intentionally contains only the sanitized published page. The
research notebook, Python reproduction script, model implementation, Tushare
cache, and backtest detail files are kept out of the public repository.

Published content:

- `docs/index.html`
- `docs/data/dashboard.json`

The page is data-driven. Future public updates should replace the sanitized
`docs/data/dashboard.json` snapshot and push the site again; no research code or
raw data is required in the public repository.

Current snapshot uses market data through `2026-05-26`.
