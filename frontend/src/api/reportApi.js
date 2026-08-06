import axiosClient from './axiosClient.js'

/**
 * Execute a report directly (bypassing chat).
 * Maps dashboard-friendly params to the shape the validator expects.
 */
export async function executeReport({
  chartType,
  endDate,
  filters,
  groupBy,
  limit,
  metrics,
  reportType,
  sortBy,
  sortOrder = 'desc',
  startDate,
}) {
  const body = {
    reportType,
    ...(groupBy && { groupBy }),
    ...(metrics && { metrics }),
    ...(chartType && { chartType }),
    ...(limit && { limit }),
    ...(filters && { filters }),
    dateRange: startDate || endDate
      ? { from: startDate ?? null, to: endDate ?? null }
      : { label: 'last 30 days' },
    sort: {
      direction: sortOrder,
      field: sortBy ?? metrics?.[0] ?? 'shift_count',
    },
  }

  const response = await axiosClient.post('/reports/generate', body)
  // backend: { success, data: { report: { chart, summaryCards, ... } } }
  // axiosClient intercept returns: { success, data: { report: { ... } } }
  return response.data?.report ?? response.report ?? response
}

export async function fetchReportTypes() {
  const response = await axiosClient.get('/reports/types')
  return response.data.reportTypes
}
