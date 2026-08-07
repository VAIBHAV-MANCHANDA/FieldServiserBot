import { listReportTypes } from '../services/reports/report.service.js'
import { executeReport } from '../services/reports/report.service.js'
import { validateReportIntent } from '../validators/reportIntent.validator.js'
import { sendSuccess } from '../utils/response.js'
import { getDashboardSnapshot } from '../repositories/report.repository.js'
import { resolveDateRange } from '../utils/dateRange.js'

export function getReportTypes(req, res) {
  sendSuccess(res, { reportTypes: listReportTypes() }, 'Report types loaded.')
}

export async function postReport(req, res, next) {
  try {
    const intent = validateReportIntent(req.body)
    const report = await executeReport(intent)
    sendSuccess(res, { report }, 'Report generated.')
  } catch (error) {
    next(error)
  }
}

export async function getDashboardReport(req, res, next) {
  try {
    const requestedDays = Number(req.query.days)
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30
    const toDate = new Date()
    const fromDate = new Date(toDate)
    fromDate.setDate(fromDate.getDate() - (days - 1))

    const range = resolveDateRange({
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
    })
    const dashboard = await getDashboardSnapshot({
      forceRefresh: req.query.refresh === 'true',
      from: range.from,
      to: range.to,
    })

    sendSuccess(res, { dashboard }, 'Dashboard loaded.')
  } catch (error) {
    next(error)
  }
}
