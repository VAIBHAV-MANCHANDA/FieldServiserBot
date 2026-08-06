import { generateReportIntent } from './gemini.service.js'
import { validateReportIntent } from '../../validators/reportIntent.validator.js'

function mergeObject(previousValue, rawValue) {
  const previousObject = previousValue && typeof previousValue === 'object' && !Array.isArray(previousValue)
    ? previousValue
    : {}
  const rawObject = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
    ? rawValue
    : null

  if (!rawObject) {
    return rawValue ?? previousValue
  }

  return {
    ...previousObject,
    ...rawObject,
  }
}

function mergeIntent(previousIntent, rawIntent) {
  if (!previousIntent || !rawIntent || rawIntent.reportType) {
    return rawIntent
  }

  return {
    ...previousIntent,
    ...rawIntent,
    dateRange: mergeObject(previousIntent.dateRange, rawIntent.dateRange),
    filters: mergeObject(previousIntent.filters, rawIntent.filters),
    sort: mergeObject(previousIntent.sort, rawIntent.sort),
  }
}

export async function createValidatedIntent({ context, message, previousIntent }) {
  const rawIntent = await generateReportIntent({ context, message, previousIntent })
  return validateReportIntent(mergeIntent(previousIntent, rawIntent))
}
