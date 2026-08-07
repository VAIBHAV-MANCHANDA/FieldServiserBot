import { useId } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatValue } from '../../utils/chartHelpers.js'

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLORS = [
  '#6d28d9', // accent violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // rose
  '#3b82f6', // sky
  '#8b5cf6', // purple
  '#06b6d4', // cyan
]

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, formatByKey = {}, label, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: item.color }} />
          <span className="chart-tooltip__name">{item.name}</span>
          <span className="chart-tooltip__value">
            {formatValue(item.value, formatByKey[item.dataKey])}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Custom Pie label ─────────────────────────────────────────────────────────
function getContrastColor(color) {
  const hex = String(color ?? '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#fff'
  const [red, green, blue] = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  return red * 0.299 + green * 0.587 + blue * 0.114 > 170 ? '#201a2c' : '#fff'
}

function PieLabel({ cx, cy, innerRadius, midAngle, outerRadius, payload, percent }) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      dominantBaseline="central"
      fill={getContrastColor(payload?.color)}
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Custom Legend ────────────────────────────────────────────────────────────
function ChartLegend({ payload }) {
  if (!payload?.length) return null
  return (
    <div className="chart-legend">
      {payload.map((entry) => (
        <span key={entry.value} className="chart-legend__item">
          <span className="chart-legend__dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyChart({ message = 'No chart data available.' }) {
  return (
    <div className="chart-empty">
      <span className="chart-empty__icon" aria-hidden="true">📊</span>
      <p>{message}</p>
    </div>
  )
}

// ─── Gradient defs helper ─────────────────────────────────────────────────────
function getSeriesColor(chart, seriesItem, index) {
  return seriesItem.color ?? chart.colors?.[seriesItem.dataKey] ?? COLORS[index % COLORS.length]
}

function formatAxisLabel(value, chart) {
  if (chart.xAxisKey === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`))
  }
  return value
}

function GradientDefs({ chart, idPrefix, series }) {
  return (
    <defs>
      {series.map((s, i) => (
        <linearGradient key={s.dataKey} id={`${idPrefix}-${s.dataKey}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="5%" stopColor={getSeriesColor(chart, s, i)} stopOpacity={0.3} />
          <stop offset="95%" stopColor={getSeriesColor(chart, s, i)} stopOpacity={0.015} />
        </linearGradient>
      ))}
    </defs>
  )
}

// ─── Chart type renderers ─────────────────────────────────────────────────────
function LineChartRenderer({ chart, data, idPrefix, series }) {
  return (
    <LineChart data={data} margin={{ bottom: 28, left: 8, right: 18, top: 12 }}>
      <GradientDefs chart={chart} idPrefix={idPrefix} series={series} />
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        angle={-15}
        axisLine={false}
        dataKey={chart.xAxisKey}
        height={52}
        interval="preserveStartEnd"
        tick={{ fill: 'var(--muted)', fontSize: 12 }}
        tickFormatter={(value) => formatAxisLabel(value, chart)}
        textAnchor="end"
        tickLine={false}
      />
      <YAxis
        axisLine={false}
        tick={{ fill: 'var(--muted)', fontSize: 12 }}
        tickFormatter={(v) => formatValue(v)}
        tickLine={false}
        width={48}
      />
      <Tooltip content={<ChartTooltip formatByKey={chart.formatByKey} />} />
      {series.length > 1 ? <Legend content={<ChartLegend />} verticalAlign="top" /> : null}
      {series.map((s, i) => (
        <Line
          key={s.dataKey}
          activeDot={{ r: 5, strokeWidth: 0 }}
          dataKey={s.dataKey}
          dot={data.length > 16 ? false : { fill: getSeriesColor(chart, s, i), r: 3, strokeWidth: 0 }}
          name={s.name}
          stroke={getSeriesColor(chart, s, i)}
          strokeWidth={2.75}
          type="monotone"
        />
      ))}
    </LineChart>
  )
}

function AreaChartRenderer({ chart, data, idPrefix, series }) {
  return (
    <AreaChart data={data} margin={{ bottom: 28, left: 8, right: 18, top: 12 }}>
      <GradientDefs chart={chart} idPrefix={idPrefix} series={series} />
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        angle={-15}
        axisLine={false}
        dataKey={chart.xAxisKey}
        height={52}
        interval="preserveStartEnd"
        tick={{ fill: 'var(--muted)', fontSize: 12 }}
        tickFormatter={(value) => formatAxisLabel(value, chart)}
        textAnchor="end"
        tickLine={false}
      />
      <YAxis
        axisLine={false}
        tick={{ fill: 'var(--muted)', fontSize: 12 }}
        tickFormatter={(v) => formatValue(v)}
        tickLine={false}
        width={48}
      />
      <Tooltip content={<ChartTooltip formatByKey={chart.formatByKey} />} />
      {series.length > 1 ? <Legend content={<ChartLegend />} verticalAlign="top" /> : null}
      {series.map((s, i) => (
        <Area
          key={s.dataKey}
          activeDot={{ r: 5, strokeWidth: 0 }}
          dataKey={s.dataKey}
          dot={data.length > 16 ? false : { fill: getSeriesColor(chart, s, i), r: 3, strokeWidth: 0 }}
          fill={`url(#${idPrefix}-${s.dataKey})`}
          name={s.name}
          stroke={getSeriesColor(chart, s, i)}
          strokeWidth={2.75}
          type="monotone"
        />
      ))}
    </AreaChart>
  )
}

function BarChartRenderer({ chart, data, series }) {
  const isVertical = chart.layout === 'vertical'
  return (
    <BarChart
      barGap={3}
      data={data}
      layout={isVertical ? 'vertical' : 'horizontal'}
      margin={{
        bottom: isVertical ? 8 : 28,
        left: isVertical ? 100 : 8,
        right: 18,
        top: 12,
      }}
    >
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={isVertical} horizontal={!isVertical} />
      {isVertical ? (
        <>
          <XAxis
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            tickFormatter={(v) => formatValue(v)}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey={chart.xAxisKey}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            tickLine={false}
            type="category"
            width={chart.yAxisWidth ?? 110}
          />
        </>
      ) : (
        <>
          <XAxis
            angle={-15}
            axisLine={false}
            dataKey={chart.xAxisKey}
            height={52}
            interval={0}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            textAnchor="end"
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            tickFormatter={(v) => formatValue(v)}
            tickLine={false}
            width={48}
          />
        </>
      )}
      <Tooltip content={<ChartTooltip formatByKey={chart.formatByKey} />} />
      {series.length > 1 ? <Legend content={<ChartLegend />} verticalAlign="top" /> : null}
      {series.map((s, i) => (
        <Bar
          key={s.dataKey}
          maxBarSize={series.length > 1 ? 13 : 22}
          dataKey={s.dataKey}
          fill={getSeriesColor(chart, s, i)}
          name={s.name}
          radius={isVertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
        />
      ))}
    </BarChart>
  )
}

function DonutChartRenderer({ chart, data, series }) {
  return (
    <PieChart>
      <Tooltip content={<ChartTooltip formatByKey={chart.formatByKey} />} />
      <Legend content={<ChartLegend />} verticalAlign="bottom" />
      <Pie
        cx="50%"
        cy="43%"
        data={data}
        dataKey={series[0].dataKey}
        innerRadius="58%"
        labelLine={false}
        nameKey={chart.xAxisKey}
        outerRadius="82%"
        label={<PieLabel />}
      >
        {data.map((entry, index) => (
          <Cell
            key={entry[chart.xAxisKey] ?? index}
            fill={entry.color ?? COLORS[index % COLORS.length]}
          />
        ))}
      </Pie>
      {chart.centerValue !== undefined ? (
        <>
          <text className="donut-center-value" dominantBaseline="central" textAnchor="middle" x="50%" y="40%">{chart.centerValue}</text>
          <text className="donut-center-label" dominantBaseline="central" textAnchor="middle" x="50%" y="47%">{chart.centerLabel ?? ''}</text>
        </>
      ) : null}
    </PieChart>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * @param {{ chart: object, preferArea?: boolean }} props
 *   - `preferArea`: render line charts as area charts (default true)
 */
export default function DynamicChart({ chart, preferArea = true }) {
  const chartId = useId().replaceAll(':', '')
  if (!chart) return null

  const data = chart.data ?? []
  const series = chart.series ?? []

  const isEmpty = !data.length || !series.length

  return (
    <section className={`panel chart-card ${chart.className ?? ''}`.trim()}>
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">{chart.type?.toUpperCase() ?? 'CHART'}</p>
          <h3 className="panel__title">{chart.title ?? 'Chart'}</h3>
          {chart.description ? (
            <p className="panel__subtitle">{chart.description}</p>
          ) : null}
        </div>
      </header>

      <div className="panel__body chart-frame">
        {isEmpty ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer height={chart.height ?? 320} width="100%">
            {chart.type === 'pie' ? (
              <DonutChartRenderer chart={chart} data={data} series={series} />
            ) : chart.type === 'line' && preferArea ? (
              <AreaChartRenderer chart={chart} data={data} idPrefix={`chart-${chartId}`} series={series} />
            ) : chart.type === 'line' ? (
              <LineChartRenderer chart={chart} data={data} idPrefix={`chart-${chartId}`} series={series} />
            ) : (
              <BarChartRenderer chart={chart} data={data} series={series} />
            )}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
