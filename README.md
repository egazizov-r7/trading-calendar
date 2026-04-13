# Trading Calendar — Technical Specification

> **Version:** 3.0 | **Date:** April 2026
>
> A web application for visualizing SPX Iron Condor trading results as an interactive calendar with a full analytics timeline view. This document covers the architecture, real Google Sheets data structure, technology stack, two main views (Calendar and Timeline), and responsive behavior.

---

## 1. Product Goal

Build a visual analysis tool for SPX Iron Condor strategy results. The application must:

- Display profitable and losing days with gradient color intensity
- Show per-day metrics: PnL in dollars, percentage return on deposit, trade count
- Display current portfolio balance prominently
- Provide a Timeline view with line charts for key market metrics and summary cards for all spreadsheet fields
- Support full desktop, tablet, and mobile layouts
- Read data directly from Google Sheets via a server-side API proxy (API key never exposed to the browser)
- Auto-refresh data every 5 minutes

---

## 2. Technology Stack

### 2.1 Frontend

| Parameter | Value |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | CSS Modules (no Tailwind) — full control over responsive behavior |
| Fonts | Syne (headings/UI) + JetBrains Mono (numbers, dates, PnL) |
| Charts | Pure SVG line charts — no external chart library |
| State | React `useState` / `useEffect` — no external state managers |
| Responsive | 3 breakpoints: >768px / ≤768px / ≤480px (see section 7) |

### 2.2 Backend

| Parameter | Value |
|---|---|
| API Route | Next.js Route Handler — `app/api/trades/route.ts` |
| Proxy role | Hides `GOOGLE_SHEETS_API_KEY` from the browser |
| Caching | `next: { revalidate: 300 }` — ISR cache for 5 minutes |
| Aggregation | Multiple rows per day are summed server-side |
| Column discovery | Header row parsed dynamically — column indices found by name |
| Deployment | Docker (multi-stage build), `node:20-alpine` image |

### 2.3 Environment Variables (`.env`)

| Variable | Example | Description |
|---|---|---|
| `GOOGLE_SHEETS_API_KEY` | `AIzaSy...` | Google Cloud Console API key |
| `GOOGLE_SHEET_ID` | `1BxiMVs0XRA5...` | Sheet ID from the URL |
| `GOOGLE_SHEET_RANGE` | `Sheet1!A:BF` | Data range |
| `DEPOSIT` | `250000` | Fallback deposit for % calculation (USD) |

---

## 3. Data Source and Structure

### 3.1 Real Google Sheets Structure

The spreadsheet contains a full analytics snapshot at the time each position is opened. Each row represents one SPX Iron Condor order. All columns used by the application:

#### Core columns (required)

| Column | Example Value | Usage |
|---|---|---|
| `date_time_ny` | `2026-03-10 09:29:00` | Trading day — parsed as first 10 chars `YYYY-MM-DD` |
| `order_net_credit` | `5,7` | Collected premium — primary PnL proxy |
| `environment_status` | `LIVE` | Filter: only process `LIVE` rows |
| `portfolio_balance` | `250905,74` | Balance — base for % calc and balance display |

#### Order metrics (cards)

| Column | Usage |
|---|---|
| `order_commission` | Summed per day, displayed as total in month summary |
| `order_strategy` | Strategy name (e.g. "Iron Condor") |
| `order_symbol` | Trading symbol (e.g. "SPX") |
| `order_wing_width` | Wing width of the spread |
| `order_max_loss` | Maximum loss on position |
| `order_max_profit` | Maximum profit on position |
| `order_profit_target_dollars` | Target profit in dollars |
| `order_put_short_delta` | Put short strike delta |
| `order_call_short_delta` | Call short strike delta |

#### Volatility metrics

| Column | Usage |
|---|---|
| `volatility_risk_risk_score` | Line chart — vol risk score over time |
| `volatility_risk_risk_threshold` | Card — average threshold for the month |
| `volatility_risk_decision` | Card — TRADE / NO TRADE count |

#### Gamma / GEX metrics

| Column | Usage |
|---|---|
| `gamma_gex_risk_total_gex_billions` | Line chart — total GEX |
| `gamma_gex_risk_spot_price_gex` | Line chart — spot price GEX |
| `gamma_gex_risk_zero_gamma_level` | Line chart — zero gamma level |
| `gamma_gex_risk_decision` | Card — TRADE / NO TRADE count |
| `gamma_gex_risk_strategy` | Card — last strategy value |

