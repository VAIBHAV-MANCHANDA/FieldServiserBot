/**
 * Report Repository powered by the FieldServicer API.
 * Live API records are normalized and aggregated in memory into the
 * shape expected by report.service.js.
 */

import { fieldServicerClient } from '../config/fieldservicer.js'
import { logger } from '../utils/logger.js'
import { resolveDateRange } from '../utils/dateRange.js'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getDateRange(intent) {
  const label = intent.dateRange?.label
  const explicitFrom = intent.dateRange?.from
  const explicitTo = intent.dateRange?.to

  if (explicitFrom && explicitTo) return { from: explicitFrom, to: explicitTo }

  const resolved = resolveDateRange({ label: label || 'last 30 days' })
  return { from: resolved.from, to: resolved.to }
}

// ─── Fetch shifts from FieldServicer API ─────────────────────────────────────

async function fetchShifts(intent, { forceRefresh = false } = {}) {
  const { from, to } = getDateRange(intent)
  try {
    const raw = await fieldServicerClient.getRosterShiftList({
      locationId: intent.filters?.siteId ?? 0,
      clientId: intent.filters?.customerId ?? 0,
      fromDate: from,
      toDate: to,
      forceRefresh,
    })
    return normalizeShifts(raw)
  } catch (error) {
    logger.error('Failed to fetch shifts from FieldServicer API', { error: error.message })
    const upstreamError = new Error('Unable to load live shift data from FieldServicer.')
    upstreamError.code = 'FIELDSERVICER_API_ERROR'
    upstreamError.status = 502
    upstreamError.expose = true
    upstreamError.cause = error
    throw upstreamError
  }
}

/**
 * Normalize RosterShiftList API response to internal field names.
 *
 * Real API fields (confirmed from live response):
 *   ShiftID, Dated, DatedStr, Dated_Name, StartTime, EndTime,
 *   Break_Minute, Total_Hours, Site_Hours, EmployeeName, EmployeeID,
 *   LocationID, Location_Name, Status_Title, Status_BgColor, Status_TxtColor,
 *   StatusID, ShiftType, ShiftTypeID, SupplierName, IsBreakConflict,
 *   IsOverlapConflict, IsComplianceCritical, IsVisaPassportCritical, etc.
 *
 * Status definitions confirmed from the FieldServicer status reference.
 * StatusID is authoritative; response title/color fields are fallbacks for
 * IDs not yet present in this map.
 */
const STATUS_DEFINITIONS = {
  1: { title: 'Unpublish', bgColor: '#fff4b3', txtColor: 'Black' },
  2: { title: 'Published', bgColor: '#fffe42', txtColor: 'Black' },
  3: { title: 'Clocked-In', bgColor: '#23d06c', txtColor: 'Black' },
  4: { title: 'Clocked-Out', bgColor: '#697390', txtColor: 'Black' },
  5: { title: 'Approved', bgColor: '#9ccf7a', txtColor: 'Black' },
  6: { title: 'Rejected', bgColor: '#e42048', txtColor: 'Black' },
  7: { title: 'Deleted', bgColor: '#ffae42', txtColor: 'Black' },
  9: { title: 'UnAssigned', bgColor: '#ee82ee', txtColor: 'Black' },
  10: { title: 'Submitted', bgColor: '#697390', txtColor: 'Black' },
  11: { title: 'Accepted', bgColor: '#9ccf7a', txtColor: 'Black' },
  12: { title: 'Clocked-Out', bgColor: '#697390', txtColor: 'Black' },
}

// Map raw statuses → analytics categories used by the report engine
const ANALYTICS_STATUS_MAP = {
  'Clocked-In':  'Completed',
  'Clocked-Out': 'Completed',
  'Approved':    'Completed',
  'Accepted':    'Completed',
  'Submitted':   'Scheduled',
  'Published':   'Scheduled',
  'Pending':     'Scheduled',
  'Unpublish':   'Unfilled',
  'UnAssigned':  'Unfilled',
  'Rejected':    'Missed',
  'Deleted':     'Cancelled',
}

