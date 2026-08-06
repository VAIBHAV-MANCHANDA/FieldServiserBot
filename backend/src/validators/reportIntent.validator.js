import Joi from 'joi'
import { env } from '../config/env.js'
import { CHART_TYPES, GROUPINGS, METRICS, REPORT_TYPES } from '../services/reports/reportRegistry.js'
import { DATA_LOOKUP_ENTITY_KEYS } from '../services/reports/dataLookupRegistry.js'
import { resolveDateRange } from '../utils/dateRange.js'

const sqlRiskPattern = /(;|--|\/\*|\*\/)/i

const filtersSchema = Joi.object({
  attendanceStatuses: Joi.array().items(Joi.string().max(40)).default([]),
  city: Joi.string().max(100).allow(null, '').optional(),
  completedOnly: Joi.boolean().optional(),
  customer: Joi.string().max(160).allow(null, '').optional(),
  customerCode: Joi.string().max(40).allow(null, '').optional(),
  customerId: Joi.number().integer().allow(null).optional(),
  department: Joi.string().max(80).allow(null, '').optional(),
  employee: Joi.string().max(160).allow(null, '').optional(),
  employeeCode: Joi.string().max(40).allow(null, '').optional(),
  employeeId: Joi.number().integer().allow(null).optional(),
  industry: Joi.string().max(100).allow(null, '').optional(),
  isActive: Joi.boolean().optional(),
  nightShiftsOnly: Joi.boolean().optional(),
  position: Joi.string().max(80).allow(null, '').optional(),
  site: Joi.string().max(160).allow(null, '').optional(),
  siteCode: Joi.string().max(40).allow(null, '').optional(),
  siteId: Joi.number().integer().allow(null).optional(),
  statuses: Joi.array().items(Joi.string().max(40)).default([]),
}).default({})

export const reportIntentSchema = Joi.object({
  chartTitle: Joi.string().max(140).allow(null, '').default(null),
  chartType: Joi.string().valid(...CHART_TYPES).default('bar'),
  clarificationQuestion: Joi.string().max(240).allow(null, '').default(null),
  columns: Joi.array().items(Joi.string().max(80)).default([]),
  dateRangeFilter: Joi.boolean().default(false),
  dateRange: Joi.object({
    from: Joi.string().allow(null, '').optional(),
    label: Joi.string().max(80).allow(null, '').optional(),
    to: Joi.string().allow(null, '').optional(),
  }).default({ label: 'last 7 days' }),
  entity: Joi.string().valid(...DATA_LOOKUP_ENTITY_KEYS).allow(null, '').default(null),
  filters: filtersSchema,
  groupBy: Joi.string().valid(...GROUPINGS).default('shift_status'),
  limit: Joi.number().integer().min(1).max(env.maxReportRows).default(10),
  lookupMode: Joi.string().valid('count', 'detail', 'list').default('list'),
  metrics: Joi.array().items(Joi.string().valid(...Object.keys(METRICS))).min(1).default(['shift_count']),
  reportType: Joi.string().valid(...Object.keys(REPORT_TYPES)).required(),
  requiresClarification: Joi.boolean().default(false),
  search: Joi.string().max(180).allow(null, '').default(null),
  sort: Joi.object({
    direction: Joi.string().valid('asc', 'desc').default('desc'),
    field: Joi.string().max(80).default('shift_count'),
  }).default({ direction: 'desc', field: 'shift_count' }),
  understoodQuery: Joi.string().max(220).allow(null, '').default(null),
}).unknown(false)

function assertNoSqlFragments(intent) {
  const serialized = JSON.stringify(intent)

  if (sqlRiskPattern.test(serialized)) {
    const error = new Error('The reporting request contains unsupported instructions.')
    error.status = 400
    error.code = 'UNSAFE_INTENT'
    throw error
  }
}

function normalizeDateRange(dateRange) {
  if (!dateRange) {
    return {}
  }

  if (typeof dateRange === 'string') {
    return { label: dateRange }
  }

  if (typeof dateRange === 'object' && !Array.isArray(dateRange)) {
    return dateRange
  }

  return {}
}

function normalizeIntent(intent = {}) {
  return {
    ...intent,
    dateRange: normalizeDateRange(intent.dateRange),
  }
}

export function validateReportIntent(intent) {
  const normalizedIntent = normalizeIntent(intent)

  assertNoSqlFragments(normalizedIntent)

  if (normalizedIntent?.requiresClarification) {
    const clarificationQuestion = String(
      normalizedIntent.clarificationQuestion ?? 'Can you clarify what report you want?',
    ).slice(0, 240)

    return {
      chartTitle: null,
      chartType: 'bar',
      clarificationQuestion,
      dateRange: resolveDateRange({ label: 'last 7 days' }),
      filters: {},
      groupBy: 'shift_status',
      limit: 10,
      metrics: ['shift_count'],
      reportType: 'shift_status_summary',
      requiresClarification: true,
      sort: { direction: 'desc', field: 'shift_count' },
      understoodQuery: normalizedIntent.understoodQuery ?? null,
    }
  }

  const { error, value } = reportIntentSchema.validate(normalizedIntent, {
    abortEarly: false,
    stripUnknown: true,
  })

  if (error) {
    error.status = 400
    error.code = 'INVALID_REPORT_INTENT'
    throw error
  }

  const definition = REPORT_TYPES[value.reportType]
  const entity = definition.allowedEntities?.includes(value.entity)
    ? value.entity
    : definition.defaultEntity ?? value.entity
  const metrics = value.metrics.filter((metric) => definition.allowedMetrics.includes(metric))
  const groupBy = definition.allowedGroupBy.includes(value.groupBy)
    ? value.groupBy
    : definition.defaultGroupBy
  const chartType = definition.allowedChartTypes.includes(value.chartType)
    ? value.chartType
    : definition.defaultChartType
  const sortField = definition.allowedSortFields.includes(value.sort.field)
    ? value.sort.field
    : metrics[0] ?? definition.defaultMetrics[0]

  return {
    ...value,
    chartTitle: value.chartTitle || definition.label,
    chartType,
    dateRange: resolveDateRange(value.dateRange),
    entity,
    groupBy,
    metrics: metrics.length > 0 ? metrics : definition.defaultMetrics,
    sort: {
      direction: value.sort.direction,
      field: sortField,
    },
  }
}