#### Market breadth metrics

| Column | Usage |
|---|---|
| `market_breadth_risk_ad_ratio` | Line chart — A/D ratio |
| `market_breadth_risk_pct_above_50ma` | Line chart — % above 50 MA |
| `market_breadth_risk_pct_above_200ma` | Line chart — % above 200 MA |
| `market_breadth_risk_mcclellan` | Line chart — McClellan oscillator |
| `market_breadth_risk_decision` | Card — TRADE / NO TRADE count |

#### Market bias & expected move

| Column | Usage |
|---|---|
| `market_bias_bias` | Card — bullish / bearish / neutral |
| `market_bias_details_trend` | Card — trend direction |
| `market_bias_details_momentum` | Card — momentum direction |
| `expected_move_spot_open_price` | Line chart — SPX spot open price |
| `expected_move_round_exp_price_move` | Line chart — expected move |
| `expected_move_upper_price` | Card — average upper bound |
| `expected_move_lower_price` | Card — average lower bound |

> :warning: **Important: numbers use a comma as the decimal separator.**
> All numeric values (`5,7`, `250905,74`) are stored with commas. The parser replaces `,` with `.` before calling `parseFloat()`.

### 3.2 Server-side Aggregation Logic

The API route performs the following steps:

1. **Header parsing:** read row 0, find column indices by name (case-insensitive)
2. **Filter:** skip rows where `environment_status !== "LIVE"`
3. **Date parsing:** take the first 10 characters of `date_time_ny` → `"2026-03-10"`
4. **Comma replacement:** all numeric strings processed through `.replace(/,/g, ".")`
5. **Aggregate by date:** sum `order_net_credit` and `order_commission`, count rows per day
6. **Timeline snapshot:** for each date's first row, capture all chart and card fields
7. **Calculate %:** `(total daily PnL / portfolio_balance of the first row that day) × 100`, fallback to `DEPOSIT` env var
8. **Latest balance:** track the most recent `portfolio_balance` across all dates
9. **Return:** `{ data, deposit, balance, timeline, updatedAt }`

---

## 4. Two Main Views

The app has two page-level views, toggled via icon buttons in the header (calendar icon / chart icon). Default view is **Calendar**.

### 4.1 Calendar View

The original calendar grid with all day cells, stats, and mobile list/grid modes. See sections 5 and 7 for full details.

### 4.2 Timeline View

Activated by clicking the chart icon in the header. Shows the selected month's data as:

#### 4.2.1 Line Chart Groups

Four chart sections, each with its own toggleable legend and hover tooltip:

| Group | Series |
|---|---|
| **Portfolio & PnL** | Balance (blue `#60a5fa`), SPX Spot (indigo `#818cf8`) |
| **Gamma Exposure** | Total GEX (purple `#a78bfa`), Spot GEX (`#c084fc`), Zero Gamma (`#e879f9`) |
| **Volatility & Expected Move** | Vol Risk Score (orange `#fb923c`), Expected Move (yellow `#fbbf24`) |
| **Market Breadth** | A/D Ratio (green `#34d399`), % > 50 MA (`#2dd4bf`), % > 200 MA (`#22d3ee`), McClellan (`#38bdf8`) |

Chart behavior:
- Pure SVG, responsive via `viewBox`
- Each series independently toggleable via legend buttons
- Hover crosshair with vertical dashed line + data point circles
- Fixed-position tooltip showing date and values for all visible series
- Grid lines at 0%, 50%, 100% of Y range
- X-axis date labels (MM-DD), thinned when >15 data points

#### 4.2.2 Month Summary Cards

4-column grid (2-column on mobile) below the charts:

| Card | Value |
|---|---|
| Strategy | Last value of the month |
| Symbol | Last value |
| Wing Width | Average |
| Total Commission | Sum across all days |
| Avg Max Loss | Average (red) |
| Avg Max Profit | Average (green) |
| Avg Profit Target | Average |
| Avg Put δ | Average (3 decimal places) |
| Avg Call δ | Average (3 decimal places) |
| Avg EM Upper | Average expected move upper price |
| Avg EM Lower | Average expected move lower price |
| Avg Vol Threshold | Average volatility threshold |