function normalizeShifts(raw) {
  return raw.map(s => {
    const statusId = Number(s.StatusID)
    const statusDefinition = STATUS_DEFINITIONS[statusId]
    const rawStatus = statusDefinition?.title ?? s.Status_Title ?? 'Unknown'
    const statusBgColor = statusDefinition?.bgColor ?? s.Status_BgColor ?? null
    const statusTxtColor = statusDefinition?.txtColor ?? s.Status_TxtColor ?? null
    const shiftStatus = ANALYTICS_STATUS_MAP[rawStatus] ?? rawStatus

    // Total_Hours is provided directly by the API — no calculation needed
    const totalHours = parseFloat(s.Total_Hours ?? 0)

    // Clocked-In / Clocked-Out shifts have actual hours = Total_Hours
    // Other statuses: actual hours = 0 (not yet worked)
    const isWorked = ['Clocked-In', 'Clocked-Out', 'Approved', 'Accepted'].includes(rawStatus)
    const actualHours = isWorked ? totalHours : 0

    // Date: use Dated field (ISO string), fall back to DatedStr
    const shiftDate = s.Dated
      ? s.Dated.split('T')[0]
      : s.DatedStr ?? null

    return {
      // IDs
      shift_id:    s.ShiftID,
      employee_id: s.EmployeeID,
      site_id:     s.LocationID,
      customer_id: null, // not in this endpoint

      // Names
      employee_name: String(s.EmployeeName ?? '').trim() || 'Unassigned',
      site_name:     s.Location_Name ?? 'Unknown',
      customer_name: s.SupplierName ?? 'Unknown',  // SupplierName = client/company
      department:    s.ShiftType ?? 'Work',         // closest available grouping
      position:      s.ShiftType ?? 'Staff',

      // Dates
      shift_date: shiftDate,
      month:      shiftDate ? shiftDate.slice(0, 7) : 'Unknown',
      week:       weekKey(shiftDate),
      day_name:   s.Dated_Name ?? null,

      // Status
      status_id:          Number.isFinite(statusId) ? statusId : null,
      shift_status:      shiftStatus,
      raw_status:        rawStatus,
      status_bg_color:   statusBgColor,
      status_txt_color:  statusTxtColor,
      attendance_status: deriveAttendanceStatus(shiftStatus, rawStatus),

      // Times (stored as "HH:MM" strings in the API)
      scheduled_start: s.StartTime ?? null,
      scheduled_end:   s.EndTime ?? null,
      break_minutes:   parseInt(s.Break_Minute ?? 0, 10),

      // Hours — from API directly
      rostered_hours:      totalHours,
      actual_hours:        actualHours,
      site_hours:          parseFloat(s.Site_Hours ?? 0),

      // Financials — not in this endpoint, default to 0

      // Conflict flags
      is_break_conflict:   s.IsBreakConflict === 1,
      is_overlap_conflict: s.IsOverlapConflict === 1,
      is_compliance_critical: s.IsComplianceCritical === true,
      is_visa_critical:    s.IsVisaPassportCritical === true,
    }
  })
}

function deriveAttendanceStatus(shiftStatus, rawStatus) {
  if (rawStatus === 'Clocked-In')  return 'Clocked In'
  if (rawStatus === 'Clocked-Out') return 'Clocked Out'
  if (shiftStatus === 'Completed') return 'Completed'
  if (shiftStatus === 'Missed')    return 'Missed'
  if (shiftStatus === 'Scheduled') return 'Not Started'
  return shiftStatus
}

function monthKey(date) {
  if (!date) return 'Unknown'
  return String(date).slice(0, 7)
}

