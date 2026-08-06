import { listReportTypes } from '../services/reports/report.service.js'
import { executeReport } from '../services/reports/report.service.js'
import { validateReportIntent } from '../validators/reportIntent.validator.js'
import { sendSuccess } from '../utils/response.js'

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
