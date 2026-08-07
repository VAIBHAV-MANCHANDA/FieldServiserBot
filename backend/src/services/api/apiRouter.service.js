/**
 * API Router Service - Uses AI to determine which API to call based on user query
 * Extends the existing intent system to route to FieldServicer API endpoints
 */

import { findApiByKeywords, getApiCatalog, getAllApis } from './apiRegistry.js'
import { fieldServicerClient } from '../../config/fieldservicer.js'
import { logger } from '../../utils/logger.js'
import { getGeminiClient } from '../../config/gemini.js'
import { env } from '../../config/env.js'

function currentDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Build AI prompt to determine which API to call
 */
function buildApiRoutingPrompt(userQuery) {
  const catalog = getApiCatalog()

  return `
You are an API routing assistant for a workforce management system.
Today's date is ${currentDateOnly()}.

Given a user query, determine which FieldServicer API endpoint to call.
Return JSON only. No markdown, no prose.

Available API endpoints:
${catalog.map(api => `- name: "${api.name}" | description: "${api.description}" | keywords: "${api.keywords}" | params: ${JSON.stringify(api.params)}`).join('\n')}

Output shape:
{
  "apiCategory": "string (e.g. shifts, employees, attendance)",
  "apiName": "string (e.g. rosterList, list, clockIn)",
  "confidence": "high | medium | low | none",
  "params": {
    "FromDate": "YYYY-MM-DD or null",
    "ToDate": "YYYY-MM-DD or null",
    "LocationID": 0,
    "ClientID": 0,
    "EmployeeID": null
  },
  "understoodQuery": "plain english interpretation"
}

If no API matches, set confidence to "none" and leave apiCategory/apiName as null.
For relative dates like "this month", "today", calculate the actual date.

User query: "${userQuery}"
`.trim()
}

/**
 * Route user query to the appropriate FieldServicer API endpoint
 */
export async function routeQuery(userQuery, context = {}) {
  logger.info('Routing API query', { query: userQuery })

  // Step 1: Fast keyword matching
  const keywordMatches = findApiByKeywords(userQuery)

  if (keywordMatches && keywordMatches.length > 0 && keywordMatches[0].score >= 3) {
    const { api } = keywordMatches[0]
    logger.info('Keyword match found', { api: `${api.category}.${api.name}`, score: keywordMatches[0].score })

    return {
      api,
      params: extractParams(userQuery, api, context),
      confidence: 'high',
      method: 'keyword',
    }
  }

  // Step 2: AI-based routing for ambiguous queries
  const gemini = getGeminiClient()

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        contents: buildApiRoutingPrompt(userQuery),
        model: env.geminiModel,
        config: { responseMimeType: 'application/json' },
      })

      const raw = String(response.text ?? '').trim()
      const intent = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))

      if (intent.apiCategory && intent.apiName && intent.confidence !== 'none') {
        const allApis = getAllApis()
        const matched = allApis.find(a => a.category === intent.apiCategory && a.name === intent.apiName)

        if (matched) {
          logger.info('AI routing resolved', { api: `${matched.category}.${matched.name}` })
          return {
            api: matched,
            params: { ...extractParams(userQuery, matched, context), ...intent.params },
            confidence: intent.confidence,
            method: 'ai',
            understoodQuery: intent.understoodQuery,
          }
        }
      }
    } catch (error) {
      logger.warn('AI routing failed, falling back to keyword match', { error: error.message })
    }
  }

  // Step 3: Fallback to best keyword match even if score is low
  if (keywordMatches && keywordMatches.length > 0) {
    const { api } = keywordMatches[0]
    return {
      api,
      params: extractParams(userQuery, api, context),
      confidence: 'low',
      method: 'keyword-fallback',
    }
  }

  return { api: null, params: {}, confidence: 'none', error: 'No matching API found' }
}

/**
 * Execute the routed API call against FieldServicer
 */
export async function executeApiCall(routingResult) {
  const { api, params } = routingResult

  if (!api) {
    throw new Error('No API specified in routing result')
  }

  logger.info('Executing FieldServicer API call', {
    endpoint: api.endpoint,
    method: api.method,
    params,
  })

  try {
    let data
    if (api.method === 'GET') {
      data = await fieldServicerClient.get(api.endpoint, params)
    } else if (api.method === 'POST') {
      data = await fieldServicerClient.post(api.endpoint, params)
    } else {
      throw new Error(`Unsupported HTTP method: ${api.method}`)
    }

    return {
      success: true,
      data,
      meta: { category: api.category, name: api.name, endpoint: api.endpoint },
    }
  } catch (error) {
    logger.error('FieldServicer API call failed', { error: error.message, api: api.endpoint })
    return { success: false, error: error.message, data: null }
  }
}

/**
 * Extracts query parameters from natural language
 */
function extractParams(query, api, context) {
  const params = {}
  const today = new Date()

  if (api.params.includes('FromDate') || api.params.includes('ToDate')) {
    const { fromDate, toDate } = resolveDateRange(query, today)
    params.FromDate = fromDate
    params.ToDate = toDate
  }

  if (api.params.includes('LocationID')) params.LocationID = extractId(query, 'location') ?? context.locationId ?? 0
  if (api.params.includes('ClientID')) params.ClientID = extractId(query, 'client') ?? context.clientId ?? 0
  if (api.params.includes('EmployeeID')) params.EmployeeID = extractId(query, 'employee') ?? context.employeeId ?? null

  return params
}

/**
 * Resolve natural language date phrases to actual dates
 */
function resolveDateRange(query, today = new Date()) {
  const text = query.toLowerCase()
  const fmt = d => d.toISOString().split('T')[0]

  if (text.includes('today')) {
    return { fromDate: fmt(today), toDate: fmt(today) }
  }
  if (text.includes('yesterday')) {
    const d = new Date(today); d.setDate(d.getDate() - 1)
    return { fromDate: fmt(d), toDate: fmt(d) }
  }
  if (text.includes('this week')) {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay())
    return { fromDate: fmt(start), toDate: fmt(today) }
  }
  if (text.includes('last week')) {
    const end = new Date(today); end.setDate(today.getDate() - today.getDay() - 1)
    const start = new Date(end); start.setDate(end.getDate() - 6)
    return { fromDate: fmt(start), toDate: fmt(end) }
  }
  if (text.includes('last month')) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    return { fromDate: fmt(start), toDate: fmt(end) }
  }
  if (text.includes('this month')) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { fromDate: fmt(start), toDate: fmt(today) }
  }

  // Default: current month
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return { fromDate: fmt(start), toDate: fmt(today) }
}

function extractId(query, keyword) {
  const match = query.match(new RegExp(`${keyword}\\s*(?:id)?[:\\s]*(\\d+)`, 'i'))
  return match ? parseInt(match[1], 10) : null
}
