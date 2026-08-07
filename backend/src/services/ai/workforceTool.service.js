import { WORKFORCE_TOOL_NAME_SET } from '../../tools/workforce.tools.js'

const STATUS_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12])
const CHART_TYPES = new Set(['bar', 'line', 'pie'])
const DATE_LABELS = new Set([
  'today', 'yesterday', 'this week', 'last week', 'this month',
  'last month', 'last 30 days', 'last 6 months',
])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const TOOL_CONFIG = {
  compare_customer_shifts: {
    chartTitle: 'Customer Shift Comparison',
    defaultMetrics: ['shift_count', 'completed_count', 'missed_count'],
    groupBy: 'customer',
    reportType: 'customer_performance',
  },
  compare_employee_hours: {
    chartTitle: 'Employee Hours Comparison',
    defaultMetrics: ['rostered_hours', 'actual_hours'],
    groupBy: 'employee',
    reportType: 'employee_hours',
  },
  compare_employee_shifts: {
    chartTitle: 'Shift Comparison by Employee',
    defaultMetrics: ['shift_count', 'completed_count', 'missed_count'],
    groupBy: 'employee',
    reportType: 'employee_shift_count',
  },
  compare_site_coverage: {
    chartTitle: 'Site Coverage Comparison',
    defaultMetrics: ['shift_count', 'completed_count', 'missed_count', 'unfilled_count'],
    groupBy: 'site',
    reportType: 'site_performance',
  },
  get_attendance_records: {
    chartTitle: 'Attendance Records',
    defaultMetrics: ['record_count'],
    entity: 'attendance',
    groupBy: 'attendance_status',
    reportType: 'data_lookup',
  },
  get_currently_clocked_in: {
    chartTitle: 'Currently Clocked-In Employees',
    defaultMetrics: ['shift_count'],
    groupBy: 'employee',
    reportType: 'currently_clocked_in',
  },
  get_shift_status_summary: {
    chartTitle: 'Shift Status Summary',
    defaultMetrics: ['shift_count'],
    groupBy: 'shift_status',
    reportType: 'shift_status_summary',
  },
  get_shift_trend: {
    chartTitle: 'Shift Activity Trend',
    defaultMetrics: ['shift_count', 'completed_count', 'missed_count'],
    groupBy: 'week',
    reportType: 'shift_trend',
  },
  lookup_roster_records: {
    chartTitle: 'FieldServicer Roster Records',
    defaultMetrics: ['record_count'],
    groupBy: 'shift_status',
    reportType: 'data_lookup',
  },
}

