import { generateResultSummary } from './gemini.service.js'

// ─── Fallback insight generators (no AI needed) ───────────────────────────────
function buildFallbackInsights({ appliedFilters, rows, summaryCards }) {
  const hasDateRange = appliedFilters.fromDate && appliedFilters.toDate
  const dateStr = hasDateRange
    ? ` from ${appliedFilters.fromDate} to ${appliedFilters.toDate}`
    : ' over the selected period'

  if (!rows.length) {
    const msg = `No data found${dateStr}.`
    return { barInsight: msg, lineInsight: msg, overview: msg, pieInsight: msg }
  }

  const firstCard = summaryCards[0]
  const topRow = rows[0]
  const xKey = Object.keys(topRow)[0]
  const topLabel = topRow[xKey] ?? 'the top entry'

  const overview = firstCard
    ? `${firstCard.label} totals ${firstCard.value}${dateStr} across ${rows.length} group${rows.length !== 1 ? 's' : ''}.`
    : `Found ${rows.length} result${rows.length !== 1 ? 's' : ''}${dateStr}.`

  const lineInsight = `The trend shows ${rows.length} data point${rows.length !== 1 ? 's' : ''}. ${firstCard ? `${firstCard.label} averages ${(firstCard.value / rows.length).toFixed(1)} per group.` : ''}`

  const pieInsight = `${topLabel} accounts for the largest share in the distribution.`

  const barInsight = `${topLabel} leads the ranking. Review lower-performing groups for improvement opportunities.`

  return { barInsight, lineInsight, overview, pieInsight }
}

// ─── Main summarize function ──────────────────────────────────────────────────
export async function summarizeReport({ appliedFilters, rows, summaryCards }) {
  // Try AI first — expects JSON back
  const raw = await generateResultSummary({ appliedFilters, rows, summaryCards })

  if (raw) {
    try {
      // Strip markdown fences if Gemini wraps in ```json
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleaned)

      if (parsed.overview && parsed.lineInsight && parsed.pieInsight && parsed.barInsight) {
        return parsed // { overview, lineInsight, pieInsight, barInsight }
      }

      // Gemini returned plain string (old format) — wrap it
      if (typeof raw === 'string') {
        return {
          ...buildFallbackInsights({ appliedFilters, rows, summaryCards }),
          overview: raw,
        }
      }
    } catch {
      // JSON parse failed — use raw as overview
      return {
        ...buildFallbackInsights({ appliedFilters, rows, summaryCards }),
        overview: typeof raw === 'string' ? raw : undefined,
      }
    }
  }

  return buildFallbackInsights({ appliedFilters, rows, summaryCards })
}
