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

async function fetchShifts(intent) {
  const { from, to } = getDateRange(intent)
  try {
    const raw = await fieldServicerClient.getRosterShiftList({
      locationId: intent.filters?.siteId ?? 0,
      clientId: intent.filters?.customerId ?? 0,
      fromDate: from,
      toDate: to,
    })
    return normalizeShifts(raw)
  } catch (error) {
    logger.error('Failed to fetch shifts from FieldServicer API', { error: error.message })
    return []
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
 * StatusID values (confirmed from DB screenshot):
 *   1=Unpublish, 2=Published, 3=Clocked-In, 4=Clocked-Out,
 *   5=Approved, 6=Rejected, 7=Deleted, 9=UnAssigned,
 *   10=Submitted, 11=Accepted, 12=Pending
 */
const STATUS_MAP = {
  1: 'Unpublish',
  2: 'Published',
  3: 'Clocked-In',
  4: 'Clocked-Out',
  5: 'Approved',
  6: 'Rejected',
  7: 'Deleted',
  9: 'UnAssigned',
  10: 'Submitted',
  11: 'Accepted',
  12: 'Pending',
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
    // Use Status_Title directly if present, fall back to StatusID map
    const rawStatus = s.Status_Title ?? STATUS_MAP[s.StatusID] ?? 'Unknown'
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
      employee_name: s.EmployeeName ?? 'Unassigned',
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
      shift_status:      shiftStatus,
      raw_status:        rawStatus,
      attendance_status: deriveAttendanceStatus(shiftStatus, rawStatus),

      // Times (stored as "HH:MM" strings in the API)
      scheduled_start: s.StartTime ?? null,
      scheduled_end:   s.EndTime ?? null,
      break_minutes:   parseInt(s.Break_Minute ?? 0, 10),

      // Hours — from API directly
      rostered_hours:      totalHours,
      actual_hours:        actualHours,
      site_hours:          parseFloat(s.Site_Hours ?? 0),
      overtime_hours:      Math.max(0, actualHours - totalHours),
      late_minutes:        0, // not available in this endpoint
      early_leave_minutes: 0, // not available in this endpoint

      // Financials — not in this endpoint, default to 0
      pay_rate:    0,
      charge_rate: 0,
      wages:       0,
      revenue:     0,
      gross_profit: 0,

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
  if (rawStatus === 'Clocked-Out') return 'Completed'
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

// ─── Filtering ────────────────────────────────────────────────────────────────

function applyFilters(shifts, intent) {
  const f = intent.filters ?? {}
  return shifts.filter(s => {
    if (f.department && s.department !== f.department) return false
    if (f.position && s.position !== f.position) return false
    if (f.customer && s.customer_name !== f.customer) return false
    if (f.site && s.site_name !== f.site) return false
    if (f.employee && s.employee_name !== f.employee) return false
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
  early_leave_minutes: rows => rows.reduce((s, r) => s + (r.early_leave_minutes ?? 0), 0),
  fill_rate: rows => {
    const total = rows.length
    if (!total) return 0
    const filled = rows.filter(r => !['Unfilled', 'Cancelled'].includes(r.shift_status)).length
    return round(filled / total * 100)
  },
  gross_margin_percentage: rows => {
    const rev = rows.reduce((s, r) => s + (r.revenue ?? 0), 0)
    const profit = rows.reduce((s, r) => s + (r.gross_profit ?? 0), 0)
    return rev ? round(profit / rev * 100) : 0
  },
  gross_profit: rows => round(rows.reduce((s, r) => s + (r.gross_profit ?? 0), 0)),
  late_count: rows => rows.filter(r => r.late_minutes > 0).length,
  late_minutes: rows => rows.reduce((s, r) => s + (r.late_minutes ?? 0), 0),
  missed_count: rows => rows.filter(r => r.shift_status === 'Missed').length,
  overtime_hours: rows => round(rows.reduce((s, r) => s + (r.overtime_hours ?? 0), 0)),
  revenue: rows => round(rows.reduce((s, r) => s + (r.revenue ?? 0), 0)),
  rostered_hours: rows => round(rows.reduce((s, r) => s + (r.rostered_hours ?? 0), 0)),
  shift_count: rows => rows.length,
  unfilled_count: rows => rows.filter(r => r.shift_status === 'Unfilled').length,
  wages: rows => round(rows.reduce((s, r) => s + (r.wages ?? 0), 0)),
}

function round(n) { return Math.round(n * 100) / 100 }

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

  let rows = filtered
  if (search) {
    rows = rows.filter(r =>
      Object.values(r).some(v => String(v ?? '').toLowerCase().includes(search))
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

function getDefaultColumns(entity) {
  const byEntity = {
    attendance: [
      { key: 'shift_date', label: 'Shift Date' },
      { key: 'employee_name', label: 'Employee' },
      { key: 'attendance_status', label: 'Attendance Status' },
      { key: 'shift_status', label: 'Shift Status' },
      { key: 'clock_in_datetime', label: 'Clock In' },
      { key: 'clock_out_datetime', label: 'Clock Out' },
      { key: 'actual_hours', label: 'Actual Hours', format: 'number' },
      { key: 'late_minutes', label: 'Late Minutes', format: 'number' },
    ],
    employees: [
      { key: 'employee_name', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'position', label: 'Position' },
    ],
    shifts: [
      { key: 'shift_date', label: 'Shift Date' },
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
  getFinancialSummary: intent => runAggregateReport(intent),
  getLateClockIns: intent => runAggregateReport(intent, { attendanceStatuses: ['Late'] }),
  getMissedShifts: intent => runAggregateReport(intent, { statuses: ['Missed'] }),
  getOvertimeSummary: intent => runAggregateReport(intent),
  getShiftStatusSummary: intent => runAggregateReport(intent),
  getShiftTrend: intent => runAggregateReport(intent),
  getSitePerformance: intent => runAggregateReport(intent),
}

// No-op — no DB to log to. Logging stays in memory via Winston.
export async function logAiQuery() {}
