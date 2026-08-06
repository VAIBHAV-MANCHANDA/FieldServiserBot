const FORMAT_BY_METRIC = {
  actual_hours: 'hours',
  completion_rate: 'percentage',
  fill_rate: 'percentage',
  gross_margin_percentage: 'percentage',
  gross_profit: 'currency',
  late_minutes: 'minutes',
  overtime_hours: 'hours',
  revenue: 'currency',
  rostered_hours: 'hours',
  wages: 'currency',
}

const LABELS = {
  actual_hours: 'Actual Hours',
  cancelled_count: 'Cancelled',
  completed_count: 'Completed',
  completion_rate: 'Completion Rate',
  early_leave_minutes: 'Early Leave',
  employee_count: 'Employees',
  fill_rate: 'Fill Rate',
  gross_margin_percentage: 'Gross Margin',
  gross_profit: 'Gross Profit',
  late_count: 'Late Count',
  late_minutes: 'Late Minutes',
  missed_count: 'Missed',
  overtime_hours: 'Overtime Hours',
  record_count: 'Records',
  revenue: 'Revenue',
  rostered_hours: 'Rostered Hours',
  shift_count: 'Shifts',
  unfilled_count: 'Unfilled',
  wages: 'Wages',
}

function getXAxisKey(intent, groupKey) {
  if (intent.groupBy === 'date' || intent.groupBy === 'day') return 'date'
  if (intent.groupBy === 'week') return 'week'
  if (intent.groupBy === 'month') return 'month'
  return groupKey
}

// ─── Legacy single-chart (kept for dashboard executeReport API) ───────────────
export function createChartConfig({ groupKey, intent, rows }) {
  const xAxisKey = getXAxisKey(intent, groupKey)
  const isTimeSeries = ['date', 'day', 'week', 'month'].includes(intent.groupBy)
  const normalizedType = isTimeSeries && intent.chartType !== 'pie' ? 'line' : intent.chartType

  return {
    data: rows,
    description: `${intent.chartTitle} for the selected filters.`,
    formatByKey: Object.fromEntries(
      intent.metrics.map((m) => [m, FORMAT_BY_METRIC[m] ?? 'number']),
    ),
    layout: intent.groupBy === 'employee' && rows.length > 8 ? 'vertical' : 'horizontal',
    series: intent.metrics.map((m) => ({
      dataKey: m,
      format: FORMAT_BY_METRIC[m] ?? 'number',
      name: LABELS[m] ?? m,
    })),
    title: intent.chartTitle,
    type: normalizedType,
    xAxisKey,
  }
}

// ─── Triple-chart builder — always returns all three chart types ──────────────
/**
 * Returns { lineChart, pieChart, barChart }
 *
 * lineChart  — trends the FIRST metric across all data points (area/line)
 * pieChart   — donut distribution of the first metric, top 12 sorted desc
 * barChart   — full multi-metric bar (vertical when many employees)
 *
 * Each is null only if rows is empty.
 */
export function createTripleChartConfig({ groupKey, intent, rows }) {
  if (!rows.length) return { barChart: null, lineChart: null, pieChart: null }

  const xAxisKey = getXAxisKey(intent, groupKey)
  const isTimeSeries = ['date', 'day', 'week', 'month'].includes(intent.groupBy)

  const formatByKey = Object.fromEntries(
    intent.metrics.map((m) => [m, FORMAT_BY_METRIC[m] ?? 'number']),
  )
  const series = intent.metrics.map((m) => ({
    dataKey: m,
    format: FORMAT_BY_METRIC[m] ?? 'number',
    name: LABELS[m] ?? m,
  }))

  const firstMetric = intent.metrics[0]
  const firstLabel = LABELS[firstMetric] ?? firstMetric
  const firstFormat = FORMAT_BY_METRIC[firstMetric] ?? 'number'

  // ── 1. Line / area chart — trend over all data points ─────────────────
  // For non-time-series data, sort by value desc so the trend tells a story
  const lineData = isTimeSeries
    ? [...rows]
    : [...rows].sort((a, b) => Number(b[firstMetric] ?? 0) - Number(a[firstMetric] ?? 0))

  const lineChart = {
    data: lineData,
    description: isTimeSeries
      ? `${firstLabel} trend over time.`
      : `${firstLabel} ranked across all groups.`,
    formatByKey,
    series,
    title: isTimeSeries
      ? `${firstLabel} over time`
      : `${firstLabel} trend`,
    type: 'line',
    xAxisKey,
  }

  // ── 2. Pie / donut chart — distribution, top 12 ───────────────────────
  const pieData = [...rows]
    .sort((a, b) => Number(b[firstMetric] ?? 0) - Number(a[firstMetric] ?? 0))
    .slice(0, 12)

  const pieChart = {
    data: pieData,
    description: `${firstLabel} share by ${intent.groupBy ?? groupKey}.`,
    formatByKey: { [firstMetric]: firstFormat },
    series: [{ dataKey: firstMetric, name: firstLabel }],
    title: `${firstLabel} distribution`,
    type: 'pie',
    xAxisKey,
  }

  // ── 3. Bar chart — all metrics, full dataset ──────────────────────────
  const barChart = {
    data: rows,
    description: `${intent.chartTitle ?? 'Breakdown'} — full comparison.`,
    formatByKey,
    layout: !isTimeSeries && rows.length > 8 ? 'vertical' : 'horizontal',
    series,
    title: intent.chartTitle ?? 'Full Breakdown',
    type: 'bar',
    xAxisKey,
  }

  return { barChart, lineChart, pieChart }
}