const METRICS_BY_TOOL = {
  compare_customer_shifts: new Set(['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'fill_rate', 'rostered_hours', 'actual_hours']),
  compare_employee_hours: new Set(['rostered_hours', 'actual_hours']),
  compare_employee_shifts: new Set(['shift_count', 'completed_count', 'missed_count']),
  compare_site_coverage: new Set(['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'fill_rate', 'rostered_hours', 'actual_hours']),
  get_shift_status_summary: new Set(['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'cancelled_count', 'completion_rate', 'fill_rate']),
  get_shift_trend: new Set(['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'fill_rate']),
}

function safeString(value, maxLength = 180) {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[\u0000-\u001f]/g, ' ').trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}

function safeInteger(value) {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

function safeLimit(value) {
  return Math.max(1, Math.min(safeInteger(value) ?? 20, 100))
}

function safeEnum(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback
}

function safeArray(value, allowed) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(item => allowed.has(item)))]
}

function buildDateRange(args, previousIntent, defaultLabel = 'last 30 days') {
  const from = safeString(args.from_date, 10)
  const to = safeString(args.to_date, 10)

  if (DATE_PATTERN.test(from ?? '') && DATE_PATTERN.test(to ?? '')) {
    return { from, to }
  }

  const label = safeEnum(safeString(args.date_range, 40), DATE_LABELS, null)
  if (label) return { label }

  if (previousIntent?.dateRange?.from && previousIntent?.dateRange?.to) {
    return {
      from: previousIntent.dateRange.from,
      to: previousIntent.dateRange.to,
    }
  }

  return { label: defaultLabel }
}

function buildFilters(args) {
  const filters = {}
  const stringMappings = [
    ['customer', 'customer'],
    ['employee', 'employee'],
    ['site', 'site'],
  ]
  const idMappings = [
    ['customer_id', 'customerId'],
    ['employee_id', 'employeeId'],
    ['site_id', 'siteId'],
  ]

  for (const [source, target] of stringMappings) {
    const value = safeString(args[source], 160)
    if (value) filters[target] = value
  }

  for (const [source, target] of idMappings) {
    const value = safeInteger(args[source])
    if (value !== null) filters[target] = value
  }

  const statusIds = safeArray(
    Array.isArray(args.status_ids) ? args.status_ids.map(Number) : [],
    STATUS_IDS,
  )
  if (statusIds.length) filters.statusIds = statusIds

  const attendanceStatuses = safeArray(
    args.attendance_statuses,
    new Set(['Clocked In', 'Clocked Out', 'Completed', 'Missed', 'Not Started', 'Unfilled', 'Cancelled']),
  )
  if (attendanceStatuses.length) filters.attendanceStatuses = attendanceStatuses

  return filters
}

function lookupGrouping(entity) {
  return {
    attendance: 'attendance_status',
    customers: 'customer',
    employees: 'employee',
    shifts: 'shift_status',
    sites: 'site',
  }[entity] ?? 'shift_status'
}

function sanitizeToolArguments(toolName, args = {}) {
  const config = TOOL_CONFIG[toolName]
  const allowedMetrics = METRICS_BY_TOOL[toolName]
  const metrics = allowedMetrics
    ? safeArray(args.metrics, allowedMetrics)
    : config.defaultMetrics

  return {
    assumption: safeString(args.assumption, 240),
    chartType: safeEnum(args.chart_type, CHART_TYPES, 'bar'),
    confidence: Math.max(0, Math.min(Number(args.confidence) || 0, 1)),
    filters: buildFilters(args),
    groupBy: safeString(args.group_by, 40),
    limit: safeLimit(args.limit),
    metrics: metrics.length ? metrics : config.defaultMetrics,
    search: safeString(args.search, 180),
    sortDirection: args.sort_direction === 'asc' ? 'asc' : 'desc',
    sortField: safeString(args.sort_field, 80),
    understoodQuery: safeString(args.understood_query, 220),
  }
}

export function buildIntentFromToolCall(functionCall, { message, previousIntent = null } = {}) {
  const toolName = safeString(functionCall?.name, 80)
  if (!WORKFORCE_TOOL_NAME_SET.has(toolName)) {
    const error = new Error('Gemini selected an unsupported workforce tool.')
    error.code = 'INVALID_TOOL_SELECTION'
    throw error
  }

  const args = functionCall?.args && typeof functionCall.args === 'object' && !Array.isArray(functionCall.args)
    ? functionCall.args
    : {}
  const config = TOOL_CONFIG[toolName]
  const safe = sanitizeToolArguments(toolName, args)
  const entity = toolName === 'lookup_roster_records'
    ? safeEnum(args.entity, new Set(['shifts', 'employees', 'sites', 'customers']), 'shifts')
    : config.entity ?? null
  const defaultDateLabel = toolName === 'lookup_roster_records' && entity !== 'shifts'
    ? 'last 6 months'
    : 'last 30 days'
  const groupBy = toolName === 'lookup_roster_records'
    ? lookupGrouping(entity)
    : safe.groupBy ?? config.groupBy
  const sortField = safe.sortField ?? safe.metrics[0]

  return {
    assumption: safe.assumption,
    chartTitle: config.chartTitle,
    chartType: toolName === 'get_shift_trend' && safe.chartType === 'bar' ? 'line' : safe.chartType,
    columns: [],
    dateRange: buildDateRange(args, previousIntent, defaultDateLabel),
    dateRangeFilter: toolName === 'get_attendance_records' || entity === 'shifts',
    entity,
    filters: safe.filters,
    groupBy,
    limit: safe.limit,
    lookupMode: 'list',
    metrics: safe.metrics,
    reportType: config.reportType,
    requiresClarification: false,
    search: safe.search,
    selectionConfidence: safe.confidence,
    sort: { direction: safe.sortDirection, field: sortField },
    toolArguments: {
      ...safe,
      dateRange: buildDateRange(args, previousIntent, defaultDateLabel),
      entity,
    },
    toolCallId: safeString(functionCall?.id, 120),
    toolName,
    understoodQuery: safe.understoodQuery ?? safeString(message, 220) ?? 'Workforce data request',
    usedFallback: false,
  }
}

export function createFallbackToolSelection(message, previousIntent = null, reason = 'Gemini tool selection was unavailable') {
  const text = String(message ?? '').toLowerCase()
  let name = 'get_shift_status_summary'

  if (text.includes('clock')) name = text.includes('currently') || text.includes('clocked in')
    ? 'get_currently_clocked_in'
    : 'get_attendance_records'
  else if (text.includes('hour')) name = 'compare_employee_hours'
  else if (text.includes('employee') || text.includes('staff') || text.includes('worker')) name = 'compare_employee_shifts'
  else if (text.includes('site') || text.includes('location')) name = 'compare_site_coverage'
  else if (text.includes('customer') || text.includes('client')) name = 'compare_customer_shifts'
  else if (text.includes('trend') || text.includes('over time')) name = 'get_shift_trend'

  const intent = buildIntentFromToolCall({
    args: {
      assumption: `${reason}; showing the closest API-backed workforce report.`,
      confidence: 0,
      understood_query: safeString(message, 220) ?? 'Workforce data request',
    },
    name,
  }, { message, previousIntent })

  return { ...intent, usedFallback: true }
}
