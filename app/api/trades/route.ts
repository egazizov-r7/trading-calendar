import { NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'
import { readFileSync, existsSync } from 'fs'
import { aggregateRows, ColMapping } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function loadMapping(): ColMapping {
  const mappingPath = process.env.COLUMN_MAPPING_PATH || './column-mapping.json'
  if (existsSync(mappingPath)) {
    return JSON.parse(readFileSync(mappingPath, 'utf-8'))
  }
  // Fallback: default mapping (matches the original hardcoded column names)
  return {
    date_time: 'date_time_ny', net_credit: 'order_net_credit',
    status: 'environment_status', balance: 'portfolio_balance',
    commission: 'order_commission', strategy: 'order_strategy',
    symbol: 'order_symbol', wing_width: 'order_wing_width',
    max_loss: 'order_max_loss', max_profit: 'order_max_profit',
    profit_target: 'order_profit_target_dollars',
    put_delta: 'order_put_short_delta', call_delta: 'order_call_short_delta',
    vol_score: 'volatility_risk_risk_score', vol_threshold: 'volatility_risk_risk_threshold',
    vol_decision: 'volatility_risk_decision',
    gex_total: 'gamma_gex_risk_total_gex_billions', gex_spot: 'gamma_gex_risk_spot_price_gex',
    gex_zero_gamma: 'gamma_gex_risk_zero_gamma_level', gex_decision: 'gamma_gex_risk_decision',
    gex_strategy: 'gamma_gex_risk_strategy',
    ad_ratio: 'market_breadth_risk_ad_ratio', pct_50ma: 'market_breadth_risk_pct_above_50ma',
    pct_200ma: 'market_breadth_risk_pct_above_200ma', mcclellan: 'market_breadth_risk_mcclellan',
    breadth_decision: 'market_breadth_risk_decision',
    bias: 'market_bias_bias', trend: 'market_bias_details_trend',
    momentum: 'market_bias_details_momentum',
    spot_price: 'expected_move_spot_open_price', exp_move: 'expected_move_round_exp_price_move',
    upper_price: 'expected_move_upper_price', lower_price: 'expected_move_lower_price',
  }
}

function loadTimelineConfig() {
  const configPath = process.env.TIMELINE_CONFIG_PATH || './timeline-config.json'
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  }
  return null
}

function getAuth() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account.json'
  const credentials = JSON.parse(readFileSync(keyPath, 'utf-8'))
  return new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export async function GET() {
  const sheetId = process.env.GOOGLE_SHEET_ID
  if (!sheetId) {
    return NextResponse.json(
      { error: 'GOOGLE_SERVICE_ACCOUNT_KEY_PATH and GOOGLE_SHEET_ID must be set in stack.env' },
      { status: 500 }
    )
  }

  const worksheet = process.env.GOOGLE_SHEET_NAME || 'Sheet1'
  const columns = process.env.GOOGLE_SHEET_RANGE || 'A:BF'
  const deposit = parseFloat(process.env.DEPOSIT || '250000')
  const range = `${worksheet}!${columns}`

  try {
    const mapping = loadMapping()
    const auth = getAuth()
    const client = await auth.getClient()
    const token = await client.getAccessToken()
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.token}` },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Google Sheets API error ${res.status}: ${text}` },
        { status: res.status }
      )
    }

    const json = await res.json()
    const rows: string[][] = json.values || []
    if (rows.length === 0) {
      return NextResponse.json({ data: {}, deposit, updatedAt: new Date().toISOString() })
    }

    try {
      const { aggregated, timeline, latestBalance } = aggregateRows(rows, mapping, deposit)
      const timelineConfig = loadTimelineConfig()
      return NextResponse.json({ data: aggregated, deposit, balance: latestBalance, timeline, timelineConfig, updatedAt: new Date().toISOString() })
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