#### 4.2.3 Decisions & Signals Cards

| Card | Value |
|---|---|
| Volatility Decision | TRADE count (green) / NO TRADE count (red) |
| GEX Decision | TRADE / NO TRADE count |
| GEX Strategy | Last value |
| Breadth Decision | TRADE / NO TRADE count |
| Market Bias | Last value, color-coded (green=bullish, red=bearish, yellow=neutral) |
| Trend | Last value, color-coded |
| Momentum | Last value, color-coded |

> All timeline data is filtered to the currently selected month. Navigating months with ← → updates both Calendar and Timeline views.

---

## 5. Calendar View — UI Components

### 5.1 Header

- Month name large (Syne, 22–24px, bold) + year small (JetBrains Mono, muted)
- **Page view toggle:** Calendar icon / Chart icon — switches between Calendar and Timeline views
- On mobile: List / Grid view toggle (two SVG icons) — to the left of the navigation arrows
- Navigation: `←` arrow | `TODAY` button | `→` arrow | refresh button `⟳`
- `TODAY` button is hidden on tablet (≤768px) and mobile to save space
- `DEMO` badge shown when env variables are not set

### 5.2 Portfolio Balance Row

- Full-width card between header and stats
- Label: "PORTFOLIO BALANCE" (uppercase, 10px, muted)
- Value: JetBrains Mono, 18px, semibold — formatted as `$250,905.74`
- Shows latest `portfolio_balance` from the data, or demo value when in demo mode

### 5.3 Stats Row

- 4 cards: `Month PnL` / `Return %` / `Win–Loss days` / `Trades`
- Desktop: 4 columns. Tablet + mobile: 2×2 grid
- Positive values — green (`#4ade80`), negative — red (`#f87171`)
- Value font: JetBrains Mono, 15–16px, semibold

### 5.4 Day Cell

| Element | Desktop / Tablet | Mobile Grid |
|---|---|---|
| Day number | Top-right corner, 10–11px | Top-right corner, 9px |
| PnL | JetBrains Mono, 12–13px, bold | JetBrains Mono, 10px, bold |
| % return | Visible, 9–10px | Visible, 8px |
| Trades count | Visible, 9px uppercase | Hidden |
| Hover | `translateY(-2px)` + shadow | None (touch) |
| Tooltip | On hover — full info | None |

### 5.5 Cell Color Scheme

- **Profitable day:** green background — `rgba(18, G, 45, alpha)`, where `G` and `alpha` scale with intensity
- **Losing day:** red background — `rgba(R, 18, 18, alpha)`
- **Intensity:** `t = |pnl| / maxAbs` for the month; `alpha = 0.20 + t × 0.62`
- **No trades:** dark gray `#12141a`, border `1px #191c25`
- **Empty offset cells:** fully transparent

### 5.6 Tooltip (desktop only)

- Appears on `mouseenter`, follows the cursor (`position: fixed`)
- Contains: full date (Monday, March 10, 2026), PnL, %, trade count
- Value color matches direction (green / red)

---

## 6. Demo Mode

If environment variables are not configured, the app launches with hardcoded demo data:

- ~20 days in March 2026 with realistic PnL values
- Full demo timeline data with all metric fields (generated with realistic ranges)
- Demo portfolio balance: `$250,905.74`
- `DEMO` badge displayed next to the month name
- API route returns `500` with `"must be set in .env"` — the frontend catches this and switches to demo
- Badge disappears automatically once real data is connected

---

## 7. Responsive Design — Three Breakpoints

### 7.1 Desktop (> 768px)

- 7×N calendar grid, all data in cells, hover + tooltip
- Stats: 4 columns
- Full navigation: `← TODAY → ⟳`
- Mobile view toggle: hidden
- Timeline cards: 4-column grid

### 7.2 Tablet (≤ 768px)

- Grid preserved, cells slightly smaller
- Stats: 2×2
- `TODAY` button hidden
- `tradesCount` in cells hidden
- Mobile view toggle: hidden
- Timeline cards: 2-column grid

### 7.3 Mobile (≤ 480px) — two modes

The view toggle is in the header — two icons (list / grid) to the left of the navigation arrows.

#### Mode: List (default)

- Calendar grid and weekday headers fully hidden
- Vertical list of weekdays (newest first), skipping weekends
- Each row: colored background | date + weekday + trade count | colored dot | PnL + %
- Days with no trades shown as muted `no trades` rows

