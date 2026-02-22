# v1.0.0

First public release of **Jike Web Exporter**.

## Highlights

- Export personal Jike timeline data from `web.okjike.com`.
- Generate both `JSON` and `CSV` outputs.
- Works with a resilient extraction pipeline (network, state snapshots, DOM fallback).
- Includes bilingual docs (`README.md`, `README.zh-CN.md`).

## How to use

1. Open `https://web.okjike.com/me` and login.
2. Open browser devtools Console.
3. Paste `jike-export.js` and run.
4. Wait for `jike-export-*.json` and `jike-export-*.csv` downloads.

## Notes

- Data stays on your local browser session.
- Please review and redact exported data before sharing publicly.
