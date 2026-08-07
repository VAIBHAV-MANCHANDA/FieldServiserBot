export function buildSummaryPrompt({ appliedFilters, assumption, rows, summaryCards, toolName, userQuery }) {
  return `
Answer the workforce question using only the FieldServicer API result below.
Return JSON only with exactly these four string fields:
{
  "overview": "Direct 2-3 sentence answer",
  "lineInsight": "Brief trend or ranking insight",
  "pieInsight": "Brief distribution insight",
  "barInsight": "Brief comparison insight"
}

Rules:
- Never invent a value, employee, site, customer, status, or date.
- If there are no rows, explicitly say no matching records were found and suggest broadening the date range or filters.
- State the assumption in the overview when one is provided.
- Keep each field under 70 words.

User question: ${String(userQuery ?? '')}
Selected tool: ${String(toolName ?? '')}
Assumption: ${String(assumption ?? '')}
Applied filters: ${JSON.stringify(appliedFilters)}
Summary cards: ${JSON.stringify(summaryCards)}
Rows: ${JSON.stringify(rows.slice(0, 100))}
  `.trim()
}