#### Mode: Grid

- 7-column grid — same as tablet but with smaller cells
- Cell height: `min-height: 52px`, `padding: 5px`
- PnL: 10px; % return: 8px; trades count: hidden; day number: 9px

Timeline cards: 2-column grid, smaller fonts.

---

## 8. Docker and Deployment

### 8.1 Multi-stage Dockerfile

| Stage | Base | Action |
|---|---|---|
| `deps` | `node:20-alpine` | `npm install` dependencies |
| `builder` | `node:20-alpine` | `npm run build` (Next.js standalone) |
| `runner` | `node:20-alpine` | Minimal production image |

- User: non-root `nextjs:nodejs` (uid 1001)
- Port: `3000` (`ENV PORT=3000`, `HOSTNAME=0.0.0.0`)
- `next.config.js` must include `output: 'standalone'`
- `public/` folder must exist (add `.gitkeep` if empty)

### 8.2 docker-compose.yml

```yaml
services:
  trading-calendar:
    build: .
    container_name: trading-calendar
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
      - stack.env
    environment:
      - NODE_ENV=production
```

### 8.3 Commands

| Action | Command |
|---|---|
| First run | `docker compose up --build` |
| Background run | `docker compose up -d --build` |
| Stop | `docker compose down` |
| Logs | `docker compose logs -f` |
| Rebuild after changes | `docker compose up --build --force-recreate` |

> :warning: **Known issue:** `npm ci` requires `package-lock.json`. The Dockerfile uses `npm install` — no lock file needed. To switch to `npm ci` for reproducible builds: run `npm install` locally first to generate the lock file, then update the Dockerfile.

---

## 9. Project Structure

```
trading-calendar/
├── app/
│   ├── api/trades/route.ts          # Server-side proxy — aggregation + timeline extraction
│   ├── page.tsx                     # Root page
│   ├── layout.tsx                   # Root layout, global styles
│   └── globals.css                  # Base styles, Google Fonts import
├── components/
│   ├── TradingCalendar.tsx          # Main client component — calendar + view switching
│   ├── TradingCalendar.module.css   # CSS Module — calendar styles
│   ├── TimelineChart.tsx            # Timeline view — SVG charts + metric cards
│   └── TimelineChart.module.css     # CSS Module — timeline styles
├── testdata/
│   ├── Trades.xlsx                  # Sample spreadsheet (binary)
│   └── Trades.xlsx.csv             # Sample spreadsheet (CSV export)
├── public/
│   └── .gitkeep                     # Empty folder — required for Dockerfile COPY
├── .env                             # Secrets (never commit!)
├── .env.example                     # Environment variable template
├── .gitignore
├── .dockerignore
├── Dockerfile                       # Multi-stage production build
├── docker-compose.yml               # One-command orchestration
├── next.config.js                   # output: 'standalone' — required for Docker
├── package.json
├── tsconfig.json
└── PROMPT SPEC.md                   # This file
```

---

## 10. Core Usage Scenario

1. User opens `http://localhost:3000`
2. App loads the current month and fetches `/api/trades`
3. Server reads Google Sheets, aggregates rows by date, extracts timeline metrics, returns JSON
4. Calendar renders: green/red days with gradient intensity, portfolio balance displayed
5. User navigates between months using arrow buttons
6. User switches to Timeline view via chart icon in header
7. Timeline shows 4 chart groups + month summary cards + decision cards for the selected month
8. On mobile, user toggles List ↔ Grid via icons in the header (Calendar view only)
9. Hovering over a day (desktop, Calendar) or chart point (Timeline) shows a tooltip
10. Data auto-refreshes every 5 minutes
11. `⟳` button triggers an immediate refresh

---

## 11. Open Questions

### :question: Source of Realized PnL

The current spreadsheet has no column for the result of a closed trade. `order_net_credit` is used as a proxy (the collected premium on an Iron Condor equals profit when the position expires without touching the strikes).

**Needs clarification:** is there a separate sheet/table with position close results, or should `net_credit` be confirmed as the PnL source?

### :question: Deposit Base for % Calculation

Current approach: `portfolio_balance` from the first row of each day, with `DEPOSIT` env var as fallback.

---

*Trading Calendar · Spec v3.0 · April 2026*
