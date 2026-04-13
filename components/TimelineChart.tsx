'use client'

import { useRef, useState } from 'react'
import styles from './TimelineChart.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TData = Record<string, any>

interface Props {
  data: Record<string, TData>
}

interface SeriesDef {
  key: string
  label: string
  color: string
  unit: string
}

function formatVal(v: number, unit: string): string {
  if (unit === '$') return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (unit === 'B') return v.toFixed(1) + 'B'
  if (unit === '%') return v.toFixed(1) + '%'
  if (unit === 'δ') return v.toFixed(3)
  return v.toFixed(1) + (unit ? ' ' + unit : '')
}

// ── Chart groups ──
const CHART_GROUPS: { title: string; series: SeriesDef[] }[] = [
  {
    title: 'Portfolio & PnL',
    series: [
      { key: 'balance', label: 'Balance', color: '#60a5fa', unit: '$' },
      { key: 'spotPrice', label: 'SPX Spot', color: '#818cf8', unit: '$' },
    ],
  },
  {
    title: 'Gamma Exposure',
    series: [
      { key: 'gex', label: 'Total GEX', color: '#a78bfa', unit: 'B' },
      { key: 'spotGex', label: 'Spot GEX', color: '#c084fc', unit: '' },
      { key: 'zeroGamma', label: 'Zero Gamma', color: '#e879f9', unit: '' },
    ],
  },
  {
    title: 'Volatility & Expected Move',
    series: [
      { key: 'volScore', label: 'Vol Risk Score', color: '#fb923c', unit: '' },
      { key: 'expMove', label: 'Expected Move', color: '#fbbf24', unit: 'pts' },
    ],
  },
  {
    title: 'Market Breadth',
    series: [
      { key: 'adRatio', label: 'A/D Ratio', color: '#34d399', unit: '' },
      { key: 'pct50ma', label: '% > 50 MA', color: '#2dd4bf', unit: '%' },
      { key: 'pct200ma', label: '% > 200 MA', color: '#22d3ee', unit: '%' },
      { key: 'mcclellan', label: 'McClellan', color: '#38bdf8', unit: '' },
    ],
  },
]

