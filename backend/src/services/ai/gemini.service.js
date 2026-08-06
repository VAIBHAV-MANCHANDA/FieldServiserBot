import { getGeminiClient } from '../../config/gemini.js'
import { env } from '../../config/env.js'
import { buildIntentPrompt, buildSummaryPrompt } from './prompt.service.js'
import { logger } from '../../utils/logger.js'

function extractJsonObject(text) {
  const value = String(text ?? '').trim()
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    return value
  }

  return value.slice(start, end + 1)
}

function parseJsonText(text) {
  const cleaned = extractJsonObject(
    String(text ?? '')
      .trim()
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim(),
  )

  if (!cleaned) {
    const error = new Error('Gemini returned an empty response.')
    error.code = 'GEMINI_EMPTY_RESPONSE'
    error.status = 502
    throw error
  }

  try {
    return JSON.parse(cleaned)
  } catch {
    const error = new Error('Gemini returned malformed JSON.')
    error.code = 'GEMINI_MALFORMED_RESPONSE'
    error.status = 502
    throw error
  }
}

function baseIntent(message, previousIntent = null) {
  return {
    chartTitle: previousIntent?.chartTitle ?? 'Workforce Report',
    chartType: previousIntent?.chartType ?? 'bar',
    dateRange: previousIntent?.dateRange ?? { label: 'last 30 days' },
    filters: previousIntent?.filters ?? {},
    groupBy: previousIntent?.groupBy ?? 'shift_status',
    limit: previousIntent?.limit ?? 10,
    metrics: previousIntent?.metrics ?? ['shift_count'],
    reportType: previousIntent?.reportType ?? 'shift_status_summary',
    requiresClarification: false,
    sort: previousIntent?.sort ?? { direction: 'desc', field: 'shift_count' },
    understoodQuery: message,
  }
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase))
}

function createLookupDateRange(text) {
  if (text.includes('last month')) return { dateRange: { label: 'last month' }, dateRangeFilter: true }
  if (text.includes('this month')) return { dateRange: { label: 'this month' }, dateRangeFilter: true }
  if (text.includes('last week')) return { dateRange: { label: 'last week' }, dateRangeFilter: true }
  if (text.includes('this week')) return { dateRange: { label: 'this week' }, dateRangeFilter: true }
  if (text.includes('today')) return { dateRange: { label: 'today' }, dateRangeFilter: true }
  if (text.includes('yesterday')) return { dateRange: { label: 'yesterday' }, dateRangeFilter: true }
  if (text.includes('last 30 days')) return { dateRange: { label: 'last 30 days' }, dateRangeFilter: true }

  return { dateRange: { label: 'last 30 days' }, dateRangeFilter: false }
}

function inferLookupEntity(text) {
  if (/\bemp-\d{4}\b/i.test(text)) return 'employees'
  if (/\bcus-\d{3}\b/i.test(text)) return 'customers'
  if (/\bsite-\d{3}\b/i.test(text)) return 'sites'

  if (includesAny(text, ['attendance', 'attended', 'present', 'clock in', 'clock-in', 'clock out', 'clock-out'])) {
    return 'attendance'
  }

  if (includesAny(text, ['shift', 'shifts', 'schedule', 'scheduled'])) {
    return 'shifts'
  }

  if (includesAny(text, ['customer', 'customers', 'client', 'clients', 'industry'])) {
    return 'customers'
  }

  if (includesAny(text, ['site', 'sites', 'location', 'locations', 'address', 'city'])) {
    return 'sites'
  }

  if (includesAny(text, ['employee', 'employees', 'worker', 'workers', 'staff', 'email', 'pay rate', 'hourly', 'department', 'position'])) {
    return 'employees'
  }

  return null
}

