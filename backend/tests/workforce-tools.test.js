import test from 'node:test'
import assert from 'node:assert/strict'
import { generateReportIntent } from '../src/services/ai/gemini.service.js'
import { buildFallbackInsights } from '../src/services/ai/summary.service.js'
import { buildIntentFromToolCall } from '../src/services/ai/workforceTool.service.js'
import { validateReportIntent } from '../src/validators/reportIntent.validator.js'
import { matchesLookupText } from '../src/repositories/report.repository.js'

function fakeGemini(functionCall) {
  return {
    chats: {
      create() {
        return {
          async sendMessage() {
            return { functionCalls: functionCall ? [functionCall] : [] }
          },
        }
      },
    },
  }
}

test('exact employee comparison selects a validated API-backed report', async () => {
  const result = await generateReportIntent({
    client: fakeGemini({
      args: {
        confidence: 0.98,
        date_range: 'this week',
        metrics: ['shift_count', 'completed_count'],
        understood_query: 'Compare employee shifts this week',
      },
      name: 'compare_employee_shifts',
    }),
    context: [],
    message: 'Compare employee shifts this week',
  })
  const intent = validateReportIntent(result.intent)

  assert.equal(intent.reportType, 'employee_shift_count')
  assert.equal(intent.groupBy, 'employee')
  assert.deepEqual(intent.metrics, ['shift_count', 'completed_count'])
  assert.equal(intent.usedFallback, false)
})

test('a typo can still be routed by Gemini without keyword matching', async () => {
  const result = await generateReportIntent({
    client: fakeGemini({
      args: {
        confidence: 0.91,
        date_range: 'last week',
        status_ids: [3, 4, 12],
        understood_query: 'Show clock-in and clock-out attendance last week',
      },
      name: 'get_attendance_records',
    }),
    context: [],
    message: 'shwo clok in clok ot atendnce last wek',
  })

  assert.equal(result.intent.reportType, 'data_lookup')
  assert.equal(result.intent.entity, 'attendance')
  assert.deepEqual(result.intent.filters.statusIds, [3, 4, 12])
  assert.equal(result.intent.usedFallback, false)
})

test('ambiguous selection preserves confidence and assumption for review', () => {
  const intent = buildIntentFromToolCall({
    args: {
      assumption: 'Assuming the user wants site coverage rather than a site directory.',
      confidence: 0.42,
      understood_query: 'Compare site coverage',
    },
    name: 'compare_site_coverage',
  }, { message: 'how are locations doing' })

  assert.equal(intent.selectionConfidence, 0.42)
  assert.match(intent.assumption, /Assuming/)
  assert.equal(intent.reportType, 'site_performance')
})

test('no Gemini function call returns a useful closest-match fallback', async () => {
  const result = await generateReportIntent({
    client: fakeGemini(null),
    context: [],
    message: 'something about the workforce',
  })

  assert.equal(result.intent.usedFallback, true)
  assert.equal(result.intent.reportType, 'shift_status_summary')
  assert.match(result.intent.assumption, /closest API-backed workforce report/)
})

test('empty API results produce an explicit non-silent response', () => {
  const result = buildFallbackInsights({
    appliedFilters: { fromDate: '2026-08-01', toDate: '2026-08-07' },
    assumption: null,
    rows: [],
    summaryCards: [],
  })

  assert.match(result.overview, /No matching FieldServicer records were found/)
  assert.match(result.overview, /broader date range/)
})

test('malformed Gemini arguments are sanitized before report execution', () => {
  const raw = buildIntentFromToolCall({
    args: {
      confidence: 7,
      date_range: 'forever',
      employee_id: 'not-a-number',
      limit: 99999,
      metrics: ['actual_hours', 'DROP TABLE'],
      status_ids: [3, 8, 12, 'bad'],
      understood_query: 1234,
    },
    name: 'compare_employee_hours',
  }, { message: 'employee hours' })
  const intent = validateReportIntent(raw)

  assert.equal(intent.limit, 100)
  assert.equal(intent.selectionConfidence, 1)
  assert.equal(intent.filters.employeeId, undefined)
  assert.deepEqual(intent.filters.statusIds, [3, 12])
  assert.deepEqual(intent.metrics, ['actual_hours'])
  assert.equal(intent.dateRange.label, 'last 30 days')
})

test('employee and site filters tolerate small spelling differences', () => {
  assert.equal(matchesLookupText('IvyAman', 'ivy aman'), true)
  assert.equal(matchesLookupText('Speedways Tyres', 'speedway tyres'), true)
  assert.equal(matchesLookupText('Speedways Tyres', 'unrelated location'), false)
})
