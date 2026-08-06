import { listReportTypes } from '../reports/reportRegistry.js'
import { listDataLookupEntities } from '../reports/dataLookupRegistry.js'

function currentDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

export function buildIntentPrompt({ context = [], message, previousIntent = null }) {
  return `
You convert workforce analytics questions into safe JSON reporting intents.
Return JSON only. Do not include markdown, prose, SQL, code, comments, or extra keys.
Today's date is ${currentDateOnly()}.
For relative ranges such as "today", "this week", "this month", "last month", or "last 30 days", set dateRange.label to that phrase and do not invent stale calendar dates.
If the user does not mention a date range, use { "label": "last 30 days" }.

CRITICAL RULES — read carefully:
1. ALWAYS choose an analytics report type (shift_status_summary, employee_hours, site_performance, financial_summary, etc.) when the user asks about performance, trends, counts, comparisons, "who has done more/less", "which site", "how many shifts", graphs, charts, or any aggregated data.
2. Only use "data_lookup" for direct record lookups: listing emails, pay rates, addresses, active/inactive status, or raw record browsing. NEVER use data_lookup for shift counts, hours worked, performance, or comparisons.
3. Every response MUST include a meaningful chartType ("bar", "line", or "pie") — charts are ALWAYS generated regardless of the question.
4. For queries about shifts by employee or "who did more shifts", use reportType "employee_shift_count" with groupBy "employee" and metrics ["shift_count", "completed_count"].
5. For queries about this week / current week, set dateRange to { "label": "this week" }.

Allowed reports:
${JSON.stringify(listReportTypes())}

Database lookup entities (ONLY for raw record lookups, NOT for analytics):
${JSON.stringify(listDataLookupEntities())}

Allowed output shape:
{
  "reportType": "shift_status_summary",
  "entity": null,
  "lookupMode": "list",
  "search": null,
  "columns": [],
  "dateRangeFilter": false,
  "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "label": "this month" },
  "metrics": ["shift_count"],
  "groupBy": "shift_status",
  "filters": {
    "employee": null,
    "department": null,
    "position": null,
    "customer": null,
    "site": null,
    "statuses": [],
    "attendanceStatuses": []
  },
  "sort": { "field": "shift_count", "direction": "desc" },
  "limit": 10,
  "chartType": "bar",
  "chartTitle": "Short chart title",
  "requiresClarification": false,
  "clarificationQuestion": null,
  "understoodQuery": "Short plain-English query interpretation"
}

Use the previous intent only to resolve follow-up wording. Do not invent database identifiers.
Previous intent:
${JSON.stringify(previousIntent)}

Recent context:
${JSON.stringify(context)}

Current user question:
${message}
`.trim()
}

export function buildSummaryPrompt({ appliedFilters, rows, summaryCards }) {
  return `
You are a workforce analytics assistant. Given the report data below, return a JSON object with exactly these four string fields. No markdown, no extra keys.

{
  "overview": "2-3 sentence plain-English summary of what the data shows overall. Mention totals, date range, and any notable pattern.",
  "lineInsight": "1-2 sentences interpreting the trend or ranking shown in the line/area chart. What story does the shape tell?",
  "pieInsight": "1-2 sentences interpreting the distribution in the donut chart. Which segment dominates and by how much?",
  "barInsight": "1-2 sentences interpreting the bar chart comparison. Who leads, who lags, and what action this suggests."
}

Rules:
- Use only the numbers present in the data below. Do not invent values.
- Be specific: name the top item, the date range, the metric.
- Keep each field under 60 words.
- Return only valid JSON.

Applied filters: ${JSON.stringify(appliedFilters)}
Summary cards: ${JSON.stringify(summaryCards)}
Top rows (up to 15): ${JSON.stringify(rows.slice(0, 15))}
`.trim()
}