function weekKey(date) {
  if (!date) return 'Unknown'
  const d = new Date(date)
  const year = d.getFullYear()
  const start = new Date(year, 0, 1)
  const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

export function matchesLookupText(actualValue, requestedValue) {
  const actual = normalizeSearchText(actualValue)
  const requested = normalizeSearchText(requestedValue)
  if (!actual || !requested) return false
  if (actual.includes(requested) || requested.includes(actual)) return true

  const tolerance = Math.max(1, Math.floor(Math.max(actual.length, requested.length) * 0.22))
  return editDistance(actual, requested) <= tolerance
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function applyFilters(shifts, intent) {
  const f = intent.filters ?? {}
  return shifts.filter(s => {
    if (f.employeeId !== undefined && f.employeeId !== null && s.employee_id !== f.employeeId) return false
    if (f.department && s.department !== f.department) return false
    if (f.position && s.position !== f.position) return false
    if (f.customer && !matchesLookupText(s.customer_name, f.customer)) return false
    if (f.site && !matchesLookupText(s.site_name, f.site)) return false
    if (f.siteId !== undefined && f.siteId !== null && s.site_id !== f.siteId) return false
    if (f.employee && !matchesLookupText(s.employee_name, f.employee)) return false
    if (f.statusIds?.length && !f.statusIds.includes(s.status_id)) return false
    if (f.statuses?.length && !f.statuses.includes(s.shift_status)) return false
    if (f.attendanceStatuses?.length && !f.attendanceStatuses.includes(s.attendance_status)) return false
    return true
  })
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

const GROUP_KEY_MAP = {
  attendance_status: 'attendance_status',
  customer: 'customer_name',
  date: 'shift_date',
  day: 'shift_date',
  department: 'department',
  employee: 'employee_name',
  month: 'month',
  position: 'position',
  shift_status: 'shift_status',
  site: 'site_name',
  week: 'week',
}

const METRIC_AGGREGATORS = {
  actual_hours: rows => round(rows.reduce((s, r) => s + (r.actual_hours ?? 0), 0)),
  cancelled_count: rows => rows.filter(r => r.shift_status === 'Cancelled').length,
  completed_count: rows => rows.filter(r => r.shift_status === 'Completed').length,
  completion_rate: rows => {
    const total = rows.length
    if (!total) return 0
    return round(rows.filter(r => r.shift_status === 'Completed').length / total * 100)
  },
  fill_rate: rows => {
    const total = rows.length
    if (!total) return 0
    const filled = rows.filter(r => !['Unfilled', 'Cancelled'].includes(r.shift_status)).length
    return round(filled / total * 100)
  },
  missed_count: rows => rows.filter(r => r.shift_status === 'Missed').length,
  rostered_hours: rows => round(rows.reduce((s, r) => s + (r.rostered_hours ?? 0), 0)),
  shift_count: rows => rows.length,
  unfilled_count: rows => rows.filter(r => r.shift_status === 'Unfilled').length,
}

function round(n) { return Math.round(n * 100) / 100 }

function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0
  return round((current - previous) / previous * 100)
}

function shiftSummary(rows) {
  const total = rows.length
  const completed = rows.filter(row => row.shift_status === 'Completed').length
  const scheduled = rows.filter(row => row.shift_status === 'Scheduled').length
  const missed = rows.filter(row => row.shift_status === 'Missed').length
  const unfilled = rows.filter(row => row.shift_status === 'Unfilled').length
  const cancelled = rows.filter(row => row.shift_status === 'Cancelled').length

  return {
    actual_hours: round(rows.reduce((sum, row) => sum + row.actual_hours, 0)),
    cancelled,
    clocked_in: rows.filter(row => row.raw_status === 'Clocked-In').length,
    clocked_out: rows.filter(row => row.raw_status === 'Clocked-Out').length,
    completed,
    completion_rate: total ? round(completed / total * 100) : 0,
    fill_rate: total ? round((total - unfilled - cancelled) / total * 100) : 0,
    missed,
    rostered_hours: round(rows.reduce((sum, row) => sum + row.rostered_hours, 0)),
    scheduled,
    total,
    unfilled,
  }
}

function groupDashboardRows(rows, key, labelKey) {
  const groups = new Map()

  for (const row of rows) {
    const label = row[key] || 'Unknown'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(row)
  }

  return [...groups.entries()].map(([label, groupRows]) => {
    const summary = shiftSummary(groupRows)
    return {
      [labelKey]: label,
      ...summary,
      completed_count: summary.completed,
      missed_count: summary.missed,
      scheduled_count: summary.scheduled,
      shift_count: summary.total,
      unfilled_count: summary.unfilled,
      break_conflicts: groupRows.filter(row => row.is_break_conflict).length,
      compliance_critical: groupRows.filter(row => row.is_compliance_critical).length,
      overlap_conflicts: groupRows.filter(row => row.is_overlap_conflict).length,
      visa_critical: groupRows.filter(row => row.is_visa_critical).length,
    }
  })
}

function addDaysToDateOnly(value, days) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function getDashboardSnapshot({ forceRefresh = false, from, to }) {
  const rangeDays = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1
  const previousTo = addDaysToDateOnly(from, -1)
  const previousFrom = addDaysToDateOnly(previousTo, -(rangeDays - 1))
  const allRows = await fetchShifts({
    dateRange: { from: previousFrom, to },
    filters: {},
  }, { forceRefresh })

  const currentRows = allRows.filter(row => row.shift_date >= from && row.shift_date <= to)
  const previousRows = allRows.filter(row => row.shift_date >= previousFrom && row.shift_date <= previousTo)
  const current = shiftSummary(currentRows)
  const previous = shiftSummary(previousRows)

  const employeeComparison = groupDashboardRows(
    currentRows.filter(row => row.employee_name !== 'Unassigned'),
    'employee_name',
    'employee',
  ).sort((a, b) => b.shift_count - a.shift_count || b.rostered_hours - a.rostered_hours)

  const siteComparison = groupDashboardRows(currentRows, 'site_name', 'site')
    .sort((a, b) => b.shift_count - a.shift_count)

  const shiftTrend = groupDashboardRows(currentRows, 'shift_date', 'date')
    .sort((a, b) => a.date.localeCompare(b.date))

  const statusMap = new Map()
  for (const row of currentRows) {
    const key = row.raw_status
    const existing = statusMap.get(key) ?? {
      color: row.status_bg_color,
      count: 0,
      status: key,
      status_id: row.status_id,
    }
    existing.count += 1
    statusMap.set(key, existing)
  }

  const liveRoster = currentRows
    .filter(row => row.raw_status === 'Clocked-In')
    .map(row => ({
      employee: row.employee_name,
      scheduled_end: row.scheduled_end,
      scheduled_start: row.scheduled_start,
      site: row.site_name,
      shift_id: row.shift_id,
      status: row.raw_status,
    }))

  const riskBySite = siteComparison
    .filter(row => row.break_conflicts || row.overlap_conflicts || row.compliance_critical || row.visa_critical)
    .sort((a, b) => (
      b.break_conflicts + b.overlap_conflicts + b.compliance_critical + b.visa_critical
    ) - (
      a.break_conflicts + a.overlap_conflicts + a.compliance_critical + a.visa_critical
    ))

  return {
    employeeComparison,
    kpis: {
      ...current,
      active_employees: employeeComparison.length,
      active_sites: siteComparison.length,
      changes: {
        actual_hours: percentChange(current.actual_hours, previous.actual_hours),
        completed: percentChange(current.completed, previous.completed),
        missed: percentChange(current.missed, previous.missed),
        rostered_hours: percentChange(current.rostered_hours, previous.rostered_hours),
        total: percentChange(current.total, previous.total),
        unfilled: percentChange(current.unfilled, previous.unfilled),
      },
    },
    liveRoster,
    meta: {
      from,
      generatedAt: new Date().toISOString(),
      previousFrom,
      previousTo,
      source: 'FieldServicer API',
      to,
    },
    riskBySite,
    shiftTrend,
    siteComparison,
    statusDistribution: [...statusMap.values()].sort((a, b) => b.count - a.count),
  }
}

function aggregate(shifts, intent) {
  const groupField = GROUP_KEY_MAP[intent.groupBy] ?? 'shift_status'
  const metrics = (intent.metrics ?? ['shift_count']).filter(m => METRIC_AGGREGATORS[m])
  const limit = Math.max(1, Math.min(Number(intent.limit) || 10, 100))

  // Group
  const groups = new Map()
  for (const shift of shifts) {
    const key = shift[groupField] ?? 'Unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(shift)
  }

  // Aggregate
  let rows = [...groups.entries()].map(([key, groupShifts]) => {
    const row = { [groupField]: key }
    for (const metric of metrics) {
      row[metric] = METRIC_AGGREGATORS[metric](groupShifts)
    }
    return row
  })

  // Sort
  const sortField = intent.sort?.field ?? metrics[0] ?? 'shift_count'
  const sortDir = intent.sort?.direction === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    const av = a[sortField] ?? 0
    const bv = b[sortField] ?? 0
    return typeof av === 'string'
      ? av.localeCompare(bv) * sortDir
      : (av - bv) * sortDir
  })

  return { groupKey: groupField, rows: rows.slice(0, limit) }
}

