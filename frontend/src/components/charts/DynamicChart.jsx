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
function PieLabel({ cx, cy, innerRadius, midAngle, name, outerRadius, percent }) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      dominantBaseline="central"
      fill="#fff"
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
function GradientDefs({ series }) {
  return (
    <defs>
      {series.map((s, i) => (
        <linearGradient key={s.dataKey} id={`grad-${s.dataKey}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.18} />
          <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.01} />
        </linearGradient>
      ))}
    </defs>
  )
}

// ─── Chart type renderers ─────────────────────────────────────────────────────
function LineChartRenderer({ chart, data, series }) {
  return (
    <LineChart data={data} margin={{ bottom: 28, left: 8, right: 18, top: 12 }}>
      <GradientDefs series={series} />
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
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
      <Tooltip content={<ChartTooltip formatByKey={chart.formatByKey} />} />
      {series.length > 1 ? <Legend content={<ChartLegend />} verticalAlign="top" /> : null}
      {series.map((s, i) => (
        <Line
          key={s.dataKey}
          activeDot={{ r: 5, strokeWidth: 0 }}
          dataKey={s.dataKey}
          dot={{ fill: COLORS[i % COLORS.length], r: 3, strokeWidth: 0 }}
          name={s.name}
          stroke={COLORS[i % COLORS.length]}
          strokeWidth={2.5}
          type="monotone"
        />
      ))}
    </LineChart>
  )
}

function AreaChartRenderer({ chart, data, series }) {
  return (
    <AreaChart data={data} margin={{ bottom: 28, left: 8, right: 18, top: 12 }}>
      <GradientDefs series={series} />
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
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
      <Tooltip content={<ChartTooltip formatByKey={chart.formatByKey} />} />
      {series.length > 1 ? <Legend content={<ChartLegend />} verticalAlign="top" /> : null}
      {series.map((s, i) => (
        <Area
          key={s.dataKey}
          activeDot={{ r: 5, strokeWidth: 0 }}
          dataKey={s.dataKey}
          dot={{ fill: COLORS[i % COLORS.length], r: 3, strokeWidth: 0 }}
          fill={`url(#grad-${s.dataKey})`}
          name={s.name}
          stroke={COLORS[i % COLORS.length]}
          strokeWidth={2.5}
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
            width={100}
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
          barSize={series.length > 1 ? 14 : 22}
          dataKey={s.dataKey}
          fill={COLORS[i % COLORS.length]}
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
        cy="45%"
        data={data}
        dataKey={series[0].dataKey}
        innerRadius="52%"
        labelLine={false}
        nameKey={chart.xAxisKey}
        outerRadius="78%"
        label={<PieLabel />}
      >
        {data.map((entry, index) => (
          <Cell
            key={entry[chart.xAxisKey] ?? index}
            fill={COLORS[index % COLORS.length]}
          />
        ))}
      </Pie>
    </PieChart>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * @param {{ chart: object, preferArea?: boolean }} props
 *   - `preferArea`: render line charts as area charts (default true)
 */
export default function DynamicChart({ chart, preferArea = true }) {
  if (!chart) return null

  const data = chart.data ?? []
  const series = chart.series ?? []

  const isEmpty = !data.length || !series.length

  return (
    <section className="panel chart-card">
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
          <ResponsiveContainer height={300} width="100%">
            {chart.type === 'pie' ? (
              <DonutChartRenderer chart={chart} data={data} series={series} />
            ) : chart.type === 'line' && preferArea ? (
              <AreaChartRenderer chart={chart} data={data} series={series} />
            ) : chart.type === 'line' ? (
              <LineChartRenderer chart={chart} data={data} series={series} />
            ) : (
              <BarChartRenderer chart={chart} data={data} series={series} />
            )}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
