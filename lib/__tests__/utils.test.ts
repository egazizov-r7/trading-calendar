import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  parseNum, parseStr,
  formatPnl, getMaxAbs, dayBg,
  formatVal, biasColor,
  avgNum, sumNum, lastStr, countDecision,
  aggregateRows,
} from '@/lib/utils'

// ── parseNum ──

describe('parseNum', () => {
  it('returns 0 for undefined/empty', () => {
    expect(parseNum(undefined)).toBe(0)
    expect(parseNum('')).toBe(0)
  })

  it('parses normal numbers', () => {
    expect(parseNum('123')).toBe(123)
    expect(parseNum('-45.6')).toBe(-45.6)
  })

  it('replaces comma with dot (European format)', () => {
    expect(parseNum('1,5')).toBe(1.5)
    expect(parseNum('1.234,56')).toBeCloseTo(1.234) // only commas replaced, dot stays
  })

  it('returns 0 for non-numeric strings', () => {
    expect(parseNum('abc')).toBe(0)
  })
})

// ── parseStr ──

describe('parseStr', () => {
  it('returns empty string for undefined/null', () => {
    expect(parseStr(undefined)).toBe('')
  })

  it('trims whitespace', () => {
    expect(parseStr('  hello  ')).toBe('hello')
  })

  it('returns empty string for empty input', () => {
    expect(parseStr('')).toBe('')
  })
})

// ── formatPnl ──

describe('formatPnl', () => {
  it('formats positive values under 1000', () => {
    expect(formatPnl(500)).toBe('+$500')
  })

  it('formats negative values under 1000', () => {
    expect(formatPnl(-250)).toBe('$-250')
  })

  it('formats values >= 1000 as k', () => {
    expect(formatPnl(2607)).toBe('+$2.6k')
    expect(formatPnl(-1420)).toBe('$-1.4k')
  })

  it('formats zero', () => {
    expect(formatPnl(0)).toBe('+$0')
  })
})

// ── getMaxAbs ──

describe('getMaxAbs', () => {
  it('returns max absolute PnL', () => {
    const data = {
      '2026-01-01': { pnl: 500, pct: 1, trades: 1 },
      '2026-01-02': { pnl: -800, pct: -2, trades: 2 },
    }
    expect(getMaxAbs(data)).toBe(800)
  })

  it('returns 1 for empty data (floor)', () => {
    expect(getMaxAbs({})).toBe(1)
  })

  it('returns 1 when all PnL is zero', () => {
    const data = { '2026-01-01': { pnl: 0, pct: 0, trades: 1 } }
    expect(getMaxAbs(data)).toBe(1)
  })
})

// ── dayBg ──

