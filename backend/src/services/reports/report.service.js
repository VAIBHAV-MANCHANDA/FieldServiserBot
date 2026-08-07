import { reportRepository } from '../../repositories/report.repository.js'
import { getReportDefinition, listReportTypes } from './reportRegistry.js'
import { createTripleChartConfig, createSummaryCards, createTable } from './chart.service.js'
import { summarizeReport } from '../ai/summary.service.js'

export { listReportTypes }

const LOOKUP_REPORT_TYPES = new Set(['data_lookup', 'employee_directory'])

// ─── Derive all three charts from raw lookup rows ────────────────────────────
function deriveChartsFromLookupRows(rows, reportType) {
  if (!rows?.length) return { barChart: null, lineChart: null, pieChart: null }

  const groupCandidates = [
    'department', 'position', 'shift_status', 'attendance_status',
    'site_name', 'customer_name', 'industry', 'status',
  ]
  const firstRow = rows[0]
  const groupField = groupCandidates.find((f) => firstRow[f] !== undefined) ?? null
  if (!groupField) return { barChart: null, lineChart: null, pieChart: null }

  const counts = {}
  for (const row of rows) {
    const key = row[groupField] ?? 'Unknown'
    counts[key] = (counts[key] ?? 0) + 1
  }

  const chartData = Object.entries(counts)
    .map(([label, count]) => ({ [groupField]: label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const humanLabel = groupField.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const title = reportType === 'employee_directory'
    ? `Employees by ${humanLabel}`
    : `Records by ${humanLabel}`

  const series = [{ dataKey: 'count', name: 'Count' }]
  const formatByKey = { count: 'number' }

  const pieChart = {
    data: chartData,
    description: `Distribution by ${humanLabel}.`,
    formatByKey,
    series,
    title: `${title} — distribution`,
    type: 'pie',
    xAxisKey: groupField,
  }

  const barChart = {
    data: chartData,
    description: `${title} — full comparison.`,
    formatByKey,
    layout: chartData.length > 8 ? 'vertical' : 'horizontal',
    series,
    title,
    type: 'bar',
    xAxisKey: groupField,
  }

  const lineChart = {
    data: chartData,
    description: `${title} — ranked trend.`,
    formatByKey,
    series,
    title: `${title} — trend`,
    type: 'line',
    xAxisKey: groupField,
  }

  return { barChart, lineChart, pieChart }
}

// ─── Main execute ────────────────────────────────────────────────────────────
export async function executeReport(intent, { toolContext = null } = {}) {
  const definition = getReportDefinition(intent.reportType)

  if (!definition) {
    const error = new Error('Unsupported report type.')
    error.code = 'UNSUPPORTED_REPORT'
    error.status = 400
    throw error
  }

  const repositoryMethod = reportRepository[definition.method]
  if (!repositoryMethod) {
    const error = new Error('Report is not implemented.')
    error.code = 'REPORT_NOT_IMPLEMENTED'
    error.status = 501
    throw error
  }

  const reportResult = await repositoryMethod(intent)
  const { groupKey, rows } = reportResult
  const summaryCards = reportResult.summaryCards ?? createSummaryCards({ intent, rows })

  // ── Generate all three charts ────────────────────────────────────────────
  let pieChart = null
  let barChart = null
  let lineChart = null

  if (LOOKUP_REPORT_TYPES.has(intent.reportType)) {
    const derived = deriveChartsFromLookupRows(rows, intent.reportType)
    pieChart = derived.pieChart
    barChart = derived.barChart
    lineChart = derived.lineChart
  } else {
    const triple = createTripleChartConfig({ groupKey, intent, rows })
    pieChart = triple.pieChart
    barChart = triple.barChart
    lineChart = triple.lineChart
  }

  // legacy compat
  const chart = barChart

  // ── Table ────────────────────────────────────────────────────────────────
  const tableColumns = reportResult.columns ?? definition.tableColumns
  const table = tableColumns
    ? { columns: tableColumns, rows: rows.slice(0, 100) }
    : createTable({ groupKey, intent, rows })

  // ── Applied filters ──────────────────────────────────────────────────────
  const appliesDateRange = definition.usesDateRange !== false || intent.dateRangeFilter
  const appliedFilters = {
    groupBy: intent.groupBy,
    statuses: intent.filters?.statuses ?? [],
    ...(appliesDateRange
      ? { fromDate: intent.dateRange?.from, toDate: intent.dateRange?.to }
      : {}),
    ...Object.fromEntries(
      Object.entries(intent.filters ?? {}).filter(([, v]) => {
        if (Array.isArray(v)) return v.length > 0
        return v !== null && v !== undefined && v !== ''
      }),
    ),
  }

  const summaryPayload = {
    appliedFilters,
    assumption: intent.assumption,
    rows,
    summaryCards,
    toolContext,
    toolName: intent.toolName,
    userQuery: intent.understoodQuery,
  }
  const message = toolContext
    ? await summarizeReport(summaryPayload)
    : reportResult.message ?? await summarizeReport(summaryPayload)

  return {
    appliedFilters,
    barChart,
    chart,
    lineChart,
    message,
    pieChart,
    rows,
    summaryCards,
    table,
  }
}
