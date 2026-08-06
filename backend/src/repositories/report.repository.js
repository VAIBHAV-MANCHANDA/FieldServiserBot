import { query } from '../config/database.js'
import { listEmployees } from './employee.repository.js'
import { getDataLookupEntity } from '../services/reports/dataLookupRegistry.js'

const GROUP_SQL = {
  attendance_status: { label: 'attendance_status', sql: 'attendance_status' },
  customer: { label: 'customer_name', sql: 'customer_name' },
  date: { label: 'date', sql: 'shift_date' },
  day: { label: 'day', sql: 'DATE_FORMAT(shift_date, "%Y-%m-%d")' },
  department: { label: 'department', sql: 'department' },
  employee: { label: 'employee_name', sql: 'employee_name' },
  month: { label: 'month', sql: 'DATE_FORMAT(shift_date, "%Y-%m")' },
  position: { label: 'position', sql: 'position' },
  shift_status: { label: 'shift_status', sql: 'shift_status' },
  site: { label: 'site_name', sql: 'site_name' },
  week: { label: 'week', sql: 'DATE_FORMAT(shift_date, "%x-W%v")' },
}

const METRIC_SQL = {
  actual_hours: 'ROUND(SUM(actual_hours), 2)',
  cancelled_count: 'SUM(shift_status = "Cancelled")',
  completed_count: 'SUM(shift_status = "Completed")',
  completion_rate: 'ROUND(SUM(shift_status = "Completed") / NULLIF(COUNT(*), 0) * 100, 2)',
  early_leave_minutes: 'SUM(early_leave_minutes)',
  fill_rate: 'ROUND(SUM(shift_status NOT IN ("Unfilled", "Cancelled")) / NULLIF(COUNT(*), 0) * 100, 2)',
  gross_margin_percentage: 'ROUND(SUM(gross_profit) / NULLIF(SUM(revenue), 0) * 100, 2)',
  gross_profit: 'ROUND(SUM(gross_profit), 2)',
  late_count: 'SUM(late_minutes > 0)',
  late_minutes: 'SUM(late_minutes)',
  missed_count: 'SUM(shift_status = "Missed")',
  overtime_hours: 'ROUND(SUM(overtime_hours), 2)',
  revenue: 'ROUND(SUM(revenue), 2)',
  rostered_hours: 'ROUND(SUM(rostered_hours), 2)',
  shift_count: 'COUNT(*)',
  unfilled_count: 'SUM(shift_status = "Unfilled")',
  wages: 'ROUND(SUM(wages), 2)',
}

const BASE_VIEWS = {
  attendance: 'vw_ai_attendance_exceptions',
  employee: 'vw_ai_employee_hours',
  financial: 'vw_ai_financial_summary',
  shift: 'vw_ai_shift_summary',
}

const EXACT_LOOKUP_FILTERS = new Set([
  'attendanceStatuses',
  'customerCode',
  'customerId',
  'employeeCode',
  'employeeId',
  'isActive',
  'siteCode',
  'siteId',
  'statuses',
])

function buildWhere(intent, params) {
  const clauses = ['shift_date BETWEEN ? AND ?']
  params.push(intent.dateRange.from, intent.dateRange.to)

  const filters = intent.filters ?? {}

  if (filters.department) {
    clauses.push('department = ?')
    params.push(filters.department)
  }

  if (filters.position) {
    clauses.push('position = ?')
    params.push(filters.position)
  }

  if (filters.customer) {
    clauses.push('customer_name = ?')
    params.push(filters.customer)
  }

  if (filters.site) {
    clauses.push('site_name = ?')
    params.push(filters.site)
  }

  if (filters.employee) {
    clauses.push('employee_name = ?')
    params.push(filters.employee)
  }

  if (filters.employeeId) {
    clauses.push('employee_id = ?')
    params.push(filters.employeeId)
  }

  if (filters.customerId) {
    clauses.push('customer_id = ?')
    params.push(filters.customerId)
  }

  if (filters.siteId) {
    clauses.push('site_id = ?')
    params.push(filters.siteId)
  }

  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    clauses.push(`shift_status IN (${filters.statuses.map(() => '?').join(', ')})`)
    params.push(...filters.statuses)
  }

  if (Array.isArray(filters.attendanceStatuses) && filters.attendanceStatuses.length > 0) {
    clauses.push(`attendance_status IN (${filters.attendanceStatuses.map(() => '?').join(', ')})`)
    params.push(...filters.attendanceStatuses)
  }

  return clauses.join(' AND ')
}

