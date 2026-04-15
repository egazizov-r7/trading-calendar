'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import styles from './TradingCalendar.module.css'
import TimelineChart, { TimelineConfig } from './TimelineChart'
import { formatPnl, getMaxAbs, dayBg, DayData } from '@/lib/utils'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

interface TooltipState {
  visible: boolean
  x: number
  y: number
  date: string
  data: DayData | null
}

interface TimelinePoint {
  [key: string]: number | string
}

// Demo data shown when API is not configured
const DEMO_DATA: Record<string, DayData> = {
  '2026-03-02': { pnl: 2607, pct: 2.6, trades: 2 },
  '2026-03-03': { pnl: 1189, pct: 1.1, trades: 1 },
  '2026-03-04': { pnl: -260, pct: -0.3, trades: 2 },
  '2026-03-05': { pnl: 840, pct: 0.8, trades: 3 },
  '2026-03-06': { pnl: -1420, pct: -1.4, trades: 2 },
  '2026-03-07': { pnl: 310, pct: 0.3, trades: 1 },
  '2026-03-10': { pnl: 1950, pct: 1.9, trades: 4 },
  '2026-03-11': { pnl: -780, pct: -0.8, trades: 3 },
  '2026-03-12': { pnl: 520, pct: 0.5, trades: 2 },
  '2026-03-13': { pnl: 2100, pct: 2.1, trades: 3 },
  '2026-03-14': { pnl: -350, pct: -0.35, trades: 1 },
  '2026-03-17': { pnl: 670, pct: 0.67, trades: 2 },
  '2026-03-18': { pnl: 1340, pct: 1.34, trades: 3 },
  '2026-03-19': { pnl: -920, pct: -0.92, trades: 2 },
  '2026-03-20': { pnl: 450, pct: 0.45, trades: 1 },
  '2026-03-21': { pnl: 880, pct: 0.88, trades: 2 },
  '2026-03-24': { pnl: -1100, pct: -1.1, trades: 3 },
  '2026-03-25': { pnl: 1650, pct: 1.65, trades: 2 },
  '2026-03-26': { pnl: 290, pct: 0.29, trades: 1 },
  '2026-03-27': { pnl: -480, pct: -0.48, trades: 2 },
  '2026-03-28': { pnl: 1200, pct: 1.2, trades: 3 },
}

const DEMO_BALANCE = 250905.74

const DEMO_TIMELINE: Record<string, TimelinePoint> = Object.fromEntries(
  Object.keys(DEMO_DATA).map((d, i) => [d, {
    balance: 248000 + i * 350,
    gex: 150 + Math.sin(i) * 40,
    expMove: 100 + Math.cos(i) * 20,
    volScore: 45 + Math.sin(i * 0.7) * 15,
    spotGex: 6700 + i * 5,
    zeroGamma: 6750 + Math.cos(i) * 30,
    spotPrice: 6700 + i * 8,
    adRatio: 2.5 + Math.sin(i * 0.5) * 1.5,
    pct50ma: 40 + Math.sin(i * 0.3) * 20,
    pct200ma: 60 + Math.cos(i * 0.4) * 10,
    mcclellan: -5 + Math.sin(i * 0.6) * 30,
    commission: 13.12,
    strategy: 'Iron Condor',
    symbol: 'SPX',
    wingWidth: 20,
    maxLoss: 14.3,
    maxProfit: 5.7,
    profitTarget: 1.14,
    putDelta: -0.193,
    callDelta: 0.197,
    volDecision: i % 3 === 0 ? 'NO TRADE' : 'TRADE',
    volThreshold: 50,
    gexDecision: 'TRADE',
    gexStrategy: 'conservative',
    breadthDecision: i % 4 === 0 ? 'NO TRADE' : 'TRADE',
    bias: i % 2 === 0 ? 'bearish' : 'bullish',
    trend: i % 2 === 0 ? 'bearish' : 'bullish',
    momentum: i % 2 === 0 ? 'bearish' : 'bullish',
    upperPrice: 6820 + i * 3,
    lowerPrice: 6590 - i * 2,
  }])
)

