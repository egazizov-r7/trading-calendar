'use client'

import { useRef, useState } from 'react'
import styles from './TimelineChart.module.css'
import { formatVal, biasColor, avgNum, sumNum, lastStr, countDecision } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TData = Record<string, any>

interface SeriesDef {
  key: string
  label: string
  color: string
  unit: string
}

interface CardItem {
  label: string
  key: string
  type: 'avg' | 'sum' | 'last' | 'decision' | 'bias'
  decimals?: number
  prefix?: string
  color?: string
}

interface CardSection {
  title: string
  items: CardItem[]
}

export interface TimelineConfig {
  charts: { title: string; series: SeriesDef[] }[]
  cards: CardSection[]
}

interface Props {
  data: Record<string, TData>
  config?: TimelineConfig | null
}

// ── Default config (used when no config file provided) ──
const DEFAULT_CONFIG: TimelineConfig = {
  charts: [
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
  ],
  cards: [],
}

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

function CardValue({ item, dates, data }: { item: CardItem; dates: string[]; data: Record<string, TData> }) {
  const d = item.decimals ?? 0
  const p = item.prefix ?? ''

  switch (item.type) {
    case 'avg':
      return <div className={styles.cardVal} style={item.color ? { color: item.color } : undefined}>{p}{avgNum(dates, data, item.key).toFixed(d)}</div>
    case 'sum':
      return <div className={styles.cardVal} style={item.color ? { color: item.color } : undefined}>{p}{sumNum(dates, data, item.key).toFixed(d)}</div>
    case 'last':
      return <div className={styles.cardVal}>{lastStr(dates, data, item.key)}</div>
    case 'bias': {
      const v = lastStr(dates, data, item.key)
      return <div className={styles.cardVal} style={{ color: biasColor(v) }}>{v}</div>
    }
    case 'decision':
      return (
        <div className={styles.cardVal}>
          <span style={{ color: '#4ade80' }}>{countDecision(dates, data, item.key, 'TRADE')}</span>
          <span style={{ color: '#4a5060' }}> / </span>
          <span style={{ color: '#f87171' }}>{countDecision(dates, data, item.key, 'NO TRADE')}</span>
          <span className={styles.cardSub}> trade / no trade</span>
        </div>
      )
  }
}

export default function TimelineChart({ data, config }: Props) {
  const dates = Object.keys(data).sort()
  const cfg = config ?? DEFAULT_CONFIG

  return (
    <div className={styles.root}>
      {cfg.charts.map(g => (
        <div key={g.title} className={styles.section}>
          <div className={styles.sectionTitle}>{g.title}</div>
          <MiniChart dates={dates} data={data} series={g.series} />
        </div>
      ))}

      {cfg.cards.map(section => (
        <div key={section.title} className={styles.section}>
          <div className={styles.sectionTitle}>{section.title}</div>
          <div className={styles.cardsGrid}>
            {section.items.map(item => (
              <div key={item.key} className={styles.card}>
                <div className={styles.cardLabel}>{item.label}</div>
                <CardValue item={item} dates={dates} data={data} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