async function runAggregateReport(intent, viewName) {
  const params = []
  const group = GROUP_SQL[intent.groupBy] ?? GROUP_SQL.shift_status
  const metrics = intent.metrics.filter((metric) => METRIC_SQL[metric])
  const selects = [`${group.sql} AS ${group.label}`, ...metrics.map((metric) => `${METRIC_SQL[metric]} AS ${metric}`)]
  const where = buildWhere(intent, params)
  const sortField = metrics.includes(intent.sort?.field) || intent.sort?.field === group.label
    ? intent.sort.field
    : metrics[0]
  const direction = intent.sort?.direction === 'asc' ? 'ASC' : 'DESC'
  const limit = Math.max(1, Math.min(Number(intent.limit) || 10, 100))

  const rows = await query(
    `SELECT ${selects.join(', ')}
     FROM ${viewName}
     WHERE ${where}
     GROUP BY ${group.sql}
     ORDER BY ${sortField} ${direction}
     LIMIT ${limit}`,
    params,
  )

  return {
    groupKey: group.label,
    rows,
  }
}

async function runCurrentlyClockedInReport(intent) {
  const nextIntent = {
    ...intent,
    filters: {
      ...(intent.filters ?? {}),
      attendanceStatuses: ['Clocked In'],
    },
    groupBy: intent.groupBy === 'employee' ? 'employee' : intent.groupBy,
    metrics: ['shift_count', 'actual_hours'],
    sort: { direction: 'desc', field: 'shift_count' },
  }

  return runAggregateReport(nextIntent, BASE_VIEWS.attendance)
}

async function runEmployeeDirectoryReport(intent) {
  const rows = await listEmployees()
  const limit = Math.max(1, Math.min(Number(intent.limit) || 100, 100))

  return {
    groupKey: 'employee_name',
    rows: rows.slice(0, limit).map((employee) => ({
      ...employee,
      employee_count: 1,
      status: employee.is_active ? 'Active' : 'Inactive',
    })),
  }
}

function createColumnMap(definition) {
  return new Map(definition.columns.map((column) => [column.key, column]))
}

function selectLookupColumns(definition, requestedColumns = []) {
  const columnMap = createColumnMap(definition)
  const selectedKeys = requestedColumns.filter((column) => columnMap.has(column))
  const keys = selectedKeys.length ? selectedKeys : definition.defaultColumns

  return keys.map((key) => columnMap.get(key))
}

function getLookupSortExpression(definition, sort = {}) {
  const columnMap = createColumnMap(definition)
  const requestedColumn = columnMap.get(sort.field)
  const defaultColumn = columnMap.get(definition.defaultSort.field) ?? definition.columns[0]

  return {
    direction: sort.direction === 'desc' ? 'DESC' : 'ASC',
    expression: requestedColumn?.expression ?? defaultColumn.expression,
  }
}

function addLookupFilter({ clauses, column, key, params, value }) {
  if (Array.isArray(value)) {
    const values = value.filter(Boolean)

    if (!values.length) return

    clauses.push(`${column} IN (${values.map(() => '?').join(', ')})`)
    params.push(...values)
    return
  }

  if (value === null || value === undefined || value === '') {
    return
  }

  if (typeof value === 'boolean') {
    clauses.push(`${column} = ?`)
    params.push(value ? 1 : 0)
    return
  }

  if (typeof value === 'number' || EXACT_LOOKUP_FILTERS.has(key)) {
    clauses.push(`${column} = ?`)
    params.push(value)
    return
  }

  clauses.push(`${column} LIKE ?`)
  params.push(`%${value}%`)
}

function buildLookupWhere(definition, intent, params) {
  const clauses = []
  const filters = intent.filters ?? {}

  if (intent.dateRangeFilter && definition.dateColumn) {
    clauses.push(`${definition.dateColumn} BETWEEN ? AND ?`)
    params.push(intent.dateRange.from, intent.dateRange.to)
  }

  for (const [key, column] of Object.entries(definition.filterColumns)) {
    addLookupFilter({
      clauses,
      column,
      key,
      params,
      value: filters[key],
    })
  }

  if (intent.search) {
    clauses.push(`(${definition.searchColumns.map((column) => `${column} LIKE ?`).join(' OR ')})`)
    params.push(...definition.searchColumns.map(() => `%${intent.search}%`))
  }

  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
}

