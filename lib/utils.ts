// Pure utility functions shared across the app

export interface DayData {
  pnl: number
  pct: number
  trades: number
}

// ── Parsing ──

export function parseNum(s: string | undefined): number {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '.')) || 0
}

export function parseStr(s: string | undefined): string {
  return (s || '').trim()
}

// ── Calendar helpers ──

export function formatPnl(v: number): string {
  const sign = v >= 0 ? '+' : ''
  if (Math.abs(v) >= 1000) return sign + '$' + (v / 1000).toFixed(1) + 'k'
  return sign + '$' + v.toFixed(0)
}

export function getMaxAbs(data: Record<string, DayData>): number {
  return Math.max(...Object.values(data).map(d => Math.abs(d.pnl)), 1)
}

export function dayBg(pnl: number, maxAbs: number): string {
  const t = Math.min(Math.abs(pnl) / maxAbs, 1)
  const alpha = 0.20 + t * 0.62
  if (pnl > 0) {
    const g = Math.round(80 + t * 140)
    return `rgba(18, ${g}, 45, ${alpha})`
  } else {
    const r = Math.round(80 + t * 140)
    return `rgba(${r}, 18, 18, ${alpha})`
  }
}

// ── Timeline helpers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TData = Record<string, any>

export function formatVal(v: number, unit: string): string {
  if (unit === '$') return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (unit === 'B') return v.toFixed(1) + 'B'
  if (unit === '%') return v.toFixed(1) + '%'
  if (unit === 'δ') return v.toFixed(3)
  return v.toFixed(1) + (unit ? ' ' + unit : '')
}

export function biasColor(v: string): string {
  const u = v.toLowerCase()
  if (u === 'bullish') return '#4ade80'
  if (u === 'bearish') return '#f87171'
  return '#fbbf24'
}

export function avgNum(dates: string[], data: Record<string, TData>, key: string): number {
  const vals = dates.map(d => (data[d]?.[key] as number) ?? 0).filter(v => v !== 0)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

export function sumNum(dates: string[], data: Record<string, TData>, key: string): number {
  return dates.reduce((s, d) => s + ((data[d]?.[key] as number) ?? 0), 0)
}

export function lastStr(dates: string[], data: Record<string, TData>, key: string): string {
  for (let i = dates.length - 1; i >= 0; i--) {
    const v = data[dates[i]]?.[key]
    if (v) return String(v)
  }
  return '—'
}

export function countDecision(dates: string[], data: Record<string, TData>, key: string, val: string): number {
  return dates.filter(d => String(data[d]?.[key] ?? '').toUpperCase() === val.toUpperCase()).length
}

// ── Row aggregation (extracted from API route logic) ──

export type ColMapping = Record<string, string>

export interface AggregationResult {
  aggregated: Record<string, DayData>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timeline: Record<string, Record<string, any>>
  latestBalance: number
}

export function aggregateRows(rows: string[][], mapping: ColMapping, deposit: number): AggregationResult {
  if (rows.length === 0) return { aggregated: {}, timeline: {}, latestBalance: deposit }

  const header = rows[0].map(h => h.trim().toLowerCase())
  const idx: Record<string, number> = {}
  for (const [field, sheetCol] of Object.entries(mapping)) {
    idx[field] = header.indexOf(sheetCol.toLowerCase())
  }

  if (idx.date_time === -1 || idx.net_credit === -1) {
    throw new Error(`Required columns not found. Expected: "${mapping.date_time}" and "${mapping.net_credit}" in sheet header`)
  }

  const aggregated: Record<string, DayData> = {}
  const firstBalance: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeline: Record<string, Record<string, any>> = {}

  const has = (field: string) => idx[field] !== undefined && idx[field] !== -1
  const num = (field: string, row: string[]) => has(field) ? parseNum(row[idx[field]]) : 0
  const str = (field: string, row: string[]) => has(field) ? parseStr(row[idx[field]]) : ''

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]

    if (idx.status !== undefined && idx.status !== -1) {
      const status = (row[idx.status] || '').trim().toUpperCase()
      if (status !== 'LIVE') continue
    }

    const rawDate = (row[idx.date_time] || '').trim()
    const dateStr = rawDate.substring(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue

    const credit = parseNum(row[idx.net_credit])

    if (!aggregated[dateStr]) {
      aggregated[dateStr] = { pnl: 0, pct: 0, trades: 0 }
      if (has('balance')) firstBalance[dateStr] = num('balance', row)

      timeline[dateStr] = {
        balance: has('balance') ? num('balance', row) : deposit,
        gex: num('gex_total', row), expMove: num('exp_move', row),
        volScore: num('vol_score', row), spotGex: num('gex_spot', row),
        zeroGamma: num('gex_zero_gamma', row), spotPrice: num('spot_price', row),
        adRatio: num('ad_ratio', row), pct50ma: num('pct_50ma', row),
        pct200ma: num('pct_200ma', row), mcclellan: num('mcclellan', row),
        commission: num('commission', row), strategy: str('strategy', row),
        symbol: str('symbol', row), wingWidth: num('wing_width', row),
        maxLoss: num('max_loss', row), maxProfit: num('max_profit', row),
        profitTarget: num('profit_target', row), putDelta: num('put_delta', row),
        callDelta: num('call_delta', row), volDecision: str('vol_decision', row),
        volThreshold: num('vol_threshold', row), gexDecision: str('gex_decision', row),
        gexStrategy: str('gex_strategy', row), breadthDecision: str('breadth_decision', row),
        bias: str('bias', row), trend: str('trend', row), momentum: str('momentum', row),
        upperPrice: num('upper_price', row), lowerPrice: num('lower_price', row),
      }
    } else {
      if (timeline[dateStr]) {
        timeline[dateStr].commission += num('commission', row)
      }
    }
    aggregated[dateStr].pnl += credit
    aggregated[dateStr].trades += 1
  }

  let latestBalance = deposit
  const sortedDates = Object.keys(firstBalance).sort()
  if (sortedDates.length > 0) {
    latestBalance = firstBalance[sortedDates[sortedDates.length - 1]]
  }

  for (const k of Object.keys(aggregated)) {
    const base = firstBalance[k] || deposit
    aggregated[k].pct = (aggregated[k].pnl / base) * 100
  }

  return { aggregated, timeline, latestBalance }
}