// ─── Report methods ───────────────────────────────────────────────────────────

async function runAggregateReport(intent, filterOverrides = {}) {
  const mergedIntent = filterOverrides
    ? { ...intent, filters: { ...(intent.filters ?? {}), ...filterOverrides } }
    : intent

  const shifts = await fetchShifts(intent)
  const filtered = applyFilters(shifts, mergedIntent)
  return aggregate(filtered, mergedIntent)
}

async function runDataLookupReport(intent) {
  const shifts = await fetchShifts(intent)
  const filtered = applyFilters(shifts, intent)
  const limit = Math.max(1, Math.min(Number(intent.limit) || 25, 100))
  const search = intent.search?.toLowerCase()

  const entity = intent.entity ?? 'shifts'

  let rows = projectLookupRows(filtered, entity)
  if (search) {
    rows = rows.filter(r =>
      Object.values(r).some(v => matchesLookupText(v, search))
    )
  }

  return {
    columns: getDefaultColumns(entity),
    groupKey: 'record_count',
    message: `Showing ${Math.min(rows.length, limit)} of ${rows.length} ${entity}.`,
    rows: rows.slice(0, limit),
    summaryCards: [{ format: 'number', label: 'Records', value: rows.length }],
  }
}

function projectLookupRows(rows, entity) {
  if (!['employees', 'sites', 'customers'].includes(entity)) return rows

  const unique = new Map()

  for (const row of rows) {
    if (entity === 'employees' && row.employee_name !== 'Unassigned') {
      const key = row.employee_id ?? row.employee_name
      if (!unique.has(key)) {
        unique.set(key, {
          department: row.department,
          employee_name: row.employee_name,
          position: row.position,
          status: 'Rostered',
        })
      }
    } else if (entity === 'sites') {
      const key = row.site_id ?? row.site_name
      if (!unique.has(key)) {
        unique.set(key, {
          customer_name: row.customer_name,
          site_name: row.site_name,
        })
      }
    } else if (entity === 'customers') {
      const key = row.customer_name
      if (!unique.has(key)) unique.set(key, { customer_name: row.customer_name })
    }
  }

  return [...unique.values()]
}

