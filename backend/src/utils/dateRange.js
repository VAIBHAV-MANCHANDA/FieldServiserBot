import { env } from '../config/env.js'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toDateOnly(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date) {
  const next = startOfDay(date)
  const day = next.getDay()
  next.setDate(next.getDate() - day)
  return next
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function parseDateOnly(value) {
  if (!DATE_ONLY_PATTERN.test(String(value))) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const RELATIVE_LABELS = new Set([
  'today',
  'yesterday',
  'this week',
  'last week',
  'this month',
  'last month',
  'last 6 months',
  'last 30 days',
])

export function resolveDateRange(range = {}, now = new Date()) {
  const label = String(range.label ?? '').toLowerCase()
  let fromDate = RELATIVE_LABELS.has(label) ? null : parseDateOnly(range.from)
  let toDate = RELATIVE_LABELS.has(label) ? null : parseDateOnly(range.to)
  const today = startOfDay(now)

  if (!fromDate || !toDate) {
    if (label === 'today') {
      fromDate = today
      toDate = today
    } else if (label === 'yesterday') {
      fromDate = addDays(today, -1)
      toDate = addDays(today, -1)
    } else if (label === 'this week') {
      fromDate = startOfWeek(today)
      toDate = today
    } else if (label === 'last week') {
      toDate = addDays(startOfWeek(today), -1)
      fromDate = addDays(toDate, -6)
    } else if (label === 'this month') {
      fromDate = startOfMonth(today)
      toDate = today
    } else if (label === 'last month') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      fromDate = startOfMonth(lastMonth)
      toDate = endOfMonth(lastMonth)
    } else if (label === 'last 6 months') {
      fromDate = addDays(today, -182)
      toDate = today
    } else if (label === 'last 30 days') {
      fromDate = addDays(today, -29)
      toDate = today
    } else {
      fromDate = addDays(today, -6)
      toDate = today
    }
  }

  if (fromDate > toDate) {
    const error = new Error('Date range is invalid because from date is after to date.')
    error.status = 400
    error.code = 'INVALID_DATE_RANGE'
    throw error
  }

  const daySpan = Math.ceil((toDate - fromDate) / 86400000) + 1

  if (daySpan > env.maxReportDateRangeDays) {
    const error = new Error(`Date range cannot exceed ${env.maxReportDateRangeDays} days.`)
    error.status = 400
    error.code = 'DATE_RANGE_TOO_LARGE'
    throw error
  }

  return {
    from: toDateOnly(fromDate),
    label: label || 'custom',
    to: toDateOnly(toDate),
  }
}