async function runDataLookupReport(intent) {
  const definition = getDataLookupEntity(intent.entity) ?? getDataLookupEntity('employees')
  const params = []
  const where = buildLookupWhere(definition, intent, params)
  const [{ record_count: recordCount }] = await query(
    `SELECT COUNT(*) AS record_count ${definition.baseSql} ${where}`,
    params,
  )

  const columns = selectLookupColumns(definition, intent.columns)
  const limit = Math.max(1, Math.min(Number(intent.limit) || 25, 100))
  const sort = getLookupSortExpression(definition, intent.sort)
  const rows = intent.lookupMode === 'count'
    ? []
    : await query(
        `SELECT ${columns.map((column) => `${column.expression} AS ${column.key}`).join(', ')}
         ${definition.baseSql}
         ${where}
         ORDER BY ${sort.expression} ${sort.direction}
         LIMIT ${limit}`,
        params,
      )
  const message = intent.lookupMode !== 'count' && rows.length > 0 && rows.length < Number(recordCount)
    ? `Showing ${rows.length} of ${recordCount} ${definition.label.toLowerCase()}.`
    : `${definition.label}: ${recordCount}.`

  return {
    columns: columns.map(({ format, key, label }) => ({ format, key, label })),
    groupKey: 'record_count',
    message,
    rows,
    summaryCards: [
      {
        format: 'number',
        label: definition.label,
        value: Number(recordCount) || 0,
      },
    ],
  }
}

export const reportRepository = {
  getAttendanceExceptions: (intent) => runAggregateReport(intent, BASE_VIEWS.attendance),
  getCurrentlyClockedIn: (intent) => runCurrentlyClockedInReport(intent),
  getCustomerPerformance: (intent) => runAggregateReport(intent, BASE_VIEWS.financial),
  getDataLookup: (intent) => runDataLookupReport(intent),
  getEmployeeDirectory: (intent) => runEmployeeDirectoryReport(intent),
  getEmployeeHours: (intent) => runAggregateReport(intent, BASE_VIEWS.employee),
  getEmployeeShiftCount: (intent) => runAggregateReport(intent, BASE_VIEWS.shift),
  getFinancialSummary: (intent) => runAggregateReport(intent, BASE_VIEWS.financial),
  getLateClockIns: async (intent) => {
    const nextIntent = {
      ...intent,
      filters: {
        ...(intent.filters ?? {}),
        attendanceStatuses: ['Late'],
      },
      metrics: intent.metrics.length ? intent.metrics : ['late_count', 'late_minutes'],
    }
    return runAggregateReport(nextIntent, BASE_VIEWS.attendance)
  },
  getMissedShifts: async (intent) => {
    const nextIntent = {
      ...intent,
      filters: {
        ...(intent.filters ?? {}),
        statuses: ['Missed'],
      },
      metrics: intent.metrics.length ? intent.metrics : ['missed_count'],
    }
    return runAggregateReport(nextIntent, BASE_VIEWS.shift)
  },
  getOvertimeSummary: (intent) => runAggregateReport(intent, BASE_VIEWS.employee),
  getShiftStatusSummary: (intent) => runAggregateReport(intent, BASE_VIEWS.shift),
  getShiftTrend: (intent) => runAggregateReport(intent, BASE_VIEWS.shift),
  getSitePerformance: (intent) => runAggregateReport(intent, BASE_VIEWS.financial),
}

export async function logAiQuery({
  errorMessage = null,
  executionTimeMs = 0,
  intent = null,
  reportType = null,
  resultCount = 0,
  sessionId = null,
  status,
  userMessage,
}) {
  await query(
    `INSERT INTO ai_query_logs
      (session_id, user_message, report_type, intent_json, result_count, execution_time_ms, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      userMessage,
      reportType,
      intent ? JSON.stringify(intent) : null,
      resultCount,
      executionTimeMs,
      status,
      errorMessage,
    ],
  )
}