describe('dayBg', () => {
  it('returns green-tinted rgba for positive PnL', () => {
    const bg = dayBg(500, 1000)
    expect(bg).toMatch(/^rgba\(18, \d+, 45,/)
  })

  it('returns red-tinted rgba for negative PnL', () => {
    const bg = dayBg(-500, 1000)
    expect(bg).toMatch(/^rgba\(\d+, 18, 18,/)
  })

  it('clamps intensity at 1 when pnl exceeds maxAbs', () => {
    const bg = dayBg(2000, 1000)
    // t = min(2000/1000, 1) = 1, g = 220
    expect(bg).toMatch(/^rgba\(18, 220, 45, 0\.82/)
  })

  it('returns minimum alpha for zero PnL', () => {
    const bg = dayBg(0, 1000)
    // t = 0, alpha = 0.2, r = 80
    expect(bg).toMatch(/0\.2\)$/)
  })
})

// ── formatVal ──

describe('formatVal', () => {
  it('formats dollar values', () => {
    expect(formatVal(1234, '$')).toBe('$1,234')
  })

  it('formats billions', () => {
    expect(formatVal(3.14, 'B')).toBe('3.1B')
  })

  it('formats percentages', () => {
    expect(formatVal(42.567, '%')).toBe('42.6%')
  })

  it('formats delta', () => {
    expect(formatVal(-0.193, 'δ')).toBe('-0.193')
  })

  it('formats with custom unit', () => {
    expect(formatVal(100.5, 'pts')).toBe('100.5 pts')
  })

  it('formats with no unit', () => {
    expect(formatVal(5.0, '')).toBe('5.0')
  })
})

// ── biasColor ──

describe('biasColor', () => {
  it('returns green for bullish', () => {
    expect(biasColor('bullish')).toBe('#4ade80')
    expect(biasColor('BULLISH')).toBe('#4ade80')
  })

  it('returns red for bearish', () => {
    expect(biasColor('bearish')).toBe('#f87171')
  })

  it('returns yellow for neutral/unknown', () => {
    expect(biasColor('neutral')).toBe('#fbbf24')
    expect(biasColor('')).toBe('#fbbf24')
  })
})

// ── avgNum ──

describe('avgNum', () => {
  const dates = ['d1', 'd2', 'd3']
  const data = { d1: { val: 10 }, d2: { val: 20 }, d3: { val: 0 } }

  it('averages non-zero values', () => {
    expect(avgNum(dates, data, 'val')).toBe(15) // (10+20)/2, skips 0
  })

  it('returns 0 when all values are zero', () => {
    expect(avgNum(dates, { d1: { val: 0 }, d2: { val: 0 }, d3: { val: 0 } }, 'val')).toBe(0)
  })

  it('returns 0 for missing key', () => {
    expect(avgNum(dates, data, 'missing')).toBe(0)
  })

  it('returns 0 for empty dates', () => {
    expect(avgNum([], data, 'val')).toBe(0)
  })
})

// ── sumNum ──

describe('sumNum', () => {
  it('sums values across dates', () => {
    const data = { d1: { v: 10 }, d2: { v: 20 }, d3: { v: 5 } }
    expect(sumNum(['d1', 'd2', 'd3'], data, 'v')).toBe(35)
  })

  it('returns 0 for missing key', () => {
    expect(sumNum(['d1'], { d1: { x: 1 } }, 'missing')).toBe(0)
  })
})

// ── lastStr ──

describe('lastStr', () => {
  it('returns last non-empty string value', () => {
    const data = { d1: { s: 'first' }, d2: { s: '' }, d3: { s: 'last' } }
    expect(lastStr(['d1', 'd2', 'd3'], data, 's')).toBe('last')
  })

  it('returns — when all empty', () => {
    expect(lastStr(['d1'], { d1: { s: '' } }, 's')).toBe('—')
  })

  it('returns — for empty dates', () => {
    expect(lastStr([], {}, 's')).toBe('—')
  })
})

// ── countDecision ──

describe('countDecision', () => {
  const data = {
    d1: { dec: 'TRADE' },
    d2: { dec: 'NO TRADE' },
    d3: { dec: 'trade' },
    d4: { dec: '' },
  }
  const dates = ['d1', 'd2', 'd3', 'd4']

  it('counts matching values case-insensitively', () => {
    expect(countDecision(dates, data, 'dec', 'TRADE')).toBe(2)
    expect(countDecision(dates, data, 'dec', 'NO TRADE')).toBe(1)
  })

  it('returns 0 for no matches', () => {
    expect(countDecision(dates, data, 'dec', 'HOLD')).toBe(0)
  })
})

// ── aggregateRows ──

describe('aggregateRows', () => {
  const mapping = {
    date_time: 'date',
    net_credit: 'credit',
    balance: 'bal',
    status: 'status',
    commission: 'comm',
  }

  it('aggregates rows by date', () => {
    const rows = [
      ['date', 'credit', 'bal', 'status', 'comm'],
      ['2026-01-05', '100', '50000', 'LIVE', '5'],
      ['2026-01-05', '200', '50000', 'LIVE', '3'],
      ['2026-01-06', '-50', '50300', 'LIVE', '2'],
    ]
    const result = aggregateRows(rows, mapping, 100000)

    expect(result.aggregated['2026-01-05'].pnl).toBe(300)
    expect(result.aggregated['2026-01-05'].trades).toBe(2)
    expect(result.aggregated['2026-01-06'].pnl).toBe(-50)
    expect(result.aggregated['2026-01-06'].trades).toBe(1)
  })

  it('calculates percentage from balance', () => {
    const rows = [
      ['date', 'credit', 'bal', 'status'],
      ['2026-01-05', '500', '50000', 'LIVE'],
    ]
    const result = aggregateRows(rows, mapping, 100000)
    expect(result.aggregated['2026-01-05'].pct).toBe(1) // 500/50000 * 100
  })

  it('uses deposit as fallback when no balance column', () => {
    const rows = [
      ['date', 'credit'],
      ['2026-01-05', '250'],
    ]
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit' }, 100000)
    expect(result.aggregated['2026-01-05'].pct).toBe(0.25) // 250/100000 * 100
    expect(result.latestBalance).toBe(100000)
  })

  it('filters out non-LIVE rows when status column exists', () => {
    const rows = [
      ['date', 'credit', 'status'],
      ['2026-01-05', '100', 'LIVE'],
      ['2026-01-05', '200', 'TEST'],
      ['2026-01-06', '300', 'PAPER'],
    ]
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit', status: 'status' }, 100000)
    expect(Object.keys(result.aggregated)).toEqual(['2026-01-05'])
    expect(result.aggregated['2026-01-05'].pnl).toBe(100)
    expect(result.aggregated['2026-01-05'].trades).toBe(1)
  })

  it('skips rows with invalid dates', () => {
    const rows = [
      ['date', 'credit'],
      ['not-a-date', '100'],
      ['2026-01-05', '200'],
    ]
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit' }, 100000)
    expect(Object.keys(result.aggregated)).toEqual(['2026-01-05'])
  })

  it('throws when required columns are missing', () => {
    const rows = [['foo', 'bar'], ['a', 'b']]
    expect(() => aggregateRows(rows, mapping, 100000)).toThrow('Required columns not found')
  })

  it('returns empty result for empty rows', () => {
    const result = aggregateRows([], mapping, 100000)
    expect(result.aggregated).toEqual({})
    expect(result.latestBalance).toBe(100000)
  })

  it('returns latest balance from last sorted date', () => {
    const rows = [
      ['date', 'credit', 'bal', 'status'],
      ['2026-01-05', '100', '50000', 'LIVE'],
      ['2026-01-10', '200', '51000', 'LIVE'],
    ]
    const result = aggregateRows(rows, mapping, 100000)
    expect(result.latestBalance).toBe(51000)
  })

  it('accumulates commission across same-day rows in timeline', () => {
    const rows = [
      ['date', 'credit', 'bal', 'status', 'comm'],
      ['2026-01-05', '100', '50000', 'LIVE', '5'],
      ['2026-01-05', '200', '50000', 'LIVE', '3'],
    ]
    const result = aggregateRows(rows, mapping, 100000)
    expect(result.timeline['2026-01-05'].commission).toBe(8)
  })

  it('handles case-insensitive header matching', () => {
    const rows = [
      ['Date', 'CREDIT', 'Bal', 'Status'],
      ['2026-01-05', '100', '50000', 'LIVE'],
    ]
    const result = aggregateRows(rows, mapping, 100000)
    expect(result.aggregated['2026-01-05'].pnl).toBe(100)
  })

  it('defaults timeline balance to deposit when balance column missing', () => {
    const rows = [
      ['date', 'credit'],
      ['2026-01-05', '100'],
    ]
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit' }, 75000)
    expect(result.timeline['2026-01-05'].balance).toBe(75000)
  })

  it('extracts date substring from datetime values', () => {
    const rows = [
      ['date', 'credit'],
      ['2026-01-05 14:30:00', '100'],
    ]
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit' }, 100000)
    expect(result.aggregated['2026-01-05']).toBeDefined()
    expect(result.aggregated['2026-01-05'].pnl).toBe(100)
  })
})

// ── Config file validation ──

describe('column-mapping.json', () => {
  const mapping = JSON.parse(readFileSync(resolve(__dirname, '../../column-mapping.json'), 'utf-8'))

  it('is valid JSON with string values', () => {
    expect(typeof mapping).toBe('object')
    for (const [k, v] of Object.entries(mapping)) {
      expect(typeof k).toBe('string')
      expect(typeof v).toBe('string')
    }
  })

  it('contains required fields', () => {
    expect(mapping.date_time).toBeDefined()
    expect(mapping.net_credit).toBeDefined()
  })
})

describe('timeline-config.json', () => {
  const config = JSON.parse(readFileSync(resolve(__dirname, '../../timeline-config.json'), 'utf-8'))

  it('has charts array', () => {
    expect(Array.isArray(config.charts)).toBe(true)
    expect(config.charts.length).toBeGreaterThan(0)
  })

  it('each chart has title and series', () => {
    for (const chart of config.charts) {
      expect(typeof chart.title).toBe('string')
      expect(Array.isArray(chart.series)).toBe(true)
      for (const s of chart.series) {
        expect(s).toHaveProperty('key')
        expect(s).toHaveProperty('label')
        expect(s).toHaveProperty('color')
        expect(s).toHaveProperty('unit')
      }
    }
  })

  it('has cards array', () => {
    expect(Array.isArray(config.cards)).toBe(true)
  })

  it('each card section has title and items with valid types', () => {
    const validTypes = ['avg', 'sum', 'last', 'decision', 'bias']
    for (const section of config.cards) {
      expect(typeof section.title).toBe('string')
      expect(Array.isArray(section.items)).toBe(true)
      for (const item of section.items) {
        expect(item).toHaveProperty('label')
        expect(item).toHaveProperty('key')
        expect(validTypes).toContain(item.type)
      }
    }
  })

  it('chart series colors are valid hex', () => {
    for (const chart of config.charts) {
      for (const s of chart.series) {
        expect(s.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
  })
})

// ── aggregateRows edge cases ──

describe('aggregateRows edge cases', () => {
  it('handles rows with missing cells (short rows)', () => {
    const rows = [
      ['date', 'credit', 'bal'],
      ['2026-01-05', '100'],  // missing bal cell
    ]
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit', balance: 'bal' }, 50000)
    expect(result.aggregated['2026-01-05'].pnl).toBe(100)
    // balance cell is undefined, parseNum returns 0
    expect(result.timeline['2026-01-05'].balance).toBe(0)
  })

  it('handles negative credit values', () => {
    const rows = [
      ['date', 'credit'],
      ['2026-01-05', '-500'],
    ]
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit' }, 100000)
    expect(result.aggregated['2026-01-05'].pnl).toBe(-500)
    expect(result.aggregated['2026-01-05'].pct).toBe(-0.5)
  })

  it('handles multiple dates sorted correctly for latestBalance', () => {
    const rows = [
      ['date', 'credit', 'bal', 'status'],
      ['2026-01-10', '100', '60000', 'LIVE'],
      ['2026-01-05', '200', '50000', 'LIVE'],
      ['2026-01-15', '300', '70000', 'LIVE'],
    ]
    const mapping = { date_time: 'date', net_credit: 'credit', balance: 'bal', status: 'status' }
    const result = aggregateRows(rows, mapping, 100000)
    // latestBalance should be from the last sorted date (2026-01-15)
    expect(result.latestBalance).toBe(70000)
  })

  it('skips status filter when status column not found in header', () => {
    const rows = [
      ['date', 'credit'],
      ['2026-01-05', '100'],
    ]
    // mapping includes status but header doesn't have it — filter is skipped, row passes through
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit', status: 'status' }, 100000)
    expect(Object.keys(result.aggregated)).toEqual(['2026-01-05'])
  })

  it('handles header-only sheet (no data rows)', () => {
    const rows = [['date', 'credit']]
    const result = aggregateRows(rows, { date_time: 'date', net_credit: 'credit' }, 100000)
    expect(result.aggregated).toEqual({})
    expect(result.latestBalance).toBe(100000)
  })
})

// ── formatPnl edge cases ──

describe('formatPnl edge cases', () => {
  it('formats exactly 1000', () => {
    expect(formatPnl(1000)).toBe('+$1.0k')
  })

  it('formats exactly -1000', () => {
    expect(formatPnl(-1000)).toBe('$-1.0k')
  })

  it('formats large values', () => {
    expect(formatPnl(99999)).toBe('+$100.0k')
  })

  it('formats small fractional values', () => {
    expect(formatPnl(0.5)).toBe('+$1')  // toFixed(0) rounds
  })
})

// ── dayBg edge cases ──

describe('dayBg edge cases', () => {
  it('handles maxAbs of 1 (minimum floor)', () => {
    const bg = dayBg(0.5, 1)
    expect(bg).toMatch(/^rgba\(18, \d+, 45,/)
  })

  it('handles equal pnl and maxAbs', () => {
    const bg = dayBg(100, 100)
    // t = 1, full intensity
    expect(bg).toMatch(/^rgba\(18, 220, 45, 0\.82/)
  })
})

// ── sumNum edge cases ──

describe('sumNum edge cases', () => {
  it('handles negative values', () => {
    const data = { d1: { v: -10 }, d2: { v: 20 } }
    expect(sumNum(['d1', 'd2'], data, 'v')).toBe(10)
  })

  it('handles missing dates in data', () => {
    const data = { d1: { v: 5 } }
    expect(sumNum(['d1', 'd2'], data, 'v')).toBe(5)
  })
})

// ── lastStr edge cases ──

describe('lastStr edge cases', () => {
  it('returns first value when only one date', () => {
    expect(lastStr(['d1'], { d1: { s: 'only' } }, 's')).toBe('only')
  })

  it('skips falsy values (0, null)', () => {
    const data = { d1: { s: 'first' }, d2: { s: 0 }, d3: { s: null } }
    expect(lastStr(['d1', 'd2', 'd3'], data, 's')).toBe('first')
  })
})

// ── formatVal edge cases ──

describe('formatVal edge cases', () => {
  it('formats zero dollar', () => {
    expect(formatVal(0, '$')).toBe('$0')
  })

  it('formats negative percentage', () => {
    expect(formatVal(-5.5, '%')).toBe('-5.5%')
  })

  it('formats large billion value', () => {
    expect(formatVal(999.9, 'B')).toBe('999.9B')
  })
})
