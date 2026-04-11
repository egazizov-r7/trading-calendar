import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface DayData {
  pnl: number
  pct: number
  trades: number
}

export async function GET() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY
  const sheetId = process.env.GOOGLE_SHEET_ID
  const range = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A:D'
  const deposit = parseFloat(process.env.DEPOSIT || '100000')

  if (!apiKey || !sheetId) {
    return NextResponse.json(
      { error: 'GOOGLE_SHEETS_API_KEY and GOOGLE_SHEET_ID must be set in .env' },
      { status: 500 }
    )
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 300 } }) // cache 5 min

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Google Sheets API error ${res.status}: ${text}` },
        { status: res.status }
      )
    }

    const json = await res.json()
    const rows: string[][] = json.values || []

    const aggregated: Record<string, DayData> = {}

    rows.forEach((row, i) => {
      // Skip header row if present
      if (i === 0 && isNaN(parseFloat(row[1]))) return

      const dateStr = row[0]?.trim()
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return

      const pnl = parseFloat(row[1]) || 0
      const tradesCount = parseInt(row[3]) || 1

      if (!aggregated[dateStr]) {
        aggregated[dateStr] = { pnl: 0, pct: 0, trades: 0 }
      }
      aggregated[dateStr].pnl += pnl
      aggregated[dateStr].trades += tradesCount
    })

    // Calculate % from deposit
    Object.keys(aggregated).forEach((k) => {
      aggregated[k].pct = (aggregated[k].pnl / deposit) * 100
    })

    return NextResponse.json({ data: aggregated, deposit, updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