function getDefaultColumns(entity) {
  const byEntity = {
    attendance: [
      { key: 'shift_date', label: 'Shift Date' },
      { key: 'employee_name', label: 'Employee' },
      { key: 'status_id', label: 'Status ID', format: 'number' },
      { key: 'raw_status', label: 'FieldServicer Status' },
      { key: 'attendance_status', label: 'Attendance Status' },
      { key: 'shift_status', label: 'Shift Status' },
      { key: 'scheduled_start', label: 'Scheduled Start' },
      { key: 'scheduled_end', label: 'Scheduled End' },
      { key: 'actual_hours', label: 'Actual Hours', format: 'number' },
    ],
    employees: [
      { key: 'employee_name', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'position', label: 'Position' },
    ],
    shifts: [
      { key: 'shift_date', label: 'Shift Date' },
      { key: 'status_id', label: 'Status ID', format: 'number' },
      { key: 'raw_status', label: 'FieldServicer Status' },
      { key: 'shift_status', label: 'Status' },
      { key: 'employee_name', label: 'Employee' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'site_name', label: 'Site' },
      { key: 'scheduled_start', label: 'Start' },
      { key: 'scheduled_end', label: 'End' },
    ],
  }
  return byEntity[entity] ?? byEntity.shifts
}

async function runEmployeeDirectoryReport(intent) {
  const shifts = await fetchShifts(intent)
  const seen = new Map()
  for (const s of shifts) {
    if (!seen.has(s.employee_id)) {
      seen.set(s.employee_id, {
        employee_name: s.employee_name,
        department: s.department,
        position: s.position,
        employee_count: 1,
        status: 'Active',
      })
    }
  }
  const rows = [...seen.values()].slice(0, intent.limit ?? 100)
  return { groupKey: 'employee_name', rows }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const reportRepository = {
  getAttendanceExceptions: intent => runAggregateReport(intent),
  getCurrentlyClockedIn: intent => runAggregateReport(intent, { attendanceStatuses: ['Clocked In'] }),
  getCustomerPerformance: intent => runAggregateReport(intent),
  getDataLookup: intent => runDataLookupReport(intent),
  getEmployeeDirectory: intent => runEmployeeDirectoryReport(intent),
  getEmployeeHours: intent => runAggregateReport(intent),
  getEmployeeShiftCount: intent => runAggregateReport(intent),
  getMissedShifts: intent => runAggregateReport(intent, { statuses: ['Missed'] }),
  getShiftStatusSummary: intent => runAggregateReport(intent),
  getShiftTrend: intent => runAggregateReport(intent),
  getSitePerformance: intent => runAggregateReport(intent),
}

// No-op — no DB to log to. Logging stays in memory via Winston.
export async function logAiQuery(entry) {
  logger.info('AI workforce query completed.', {
    event: 'ai_query',
    executionTimeMs: entry.executionTimeMs,
    reportType: entry.reportType,
    resultCount: entry.resultCount,
    status: entry.status,
    toolName: entry.intent?.toolName ?? null,
  })
}
