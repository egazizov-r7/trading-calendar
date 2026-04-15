# Trading Calendar

A web application for visualizing trading results as an interactive calendar with an optional analytics timeline view. Reads data from Google Sheets via a server-side API proxy.

---

## Features

- Calendar view with green/red gradient-colored day cells based on PnL intensity
- Per-day metrics: PnL in dollars, percentage return, trade count
- Portfolio balance display
- Timeline view with SVG line charts and month summary cards
- Timeline view can be disabled via environment variable
- Customizable column mapping — connect spreadsheets with different header schemas
- Customizable timeline layout — configure which charts and metric cards appear
- Mobile responsive: list and grid modes on small screens
- Demo mode when no data source is configured
- Auto-refresh every 5 minutes

---

## Quick Start

### Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your Google Sheets credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without credentials, the app runs in demo mode.

### Docker

```bash
cp .env.example stack.env
# Edit stack.env with your credentials
docker compose up --build
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Yes | `./service-account.json` | Path to Google Service Account JSON key |
| `GOOGLE_SHEET_ID` | Yes | — | Sheet ID from the spreadsheet URL |
| `GOOGLE_SHEET_NAME` | No | `Sheet1` | Worksheet tab name |
| `GOOGLE_SHEET_RANGE` | No | `A:BF` | Column range to read |
| `DEPOSIT` | No | `250000` | Fallback deposit for % calculation (USD) |
| `COLUMN_MAPPING_PATH` | No | `./column-mapping.json` | Path to column mapping config |
| `TIMELINE_CONFIG_PATH` | No | `./timeline-config.json` | Path to timeline layout config |
| `NEXT_PUBLIC_ENABLE_TIMELINE` | No | `true` | Set to `false` to hide the Timeline view |

---

## Column Mapping

The app uses a JSON file to map internal field names to your spreadsheet's column headers. This allows connecting spreadsheets with different schemas.

Default mapping file: `column-mapping.json`

```json
{
  "date_time": "your_date_column",
  "net_credit": "your_pnl_column",
  "balance": "your_balance_column",
  ...
}
```

- **Left side** — internal field name (fixed, what the app expects)
- **Right side** — your spreadsheet's actual column header

Only `date_time` and `net_credit` are required. All other fields are optional — missing columns default to `0` or empty string. See `column-mapping.json` for all available fields.

To use a different spreadsheet schema, create a new mapping file and set `COLUMN_MAPPING_PATH`:

```bash
COLUMN_MAPPING_PATH=./my-custom-mapping.json
```

---

## Timeline Configuration

The timeline view layout is defined in `timeline-config.json`. You can customize which charts and metric cards appear.

```json
{
  "charts": [
    {
      "title": "Portfolio & PnL",
      "series": [
        { "key": "balance", "label": "Balance", "color": "#60a5fa", "unit": "$" }
      ]
    }
  ],
  "cards": [
    {
      "title": "Month Summary",
      "items": [
        { "label": "Total Commission", "key": "commission", "type": "sum", "prefix": "$", "decimals": 2 },
        { "label": "Market Bias", "key": "bias", "type": "bias" },
        { "label": "Vol Decision", "key": "volDecision", "type": "decision" }
      ]
    }
  ]
}
```

Card types: `avg` (average non-zero values), `sum` (total), `last` (last non-empty string), `decision` (TRADE/NO TRADE count), `bias` (colored bullish/bearish text).

Optional card properties: `decimals` (default 0), `prefix` (e.g. `"$"`), `color` (hex).

To use a custom config: `TIMELINE_CONFIG_PATH=./my-timeline.json`

---

## Testing

Unit tests cover all pure utility functions: parsing, formatting, color logic, data aggregation, timeline helpers, and config file validation.

```bash
# Run tests once
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch
```

---

## Tech Stack

Next.js 14 (App Router) · TypeScript · CSS Modules · Pure SVG charts · Google Sheets API · Vitest · Docker (`node:20-alpine`)

---

## Project Structure

```
trading-calendar/
├── app/
│   ├── api/trades/route.ts          # API proxy — Google Sheets → aggregated JSON
│   ├── page.tsx                     # Root page
│   ├── layout.tsx                   # Root layout
│   └── globals.css                  # Base styles, font imports
├── components/
│   ├── TradingCalendar.tsx          # Main client component — calendar + view switching
│   ├── TradingCalendar.module.css   # Calendar styles
│   ├── TimelineChart.tsx            # Timeline view — SVG charts + metric cards
│   └── TimelineChart.module.css     # Timeline styles
├── lib/
│   ├── utils.ts                     # Shared pure functions (parsing, formatting, aggregation)
│   └── __tests__/utils.test.ts      # Unit tests (75 tests)
├── column-mapping.json              # Default column name mapping
├── timeline-config.json             # Timeline charts & cards layout config
├── Dockerfile                       # Multi-stage production build
├── docker-compose.yml               # Docker orchestration
└── .env.example                     # Environment variable template
```

---

## Docker Commands

| Action | Command |
|---|---|
| Build & run | `docker compose up --build` |
| Background | `docker compose up -d --build` |
| Stop | `docker compose down` |
| Logs | `docker compose logs -f` |
| Rebuild | `docker compose up --build --force-recreate` |

---

## License

MIT