export default function TradingCalendar() {
  const timelineEnabled = process.env.NEXT_PUBLIC_ENABLE_TIMELINE !== 'false'
  const today = new Date()
  const [current, setCurrent] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [tradeData, setTradeData] = useState<Record<string, DayData>>(DEMO_DATA)
  const [isDemo, setIsDemo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [balance, setBalance] = useState<number>(DEMO_BALANCE)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, date: '', data: null })
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'grid'>('list')
  const [pageView, setPageView] = useState<'calendar' | 'timeline'>('calendar')
  const [timelineData, setTimelineData] = useState<Record<string, TimelinePoint>>(DEMO_TIMELINE)
  const [timelineConfig, setTimelineConfig] = useState<TimelineConfig | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 480)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/trades')
      const json = await res.json()
      if (!res.ok || json.error) {
        // Fall back to demo if not configured
        if (json.error?.includes('must be set')) {
          setIsDemo(true)
          setTradeData(DEMO_DATA)
          setBalance(DEMO_BALANCE)
          setTimelineData(DEMO_TIMELINE)
        } else {
          setError(json.error || 'Fetch failed')
        }
      } else {
        setIsDemo(false)
        setTradeData(json.data)
        setBalance(json.balance || json.deposit)
        setTimelineData(json.timeline || {})
        setTimelineConfig(json.timelineConfig || null)
        setLastUpdated(json.updatedAt)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 5 minutes
    refreshInterval.current = setInterval(fetchData, 5 * 60 * 1000)
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current) }
  }, [fetchData])

  const y = current.getFullYear()
  const m = current.getMonth()
  const firstDay = new Date(y, m, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const maxAbs = getMaxAbs(tradeData)

  // Stats for current month
  const monthDays = Object.entries(tradeData).filter(([k]) => {
    const d = new Date(k + 'T00:00:00')
    return d.getFullYear() === y && d.getMonth() === m
  })
  const totalPnl = monthDays.reduce((s, [, d]) => s + d.pnl, 0)
  const totalPct = monthDays.reduce((s, [, d]) => s + d.pct, 0)
  const winDays = monthDays.filter(([, d]) => d.pnl > 0).length
  const lossDays = monthDays.filter(([, d]) => d.pnl < 0).length
  const totalTrades = monthDays.reduce((s, [, d]) => s + d.trades, 0)

  const cells: React.ReactNode[] = []

  // Empty cells for offset
  for (let i = 0; i < offset; i++) {
    cells.push(<div key={`empty-${i}`} className={styles.cellEmpty} />)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const data = tradeData[dateStr]
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d

    if (data) {
      cells.push(
        <div
          key={dateStr}
          className={`${styles.cell} ${styles.cellTrade}`}
          style={{ background: dayBg(data.pnl, maxAbs) }}
          onMouseEnter={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, date: dateStr, data })}
          onMouseMove={(e) => setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
          onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
        >
          <div className={styles.dayNum} style={{ color: 'rgba(255,255,255,0.4)' }}>
            {d}{isToday && <span className={styles.todayDot} />}
          </div>
          <div className={styles.pnl}>{formatPnl(data.pnl)}</div>
          <div className={styles.pct}>{data.pnl >= 0 ? '+' : ''}{data.pct.toFixed(2)}%</div>
          <div className={styles.tradesCount}>{data.trades} trade{data.trades !== 1 ? 's' : ''}</div>
        </div>
      )
    } else {
      cells.push(
        <div key={dateStr} className={`${styles.cell} ${styles.cellEmpty2}`}>
          <div className={`${styles.dayNum} ${styles.dayNumEmpty}`}>
            {d}{isToday && <span className={styles.todayDot} />}
          </div>
        </div>
      )
    }
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <div>
            <div className={styles.monthLabel}>{MONTHS[m]}</div>
            <div className={styles.yearLabel}>{y}</div>
          </div>
          {isDemo && <div className={styles.demoBadge}>DEMO</div>}
          {timelineEnabled && <div className={styles.pageToggle}>
            <button
              className={`${styles.pageToggleBtn} ${pageView === 'calendar' ? styles.pageToggleActive : ''}`}
              onClick={() => setPageView('calendar')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="1" y="2" width="12" height="10" rx="1.5"/>
                <line x1="1" y1="5" x2="13" y2="5"/>
                <line x1="4.5" y1="2" x2="4.5" y2="0.5"/>
                <line x1="9.5" y1="2" x2="9.5" y2="0.5"/>
              </svg>
            </button>
            <button
              className={`${styles.pageToggleBtn} ${pageView === 'timeline' ? styles.pageToggleActive : ''}`}
              onClick={() => setPageView('timeline')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                <polyline points="1,11 4,6 7,8 10,3 13,5"/>
              </svg>
            </button>
          </div>}
        </div>
        <div className={styles.nav}>
          {isMobile && (
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${mobileView === 'list' ? styles.viewBtnActive : ''}`}
                onClick={() => setMobileView('list')}
                title="List view"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="3.5" x2="12" y2="3.5"/>
                  <line x1="4" y1="7" x2="12" y2="7"/>
                  <line x1="4" y1="10.5" x2="12" y2="10.5"/>
                  <circle cx="2" cy="3.5" r="0.8" fill="currentColor" stroke="none"/>
                  <circle cx="2" cy="7" r="0.8" fill="currentColor" stroke="none"/>
                  <circle cx="2" cy="10.5" r="0.8" fill="currentColor" stroke="none"/>
                </svg>
              </button>
              <button
                className={`${styles.viewBtn} ${mobileView === 'grid' ? styles.viewBtnActive : ''}`}
                onClick={() => setMobileView('grid')}
                title="Grid view"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="1" width="5" height="5" rx="1"/>
                  <rect x="8" y="1" width="5" height="5" rx="1"/>
                  <rect x="1" y="8" width="5" height="5" rx="1"/>
                  <rect x="8" y="8" width="5" height="5" rx="1"/>
                </svg>
              </button>
            </div>
          )}
          <button className={styles.navBtn} onClick={() => setCurrent(new Date(y, m - 1, 1))}>←</button>
          <button className={`${styles.navBtn} ${styles.todayBtn}`} onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))}>TODAY</button>
          <button className={styles.navBtn} onClick={() => setCurrent(new Date(y, m + 1, 1))}>→</button>
          <button
            className={`${styles.refreshBtn} ${loading ? styles.spinning : ''}`}
            onClick={fetchData}
            title={lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Refresh'}
          >⟳</button>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {/* Portfolio Balance */}
      <div className={styles.balanceRow}>
        <div className={styles.balanceLabel}>Portfolio Balance</div>
        <div className={styles.balanceVal}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Month PnL</div>
          <div className={`${styles.statVal} ${totalPnl > 0 ? styles.pos : totalPnl < 0 ? styles.neg : ''}`}>
            {monthDays.length > 0 ? formatPnl(totalPnl) : '—'}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Return %</div>
          <div className={`${styles.statVal} ${totalPct > 0 ? styles.pos : totalPct < 0 ? styles.neg : ''}`}>
            {monthDays.length > 0 ? `${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%` : '—'}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Win / Loss</div>
          <div className={styles.statVal}>{monthDays.length > 0 ? `${winDays}W / ${lossDays}L` : '—'}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Trades</div>
          <div className={styles.statVal}>{totalTrades > 0 ? totalTrades : '—'}</div>
        </div>
      </div>

      {/* Weekday headers — hidden on mobile grid-off */}
      {pageView === 'calendar' && (!isMobile || mobileView === 'grid') && (
        <div className={styles.weekdays}>
          {WEEKDAYS.map(w => <div key={w} className={styles.wday}>{w}</div>)}
        </div>
      )}

      {/* Calendar grid — hidden on mobile list mode */}
      {pageView === 'calendar' && (!isMobile || mobileView === 'grid') && (
        <div className={`${styles.grid} ${isMobile && mobileView === 'grid' ? styles.gridMobile : ''}`}>
          {cells}
        </div>
      )}

      {/* Mobile list view */}
      {pageView === 'calendar' && isMobile && mobileView === 'list' && (
        <div className={styles.listView}>
          {Array.from({ length: daysInMonth }, (_, i) => daysInMonth - i)
            .filter(d => {
              const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const dow = new Date(dateStr + 'T00:00:00').getDay()
              return dow !== 0 && dow !== 6 // skip weekends
            })
            .map(d => {
              const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const data = tradeData[dateStr]
              const dow = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
              if (!data) {
                return (
                  <div key={dateStr} className={`${styles.listRow} ${styles.listRowEmpty}`}>
                    <div className={styles.listDateBlock}>
                      <div className={styles.listEmptyDate}>
                        {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className={styles.listDow}>{dow}</div>
                    </div>
                    <div className={styles.listRight}>
                      <div className={styles.listEmptyDate}>no trades</div>
                    </div>
                  </div>
                )
              }
              return (
                <div
                  key={dateStr}
                  className={styles.listRow}
                  style={{ background: dayBg(data.pnl, maxAbs) }}
                >
                  <div className={styles.listDateBlock}>
                    <div className={styles.listDate}>
                      {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className={styles.listDow}>{dow} · {data.trades} trade{data.trades !== 1 ? 's' : ''}</div>
                  </div>
                  <div
                    className={styles.listDot}
                    style={{ background: data.pnl >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)' }}
                  />
                  <div className={styles.listRight}>
                    <div className={styles.listPnl}>{formatPnl(data.pnl)}</div>
                    <div className={styles.listMeta}>{data.pct >= 0 ? '+' : ''}{data.pct.toFixed(2)}%</div>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* Timeline view */}
      {timelineEnabled && pageView === 'timeline' && <TimelineChart config={timelineConfig} data={
        Object.fromEntries(Object.entries(timelineData).filter(([k]) => {
          const d = new Date(k + 'T00:00:00')
          return d.getFullYear() === y && d.getMonth() === m
        }))
      } />}

      {/* Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div className={styles.tooltip} style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          <div className={styles.ttDate}>
            {new Date(tooltip.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
            })}
          </div>
          <div className={styles.ttRow}>
            <span className={styles.ttLabel}>PnL</span>
            <span className={`${styles.ttVal} ${tooltip.data.pnl >= 0 ? styles.pos : styles.neg}`}>
              {tooltip.data.pnl >= 0 ? '+' : ''}${tooltip.data.pnl.toLocaleString()}
            </span>
          </div>
          <div className={styles.ttRow}>
            <span className={styles.ttLabel}>Return</span>
            <span className={`${styles.ttVal} ${tooltip.data.pct >= 0 ? styles.pos : styles.neg}`}>
              {tooltip.data.pct >= 0 ? '+' : ''}{tooltip.data.pct.toFixed(2)}%
            </span>
          </div>
          <div className={styles.ttRow}>
            <span className={styles.ttLabel}>Trades</span>
            <span className={styles.ttVal}>{tooltip.data.trades} trade{tooltip.data.trades !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}