function inferLookupColumns(entity, text) {
  if (entity === 'employees') {
    if (includesAny(text, ['email', 'mail'])) return ['employee_code', 'employee_name', 'email']
    if (includesAny(text, ['pay rate', 'hourly', 'salary', 'wage'])) {
      return ['employee_code', 'employee_name', 'department', 'position', 'hourly_pay_rate', 'status']
    }
    if (includesAny(text, ['department', 'position'])) {
      return ['employee_code', 'employee_name', 'department', 'position', 'status']
    }
  }

  if (entity === 'customers' && text.includes('industry')) {
    return ['customer_code', 'customer_name', 'industry', 'status']
  }

  if (entity === 'sites' && includesAny(text, ['address', 'city', 'location'])) {
    return ['site_code', 'site_name', 'customer_name', 'address', 'city', 'status']
  }

  if (entity === 'shifts') {
    return ['shift_date', 'shift_status', 'employee_name', 'customer_name', 'site_name', 'scheduled_start', 'scheduled_end']
  }

  if (entity === 'attendance') {
    return ['shift_date', 'employee_name', 'attendance_status', 'shift_status', 'clock_in_datetime', 'clock_out_datetime', 'actual_hours', 'late_minutes']
  }

  return []
}

function inferLookupFilters(entity, text) {
  const filters = {}

  if (['customers', 'employees', 'sites'].includes(entity)) {
    if (text.includes('inactive')) {
      filters.isActive = false
    } else if (text.includes('active')) {
      filters.isActive = true
    }
  }

  if (['attendance', 'shifts'].includes(entity)) {
    const statuses = []

    if (text.includes('completed')) statuses.push('Completed')
    if (text.includes('missed')) statuses.push('Missed')
    if (text.includes('unfilled')) statuses.push('Unfilled')
    if (text.includes('cancelled') || text.includes('canceled')) statuses.push('Cancelled')
    if (text.includes('scheduled')) statuses.push('Scheduled')
    if (text.includes('in progress')) statuses.push('In Progress')

    if (statuses.length) {
      filters.statuses = statuses
    }
  }

  if (entity === 'attendance') {
    const attendanceStatuses = []

    if (text.includes('late')) attendanceStatuses.push('Late')
    if (text.includes('present') || text.includes('attended')) {
      attendanceStatuses.push('Completed', 'Late', 'Clocked In')
    }
    if (text.includes('clocked in') || text.includes('clock-in')) attendanceStatuses.push('Clocked In')
    if (text.includes('not started')) attendanceStatuses.push('Not Started')
    if (text.includes('incomplete')) attendanceStatuses.push('Incomplete')

    if (attendanceStatuses.length) {
      filters.attendanceStatuses = [...new Set(attendanceStatuses)]
    }
  }

  return filters
}