// ─── Legacy alias so report.service.js works unchanged ───────────────────────
export function createDualChartConfig({ groupKey, intent, rows }) {
  const { barChart, lineChart, pieChart } = createTripleChartConfig({ groupKey, intent, rows })
  return { barChart: barChart ?? lineChart, pieChart }
}

// ─── Summary cards — always exactly 3 meaningful cards ───────────────────────
export function createSummaryCards({ intent, rows }) {
  if (!rows.length) {
    return [
      { format: 'number', label: 'Total Records', value: 0 },
      { format: 'number', label: 'Groups Found', value: 0 },
      { format: 'number', label: 'Data Points', value: 0 },
    ]
  }

  const cards = []

  // ── Card 1: total / sum of primary metric ─────────────────────────────
  const primaryMetric = intent.metrics[0]
  const primaryValues = rows.map((r) => Number(r[primaryMetric]) || 0)
  const primaryTotal = primaryValues.reduce((s, v) => s + v, 0)
  const isPrimaryAvg = primaryMetric.includes('rate') || primaryMetric.includes('percentage')
  cards.push({
    format: FORMAT_BY_METRIC[primaryMetric] ?? 'number',
    label: LABELS[primaryMetric] ?? primaryMetric.replaceAll('_', ' '),
    value: Number((isPrimaryAvg ? primaryTotal / rows.length : primaryTotal).toFixed(2)),
  })

  // ── Card 2: second metric total OR average of primary ─────────────────
  if (intent.metrics.length >= 2) {
    const secondMetric = intent.metrics[1]
    const secondValues = rows.map((r) => Number(r[secondMetric]) || 0)
    const secondTotal = secondValues.reduce((s, v) => s + v, 0)
    const isSecondAvg = secondMetric.includes('rate') || secondMetric.includes('percentage')
    cards.push({
      format: FORMAT_BY_METRIC[secondMetric] ?? 'number',
      label: LABELS[secondMetric] ?? secondMetric.replaceAll('_', ' '),
      value: Number((isSecondAvg ? secondTotal / rows.length : secondTotal).toFixed(2)),
    })
  } else {
    // Only one metric — show the average as a second card
    const avg = primaryTotal / rows.length
    cards.push({
      format: FORMAT_BY_METRIC[primaryMetric] ?? 'number',
      label: `Avg ${LABELS[primaryMetric] ?? primaryMetric.replaceAll('_', ' ')}`,
      value: Number(avg.toFixed(2)),
    })
  }

  // ── Card 3: third metric OR top performer OR group count ──────────────
  if (intent.metrics.length >= 3) {
    const thirdMetric = intent.metrics[2]
    const thirdValues = rows.map((r) => Number(r[thirdMetric]) || 0)
    const thirdTotal = thirdValues.reduce((s, v) => s + v, 0)
    const isThirdAvg = thirdMetric.includes('rate') || thirdMetric.includes('percentage')
    cards.push({
      format: FORMAT_BY_METRIC[thirdMetric] ?? 'number',
      label: LABELS[thirdMetric] ?? thirdMetric.replaceAll('_', ' '),
      value: Number((isThirdAvg ? thirdTotal / rows.length : thirdTotal).toFixed(2)),
    })
  } else {
    // Derive: find the top-performing row and show its value as "Top [groupBy]"
    const sorted = [...rows].sort(
      (a, b) => Number(b[primaryMetric] ?? 0) - Number(a[primaryMetric] ?? 0),
    )
    const topRow = sorted[0]

    // Try to find a meaningful dimension key (not the metric itself)
    const dimensionKey = Object.keys(topRow).find(
      (k) => !intent.metrics.includes(k) && typeof topRow[k] === 'string',
    )

    if (dimensionKey && topRow[dimensionKey]) {
      cards.push({
        format: 'text',
        label: `Top ${dimensionKey.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
        value: topRow[dimensionKey],
      })
    } else {
      cards.push({
        format: 'number',
        label: 'Groups',
        value: rows.length,
      })
    }
  }

  return cards
}

export function createTable({ groupKey, intent, rows }) {
  const xAxisKey = getXAxisKey(intent, groupKey)
  const columns = [
    {
      key: xAxisKey,
      label: LABELS[groupKey] ?? groupKey.replaceAll('_', ' '),
    },
    ...intent.metrics.map((metric) => ({
      format: FORMAT_BY_METRIC[metric] ?? 'number',
      key: metric,
      label: LABELS[metric] ?? metric.replaceAll('_', ' '),
    })),
  ]

  return {
    columns,
    rows: rows.slice(0, 100),
  }
}