function MiniChart({ dates, data, series: allSeries }: { dates: string[]; data: Record<string, TData>; series: SeriesDef[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null)
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(allSeries.map(s => [s.key, true]))
  )

  if (dates.length === 0) return <div className={styles.empty}>No data</div>

  const W = 900, H = 220, PAD = { top: 16, right: 16, bottom: 32, left: 16 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const activeSeries = allSeries.filter(s => visible[s.key])

  const built = activeSeries.map(s => {
    const vals = dates.map(d => (data[d]?.[s.key] as number) ?? 0)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const points = vals.map((v, i) => ({
      x: PAD.left + (i / Math.max(dates.length - 1, 1)) * plotW,
      y: PAD.top + plotH - ((v - min) / range) * plotH,
    }))
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    return { ...s, points, path }
  })

  const xStep = plotW / Math.max(dates.length - 1, 1)

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (W / rect.width) - PAD.left
    const idx = Math.round(mx / xStep)
    if (idx >= 0 && idx < dates.length) setHover({ idx, x: e.clientX, y: e.clientY })
  }

  return (
    <div>
      <div className={styles.legend}>
        {allSeries.map(s => (
          <button
            key={s.key}
            className={`${styles.legendItem} ${!visible[s.key] ? styles.legendOff : ''}`}
            onClick={() => setVisible(v => ({ ...v, [s.key]: !v[s.key] }))}
          >
            <span className={styles.legendDot} style={{ background: visible[s.key] ? s.color : '#333' }} />
            {s.label}
          </button>
        ))}
      </div>
      <div className={styles.chartWrap}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={styles.svg}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map(t => {
            const y = PAD.top + plotH * (1 - t)
            return <line key={t} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#1c1f2a" strokeWidth="1" />
          })}
          {dates.map((d, i) => {
            if (dates.length > 15 && i % Math.ceil(dates.length / 10) !== 0) return null
            const x = PAD.left + (i / Math.max(dates.length - 1, 1)) * plotW
            return <text key={d} x={x} y={H - 6} textAnchor="middle" fill="#3a4050" fontSize="9" fontFamily="JetBrains Mono, monospace">{d.slice(5)}</text>
          })}
          {built.map(s => (
            <path key={s.key} d={s.path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
          ))}
          {hover && hover.idx < dates.length && (
            <>
              <line
                x1={PAD.left + (hover.idx / Math.max(dates.length - 1, 1)) * plotW}
                x2={PAD.left + (hover.idx / Math.max(dates.length - 1, 1)) * plotW}
                y1={PAD.top} y2={PAD.top + plotH}
                stroke="#4a5060" strokeWidth="1" strokeDasharray="4,3"
              />
              {built.map(s => (
                <circle key={s.key} cx={s.points[hover.idx].x} cy={s.points[hover.idx].y}
                  r="4" fill={s.color} stroke="#0e0f11" strokeWidth="2" />
              ))}
            </>
          )}
        </svg>
      </div>
      {hover && hover.idx < dates.length && (
        <div className={styles.tooltip} style={{ left: hover.x + 14, top: hover.y - 10 }}>
          <div className={styles.ttDate}>
            {new Date(dates[hover.idx] + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          {activeSeries.map(s => (
            <div key={s.key} className={styles.ttRow}>
              <span className={styles.ttDot} style={{ background: s.color }} />
              <span className={styles.ttLabel}>{s.label}</span>
              <span className={styles.ttVal}>{formatVal(data[dates[hover.idx]]?.[s.key] ?? 0, s.unit)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function biasColor(v: string): string {
  const u = v.toLowerCase()
  if (u === 'bullish') return '#4ade80'
  if (u === 'bearish') return '#f87171'
  return '#fbbf24'
}

// ── Aggregate card values across month ──
function avgNum(dates: string[], data: Record<string, TData>, key: string): number {
  const vals = dates.map(d => (data[d]?.[key] as number) ?? 0).filter(v => v !== 0)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function sumNum(dates: string[], data: Record<string, TData>, key: string): number {
  return dates.reduce((s, d) => s + ((data[d]?.[key] as number) ?? 0), 0)
}

function lastStr(dates: string[], data: Record<string, TData>, key: string): string {
  for (let i = dates.length - 1; i >= 0; i--) {
    const v = data[dates[i]]?.[key]
    if (v) return String(v)
  }
  return '—'
}

function countDecision(dates: string[], data: Record<string, TData>, key: string, val: string): number {
  return dates.filter(d => String(data[d]?.[key] ?? '').toUpperCase() === val.toUpperCase()).length
}

export default function TimelineChart({ data }: Props) {
  const dates = Object.keys(data).sort()

  return (
    <div className={styles.root}>
      {/* Chart groups */}
      {CHART_GROUPS.map(g => (
        <div key={g.title} className={styles.section}>
          <div className={styles.sectionTitle}>{g.title}</div>
          <MiniChart dates={dates} data={data} series={g.series} />
        </div>
      ))}

      {/* Metric cards */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Month Summary</div>
        <div className={styles.cardsGrid}>
          {/* Order metrics */}
          <div className={styles.card}>
            <div className={styles.cardLabel}>Strategy</div>
            <div className={styles.cardVal}>{lastStr(dates, data, 'strategy')}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Symbol</div>
            <div className={styles.cardVal}>{lastStr(dates, data, 'symbol')}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Wing Width</div>
            <div className={styles.cardVal}>{avgNum(dates, data, 'wingWidth').toFixed(0)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Total Commission</div>
            <div className={styles.cardVal}>${sumNum(dates, data, 'commission').toFixed(2)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Max Loss</div>
            <div className={styles.cardVal} style={{ color: '#f87171' }}>${avgNum(dates, data, 'maxLoss').toFixed(2)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Max Profit</div>
            <div className={styles.cardVal} style={{ color: '#4ade80' }}>${avgNum(dates, data, 'maxProfit').toFixed(2)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Profit Target</div>
            <div className={styles.cardVal}>${avgNum(dates, data, 'profitTarget').toFixed(2)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Put δ</div>
            <div className={styles.cardVal}>{avgNum(dates, data, 'putDelta').toFixed(3)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Call δ</div>
            <div className={styles.cardVal}>{avgNum(dates, data, 'callDelta').toFixed(3)}</div>
          </div>

          {/* Expected move range */}
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg EM Upper</div>
            <div className={styles.cardVal}>{avgNum(dates, data, 'upperPrice').toFixed(0)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg EM Lower</div>
            <div className={styles.cardVal}>{avgNum(dates, data, 'lowerPrice').toFixed(0)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Vol Threshold</div>
            <div className={styles.cardVal}>{avgNum(dates, data, 'volThreshold').toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* Decision cards */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Decisions & Signals</div>
        <div className={styles.cardsGrid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Volatility Decision</div>
            <div className={styles.cardVal}>
              <span style={{ color: '#4ade80' }}>{countDecision(dates, data, 'volDecision', 'TRADE')}</span>
              <span style={{ color: '#4a5060' }}> / </span>
              <span style={{ color: '#f87171' }}>{countDecision(dates, data, 'volDecision', 'NO TRADE')}</span>
              <span className={styles.cardSub}> trade / no trade</span>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>GEX Decision</div>
            <div className={styles.cardVal}>
              <span style={{ color: '#4ade80' }}>{countDecision(dates, data, 'gexDecision', 'TRADE')}</span>
              <span style={{ color: '#4a5060' }}> / </span>
              <span style={{ color: '#f87171' }}>{countDecision(dates, data, 'gexDecision', 'NO TRADE')}</span>
              <span className={styles.cardSub}> trade / no trade</span>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>GEX Strategy</div>
            <div className={styles.cardVal}>{lastStr(dates, data, 'gexStrategy')}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Breadth Decision</div>
            <div className={styles.cardVal}>
              <span style={{ color: '#4ade80' }}>{countDecision(dates, data, 'breadthDecision', 'TRADE')}</span>
              <span style={{ color: '#4a5060' }}> / </span>
              <span style={{ color: '#f87171' }}>{countDecision(dates, data, 'breadthDecision', 'NO TRADE')}</span>
              <span className={styles.cardSub}> trade / no trade</span>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Market Bias</div>
            <div className={styles.cardVal} style={{ color: biasColor(lastStr(dates, data, 'bias')) }}>
              {lastStr(dates, data, 'bias')}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Trend</div>
            <div className={styles.cardVal} style={{ color: biasColor(lastStr(dates, data, 'trend')) }}>
              {lastStr(dates, data, 'trend')}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Momentum</div>
            <div className={styles.cardVal} style={{ color: biasColor(lastStr(dates, data, 'momentum')) }}>
              {lastStr(dates, data, 'momentum')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