function cleanSearchTerm(value = '') {
  return value
    .replace(/^(what\s+is|what's|who\s+is|show|give|tell\s+me|find|display|is)\s+/i, '')
    .replace(/\b(today|yesterday|this week|last week|this month|last month|last 30 days)\b/gi, '')
    .replace(/[?.!,]+$/g, '')
    .trim()
}

function isGenericSearchTerm(value) {
  return [
    'all',
    'all customers',
    'all employees',
    'all shifts',
    'all sites',
    'customer list',
    'customers',
    'employee list',
    'employees',
    'list',
    'records',
    'shifts',
    'site list',
    'sites',
  ].includes(String(value ?? '').toLowerCase())
}

function extractLookupSearch(entity, message) {
  const value = String(message ?? '')
  const quoted = value.match(/["']([^"']{2,80})["']/)

  if (quoted) {
    return cleanSearchTerm(quoted[1])
  }

  const possessive = value.match(/([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)'s\s+(?:email|pay rate|hourly|department|position)/i)

  if (possessive) {
    return cleanSearchTerm(possessive[1])
  }

  const patternsByEntity = {
    attendance: [
      /(?:attendance|clock(?:ed)?\s*in|clock(?:ed)?\s*out|present|attended)\s+(?:for|of|about)?\s*([a-z][a-z\s'-]{2,80})/i,
    ],
    customers: [
      /(?:customer|client)\s+(?:named\s+|called\s+)?([a-z][a-z\s'-]{2,80})/i,
      /(?:industry|details|info)\s+(?:for|of|about)\s+([a-z][a-z\s'-]{2,80})/i,
    ],
    employees: [
      /(?:employee|worker|staff)\s+(?:named\s+|called\s+)?([a-z][a-z\s'-]{2,80})/i,
      /(?:email|pay rate|hourly rate|details|info)\s+(?:for|of|about)\s+([a-z][a-z\s'-]{2,80})/i,
    ],
    shifts: [
      /(?:shift|shifts|schedule)\s+(?:for|of|about)\s+([a-z][a-z\s'-]{2,80})/i,
    ],
    sites: [
      /(?:site|location)\s+(?:named\s+|called\s+)?([a-z][a-z\s'-]{2,80})/i,
      /(?:address|details|info)\s+(?:for|of|about)\s+([a-z][a-z\s'-]{2,80})/i,
    ],
  }

  for (const pattern of patternsByEntity[entity] ?? []) {
    const match = value.match(pattern)

    if (match) {
      const term = cleanSearchTerm(match[1])

      if (term && !isGenericSearchTerm(term)) {
        return term
      }
    }
  }

  return null
}

function addCodeFilters(entity, message, filters) {
  const employeeCode = String(message ?? '').match(/\bEMP-\d{4}\b/i)
  const customerCode = String(message ?? '').match(/\bCUS-\d{3}\b/i)
  const siteCode = String(message ?? '').match(/\bSITE-\d{3}\b/i)

  if (entity === 'employees' && employeeCode) filters.employeeCode = employeeCode[0].toUpperCase()
  if (entity === 'customers' && customerCode) filters.customerCode = customerCode[0].toUpperCase()
  if (entity === 'sites' && siteCode) filters.siteCode = siteCode[0].toUpperCase()
}

function createDataLookupIntent(message) {
  const text = String(message ?? '').toLowerCase()
  const entity = inferLookupEntity(text)

  if (!entity) return null

  // Never use data_lookup for analytics/performance/comparison queries
  const isAnalyticsQuery = includesAny(text, [
    'who has done', 'who did', 'who worked', 'who has more', 'done more',
    'done less', 'performance', 'trend', 'graph', 'chart', 'compare',
    'comparison', 'top ', 'most ', 'least ', 'highest', 'lowest',
    'how many shifts', 'shift count', 'completed shift', 'missed shift',
    'hours worked', 'actual hours', 'overtime', 'late clock',
    'revenue', 'wages', 'profit', 'fill rate', 'completion rate',
    'by employee', 'by site', 'by department', 'by customer', 'by week', 'by month',
  ])

  if (isAnalyticsQuery) return null

  const lookupMode = includesAny(text, ['how many', 'count', 'number of']) ? 'count' : 'list'
  const { dateRange, dateRangeFilter } = createLookupDateRange(text)
  const asksForSingleTopRecord = includesAny(text, ['highest', 'lowest', 'least', 'maximum', 'minimum', 'max ', 'min '])
  const filters = inferLookupFilters(entity, text)
  const search = asksForSingleTopRecord ? null : extractLookupSearch(entity, message)

  addCodeFilters(entity, message, filters)

  let sort = { direction: 'asc', field: 'record_count' }

  if (entity === 'employees') {
    sort = { direction: 'asc', field: 'employee_name' }

    if (includesAny(text, ['pay rate', 'hourly', 'salary', 'wage'])) {
      sort = { direction: includesAny(text, ['lowest', 'least', 'minimum', 'min']) ? 'asc' : 'desc', field: 'hourly_pay_rate' }
    }
  } else if (entity === 'customers') {
    sort = { direction: 'asc', field: 'customer_name' }
  } else if (entity === 'sites') {
    sort = { direction: 'asc', field: 'site_name' }
  } else if (entity === 'shifts' || entity === 'attendance') {
    sort = { direction: 'desc', field: 'shift_date' }
  }

  const groupByByEntity = {
    attendance: 'attendance_status',
    customers: 'customer',
    employees: 'employee',
    shifts: 'shift_status',
    sites: 'site',
  }

  return {
    chartTitle: 'Database Lookup',
    chartType: 'bar',
    columns: inferLookupColumns(entity, text),
    dateRange,
    dateRangeFilter,
    entity,
    filters,
    groupBy: groupByByEntity[entity] ?? 'employee',
    limit: lookupMode === 'count' || asksForSingleTopRecord ? 1 : 100,
    lookupMode,
    metrics: ['record_count'],
    reportType: 'data_lookup',
    requiresClarification: false,
    search,
    sort,
    understoodQuery: message,
  }
}

function createFallbackIntent(message, previousIntent = null) {
  const text = String(message ?? '').toLowerCase()
  const dataLookupIntent = createDataLookupIntent(message)

  if (dataLookupIntent) {
    return dataLookupIntent
  }

  const intent = baseIntent(message, previousIntent)

  if (
    text.includes('all employees') ||
    text.includes('list employees') ||
    text.includes('list of employees') ||
    text.includes('employee list') ||
    text.includes('show employees')
  ) {
    return {
      ...intent,
      chartTitle: 'Employee Directory',
      chartType: 'bar',
      dateRange: { label: 'last 30 days' },
      groupBy: 'employee',
      limit: 100,
      metrics: ['employee_count'],
      reportType: 'employee_directory',
      sort: { direction: 'asc', field: 'employee_name' },
    }
  }

  if (text.includes('last month')) {
    intent.dateRange = { label: 'last month' }
  } else if (text.includes('this month')) {
    intent.dateRange = { label: 'this month' }
  } else if (text.includes('today')) {
    intent.dateRange = { label: 'today' }
  }

  if (text.includes('week')) {
    intent.groupBy = 'week'
    intent.chartType = intent.chartType === 'pie' ? 'bar' : intent.chartType
  }

  if (text.includes('pie')) {
    intent.chartType = 'pie'
  } else if (text.includes('line') || text.includes('trend')) {
    intent.chartType = 'line'
  }

  if (text.includes('top five') || text.includes('top 5')) {
    intent.limit = 5
  }

  if (text.includes('present') || text.includes('attended') || text.includes('attendance')) {
    intent.reportType = 'shift_status_summary'
    intent.groupBy = text.includes('employee') || text.includes('who') ? 'shift_status' : intent.groupBy
    intent.metrics = ['shift_count', 'completed_count', 'missed_count']
    intent.sort = { direction: 'desc', field: 'shift_count' }
    intent.chartTitle = text.includes('today') ? 'Today Attendance Summary' : 'Attendance Summary'
  }

  if (text.includes('actual hour') || text.includes('rostered hour') || text.includes('overtime')) {
    intent.reportType = 'employee_hours'
    intent.groupBy = text.includes('week') ? 'week' : 'employee'
    intent.metrics = text.includes('rostered')
      ? ['rostered_hours', 'actual_hours']
      : ['actual_hours']
    intent.sort = { direction: 'desc', field: intent.metrics.at(-1) }
    intent.chartTitle = 'Actual Hours by Employee'
  }

  if (text.includes('completed') || text.includes('missed') || text.includes('shift-status') || text.includes('shift status')) {
    intent.reportType = 'shift_status_summary'
    intent.groupBy = text.includes('week') ? 'week' : 'shift_status'
    intent.metrics = text.includes('completed') || text.includes('missed')
      ? ['completed_count', 'missed_count']
      : ['shift_count']
    intent.sort = { direction: 'desc', field: 'shift_count' }
    intent.chartTitle = 'Shift Status Summary'
  }

  // "who has done more shifts", "shift count by employee", "employee shift performance"
  if (
    includesAny(text, ['who has done', 'who did', 'done more', 'shift count', 'shift by employee', 'employee shift']) ||
    (text.includes('shift') && includesAny(text, ['employee', 'worker', 'staff', 'who']))
  ) {
    intent.reportType = 'employee_shift_count'
    intent.groupBy = 'employee'
    intent.metrics = ['shift_count', 'completed_count', 'missed_count']
    intent.sort = { direction: 'desc', field: 'shift_count' }
    intent.chartTitle = 'Shift Count by Employee'
    intent.chartType = 'bar'
  }

  if (text.includes('late')) {
    intent.reportType = 'late_clock_ins'
    intent.groupBy = 'employee'
    intent.metrics = ['late_count', 'late_minutes']
    intent.sort = { direction: 'desc', field: 'late_count' }
    intent.chartTitle = 'Late Clock Ins by Employee'
  }

  if (text.includes('revenue') || text.includes('wages') || text.includes('gross profit')) {
    intent.reportType = 'financial_summary'
    intent.groupBy = text.includes('month') ? 'month' : 'customer'
    intent.metrics = ['revenue', 'wages', 'gross_profit']
    intent.sort = { direction: 'desc', field: 'revenue' }
    intent.chartType = text.includes('month') ? 'line' : 'bar'
    intent.chartTitle = 'Revenue, Wages and Gross Profit'
  }

  if (text.includes('currently clocked') || text.includes('clocked-in') || text.includes('clocked in')) {
    intent.reportType = 'currently_clocked_in'
    intent.groupBy = 'employee'
    intent.metrics = ['shift_count', 'actual_hours']
    intent.sort = { direction: 'desc', field: 'shift_count' }
    intent.chartTitle = 'Currently Clocked-In Employees'
  }

  if (text.includes('site') && text.includes('missed')) {
    intent.reportType = 'missed_shifts'
    intent.groupBy = 'site'
    intent.metrics = ['missed_count']
    intent.sort = { direction: 'desc', field: 'missed_count' }
    intent.chartTitle = 'Missed Shifts by Site'
  }

  return intent
}

function createDeterministicIntent(message, previousIntent = null) {
  const text = String(message ?? '').toLowerCase()
  const dataLookupIntent = createDataLookupIntent(message)

  if (dataLookupIntent) {
    return dataLookupIntent
  }

  // "who has done more shifts / this week shifts by employee" → employee_shift_count
  if (
    includesAny(text, ['who has done', 'who did', 'done more', 'done less']) ||
    (text.includes('shift') && includesAny(text, ['who ', 'employee', 'worker', 'staff']) && !text.includes('status'))
  ) {
    const dateRange = text.includes('this week') ? { label: 'this week' }
      : text.includes('last week') ? { label: 'last week' }
      : text.includes('this month') ? { label: 'this month' }
      : { label: 'last 30 days' }

    return {
      chartTitle: 'Shift Count by Employee',
      chartType: 'bar',
      dateRange,
      filters: {},
      groupBy: 'employee',
      limit: 20,
      metrics: ['shift_count', 'completed_count', 'missed_count'],
      reportType: 'employee_shift_count',
      requiresClarification: false,
      sort: { direction: 'desc', field: 'shift_count' },
      understoodQuery: message,
    }
  }

  if (
    text.includes('all employees') ||
    text.includes('list employees') ||
    text.includes('list of employees') ||
    text.includes('employee list') ||
    text.includes('show employees')
  ) {
    return createFallbackIntent(message, null)
  }

  if (
    text.includes('present today') ||
    text.includes('attendance today') ||
    text.includes('who attended today') ||
    text.includes('who were present')
  ) {
    return createFallbackIntent(message, previousIntent)
  }

  return null
}

function assertConfigured() {
  const client = getGeminiClient()

  if (!client) {
    const error = new Error('Gemini is not configured. Add GEMINI_API_KEY in backend/.env.')
    error.code = 'GEMINI_NOT_CONFIGURED'
    error.status = 503
    error.expose = true
    throw error
  }

  return client
}

export async function generateReportIntent({ context, message, previousIntent }) {
  const deterministicIntent = createDeterministicIntent(message, previousIntent)

  if (deterministicIntent) {
    return deterministicIntent
  }

  const client = assertConfigured()
  const prompt = buildIntentPrompt({ context, message, previousIntent })

  try {
    const response = await client.models.generateContent({
      contents: prompt,
      model: env.geminiModel,
      config: {
        responseMimeType: 'application/json',
      },
    })

    try {
      return parseJsonText(response.text)
    } catch (error) {
      if (error.code === 'GEMINI_EMPTY_RESPONSE' || error.code === 'GEMINI_MALFORMED_RESPONSE') {
        logger.warn('Using fallback report intent because Gemini returned invalid JSON.', {
          message: error.message,
        })

        return createFallbackIntent(message, previousIntent)
      }

      throw error
    }
  } catch (error) {
    if (error.code?.startsWith?.('GEMINI_')) {
      throw error
    }

    logger.warn('Gemini intent request failed.', {
      message: error.message,
    })

    return createFallbackIntent(message, previousIntent)
  }
}

export async function generateResultSummary(payload) {
  const client = getGeminiClient()

  if (!client) {
    return null
  }

  try {
    const response = await client.models.generateContent({
      contents: buildSummaryPrompt(payload),
      model: env.geminiModel,
    })

    return String(response.text ?? '').trim() || null
  } catch (error) {
    logger.warn('Gemini summary request failed.', {
      message: error.message,
    })
    return null
  }
}
