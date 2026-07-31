'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  LineController, LineElement, PointElement,
  LinearScale, CategoryScale,
  Filler, Tooltip,
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const COL = { pos: '#2F7152', neg: '#B0432F', neu: '#928C81' }

interface Props {
  metricKey: string
  label: string
  category: string
  years: number[]
  values: (number | null)[]
  formatter: (v: number) => string
  direction: 1 | -1 | 0  // 1 = higher better, -1 = lower better, 0 = display only
}

export default function PerformanceChart({ metricKey, label, category, years, values, formatter, direction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  const latestIdx = values.map((v, i) => i).filter(i => values[i] != null).pop() ?? 0
  const firstVal  = values.find(v => v != null)
  const lastVal   = values[latestIdx]
  const delta     = (firstVal != null && lastVal != null) ? lastVal - firstVal : null
  const good      = (direction === 0 || delta === null) ? null : (direction === 1 ? delta > 0 : delta < 0)
  const tCls      = good === null ? 'neu' : good ? 'up' : 'down'
  const lineCol   = good === null ? COL.neu : good ? COL.pos : COL.neg

  const dStr = delta === null ? '—' :
    (delta > 0 ? '+' : '') +
    (Math.abs(delta) > 100
      ? Math.round(delta).toLocaleString('he-IL')
      : Math.abs(delta) > 10 ? Math.round(delta) : delta.toFixed(2))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const grad = ctx.createLinearGradient(0, 0, 0, 66)
    grad.addColorStop(0, lineCol + '22')
    grad.addColorStop(1, lineCol + '00')

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          data: values,
          borderColor: lineCol,
          backgroundColor: grad,
          borderWidth: 1.75,
          pointRadius: values.map((_, i) => i === latestIdx ? 3.5 : 0),
          pointBackgroundColor: lineCol,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: lineCol,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          pointHitRadius: 16,
          tension: 0.35,
          fill: true,
          spanGaps: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 4, bottom: 0, left: 2, right: 2 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1815',
            titleColor: 'rgba(255,255,255,.55)',
            bodyColor: '#fff',
            titleFont: { family: 'Heebo', size: 10, weight: '600' } as any,
            bodyFont:  { family: 'Heebo', size: 13, weight: '700' } as any,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            rtl: true,
            callbacks: {
              title: (c) => c[0].label,
              label: (c) => c.parsed.y != null ? formatter(c.parsed.y) : '—',
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { family: 'Heebo', size: 9 } as any, color: '#B3ADA2', maxRotation: 0, padding: 2 },
          },
          y: { display: false, beginAtZero: false, grace: '18%' },
        },
      },
    })

    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [lineCol, values, years, latestIdx, formatter])

  return (
    <div className="card pf-card">
      <div className="pf-head">
        <div>
          <div className="pf-name">{label}</div>
          <div className="pf-cat">{category}</div>
        </div>
        <div className={`pf-delta ${tCls}`}>
          {tCls === 'up' ? '▲' : tCls === 'down' ? '▼' : '•'}
          <span className="num">{dStr}</span>
        </div>
      </div>
      <div className="pf-cur num">
        {lastVal != null ? formatter(lastVal) : '—'}{' '}
        <small>{years[latestIdx]}</small>
      </div>
      <div className="pf-chart">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
