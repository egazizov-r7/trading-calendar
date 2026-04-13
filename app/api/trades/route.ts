import { NextResponse } from 'next/server'

interface DayData {
  pnl: number
  pct: number
  trades: number
}

function parseNum(s: string | undefined): number {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '.')) || 0
}

function parseStr(s: string | undefined): string {
  return (s || '').trim()
}

export async function GET() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY
  const sheetId = process.env.GOOGLE_SHEET_ID
  const range = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A:BF'
  const deposit = parseFloat(process.env.DEPOSIT || '250000')

  if (!apiKey || !sheetId) {
    return NextResponse.json(
      { error: 'GOOGLE_SHEETS_API_KEY and GOOGLE_SHEET_ID must be set in .env' },
      { status: 500 }
    )
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 300 } })

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

    const header = rows[0].map(h => h.trim().toLowerCase())
    const col = (name: string) => header.indexOf(name)

    const iDate = col('date_time_ny')
    const iCredit = col('order_net_credit')
    const iStatus = col('environment_status')
    const iBalance = col('portfolio_balance')

    if (iDate === -1 || iCredit === -1) {
      return NextResponse.json(
        { error: 'Required columns (date_time_ny, order_net_credit) not found in sheet' },
        { status: 500 }
      )
    }

    // Chart columns
    const iGex = col('gamma_gex_risk_total_gex_billions')
    const iExpMove = col('expected_move_round_exp_price_move')
    const iVolScore = col('volatility_risk_risk_score')
    const iSpotGex = col('gamma_gex_risk_spot_price_gex')
    const iZeroGamma = col('gamma_gex_risk_zero_gamma_level')
    const iSpotPrice = col('expected_move_spot_open_price')
    const iAdRatio = col('market_breadth_risk_ad_ratio')
    const iPct50ma = col('market_breadth_risk_pct_above_50ma')
    const iPct200ma = col('market_breadth_risk_pct_above_200ma')
    const iMcclellan = col('market_breadth_risk_mcclellan')

    // Card columns
    const iCommission = col('order_commission')
    const iStrategy = col('order_strategy')
    const iSymbol = col('order_symbol')
    const iWingWidth = col('order_wing_width')
    const iMaxLoss = col('order_max_loss')
    const iMaxProfit = col('order_max_profit')
    const iProfitTarget = col('order_profit_target_dollars')
    const iPutDelta = col('order_put_short_delta')
    const iCallDelta = col('order_call_short_delta')
    const iVolDecision = col('volatility_risk_decision')
    const iGexDecision = col('gamma_gex_risk_decision')
    const iGexStrategy = col('gamma_gex_risk_strategy')
    const iBreadthDecision = col('market_breadth_risk_decision')
    const iBias = col('market_bias_bias')
    const iTrend = col('market_bias_details_trend')
    const iMomentum = col('market_bias_details_momentum')
    const iUpperPrice = col('expected_move_upper_price')
    const iLowerPrice = col('expected_move_lower_price')
    const iVolThreshold = col('volatility_risk_risk_threshold')

    const aggregated: Record<string, DayData> = {}
    const firstBalance: Record<string, number> = {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeline: Record<string, Record<string, any>> = {}

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]

      if (iStatus !== -1) {
        const status = (row[iStatus] || '').trim().toUpperCase()
        if (status !== 'LIVE') continue
      }

      const rawDate = (row[iDate] || '').trim()
      const dateStr = rawDate.substring(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue

      const credit = parseNum(row[iCredit])

      if (!aggregated[dateStr]) {
        aggregated[dateStr] = { pnl: 0, pct: 0, trades: 0 }
        if (iBalance !== -1) firstBalance[dateStr] = parseNum(row[iBalance])

        timeline[dateStr] = {
          // Chart series
          balance: iBalance !== -1 ? parseNum(row[iBalance]) : deposit,
          gex: iGex !== -1 ? parseNum(row[iGex]) : 0,
          expMove: iExpMove !== -1 ? parseNum(row[iExpMove]) : 0,
          volScore: iVolScore !== -1 ? parseNum(row[iVolScore]) : 0,
          spotGex: iSpotGex !== -1 ? parseNum(row[iSpotGex]) : 0,
          zeroGamma: iZeroGamma !== -1 ? parseNum(row[iZeroGamma]) : 0,
          spotPrice: iSpotPrice !== -1 ? parseNum(row[iSpotPrice]) : 0,
          adRatio: iAdRatio !== -1 ? parseNum(row[iAdRatio]) : 0,
          pct50ma: iPct50ma !== -1 ? parseNum(row[iPct50ma]) : 0,
          pct200ma: iPct200ma !== -1 ? parseNum(row[iPct200ma]) : 0,
          mcclellan: iMcclellan !== -1 ? parseNum(row[iMcclellan]) : 0,
          // Card fields
          commission: iCommission !== -1 ? parseNum(row[iCommission]) : 0,
          strategy: iStrategy !== -1 ? parseStr(row[iStrategy]) : '',
          symbol: iSymbol !== -1 ? parseStr(row[iSymbol]) : '',
          wingWidth: iWingWidth !== -1 ? parseNum(row[iWingWidth]) : 0,
          maxLoss: iMaxLoss !== -1 ? parseNum(row[iMaxLoss]) : 0,
          maxProfit: iMaxProfit !== -1 ? parseNum(row[iMaxProfit]) : 0,
          profitTarget: iProfitTarget !== -1 ? parseNum(row[iProfitTarget]) : 0,
          putDelta: iPutDelta !== -1 ? parseNum(row[iPutDelta]) : 0,
          callDelta: iCallDelta !== -1 ? parseNum(row[iCallDelta]) : 0,
          volDecision: iVolDecision !== -1 ? parseStr(row[iVolDecision]) : '',
          volThreshold: iVolThreshold !== -1 ? parseNum(row[iVolThreshold]) : 0,
          gexDecision: iGexDecision !== -1 ? parseStr(row[iGexDecision]) : '',
          gexStrategy: iGexStrategy !== -1 ? parseStr(row[iGexStrategy]) : '',
          breadthDecision: iBreadthDecision !== -1 ? parseStr(row[iBreadthDecision]) : '',
          bias: iBias !== -1 ? parseStr(row[iBias]) : '',
          trend: iTrend !== -1 ? parseStr(row[iTrend]) : '',
          momentum: iMomentum !== -1 ? parseStr(row[iMomentum]) : '',
          upperPrice: iUpperPrice !== -1 ? parseNum(row[iUpperPrice]) : 0,
          lowerPrice: iLowerPrice !== -1 ? parseNum(row[iLowerPrice]) : 0,
        }
      } else {
        // Aggregate commissions across trades on same day
        if (timeline[dateStr]) {
          timeline[dateStr].commission += iCommission !== -1 ? parseNum(row[iCommission]) : 0
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

    return NextResponse.json({ data: aggregated, deposit, balance: latestBalance, timeline, updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
