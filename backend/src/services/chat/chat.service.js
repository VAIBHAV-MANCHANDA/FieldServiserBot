import { logAiQuery } from '../../repositories/report.repository.js'
import { createValidatedIntent } from '../ai/intent.service.js'
import { executeReport } from '../reports/report.service.js'
import {
  addConversationMessage,
  getOrCreateSession,
  loadConversationContext,
} from './conversation.service.js'

// ─── Out-of-scope detector ────────────────────────────────────────────────────
const OUT_OF_SCOPE_PATTERNS = [
  // General knowledge / AI topics
  /\b(who is|what is|what are|tell me about|explain|define|meaning of|history of|wikipedia|google)\b/i,
  // Weather, news, current events
  /\b(weather|forecast|temperature|news|today'?s news|stock|crypto|bitcoin|price of)\b/i,
  // Personal / casual chat
  /\b(how are you|what'?s up|hey|hello|hi there|good morning|good evening|good night|how do you feel|are you (human|real|sentient|alive))\b/i,
  // Programming / tech help unrelated to the app
  /\b(write me a|write a|code for|program|python|javascript|html|css|sql query|fix my|debug|git|docker|kubernetes|linux|windows)\b/i,
  // Food / lifestyle
  /\b(recipe|food|restaurant|movie|song|music|sport|football|cricket|travel|vacation|hotel|flights?)\b/i,
  // Medical / legal
  /\b(symptoms?|diagnosis|medicine|drug|lawyer|legal advice|sue|court)\b/i,
  // Maths / general calculations
  /\b(what is \d+ (plus|minus|times|divided|multiplied)|calculate|convert \d+|how many (km|miles|kg|pounds))\b/i,
]

const IN_SCOPE_KEYWORDS = [
  'employee', 'employees', 'worker', 'workers', 'staff',
  'shift', 'shifts', 'schedule', 'scheduled', 'roster',
  'attendance', 'clock', 'clocked', 'present', 'absent',
  'site', 'sites', 'location', 'customer', 'customers', 'client',
  'late', 'missed', 'completed', 'overtime', 'hours', 'revenue',
  'wages', 'profit', 'financial', 'report', 'analytics', 'performance',
  'department', 'position', 'pay rate', 'workforce',
]

function detectOutOfScope(message) {
  const text = String(message ?? '').toLowerCase().trim()

  // Very short single-word inputs that aren't keywords
  if (text.split(/\s+/).length <= 2) {
    const hasKeyword = IN_SCOPE_KEYWORDS.some((kw) => text.includes(kw))
    if (!hasKeyword) return true
  }

  // Check if any in-scope keyword is present — if yes, it's in scope regardless
  const hasKeyword = IN_SCOPE_KEYWORDS.some((kw) => text.includes(kw))
  if (hasKeyword) return false

  // Match against out-of-scope patterns
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(text))
}

const OUT_OF_SCOPE_RESPONSES = [
  "That's outside what I can help with. I'm built specifically for workforce analytics — ask me about shifts, attendance, employees, sites, revenue, or performance.",
  "That question is out of my scope. I only have access to your FieldServicer workforce data. Try asking about shift counts, employees, hours, or roster status.",
  "I can't help with that — I'm a workforce analytics assistant. I work with live FieldServicer API data for employees, shifts, attendance, customers, and sites.",
  "Out of scope for me. I'm connected to the FieldServicer API. Ask me something like 'show missed shifts this week' or 'which employee completed the most shifts'.",
]

function getOutOfScopeMessage() {
  return OUT_OF_SCOPE_RESPONSES[Math.floor(Math.random() * OUT_OF_SCOPE_RESPONSES.length)]
}

// ─── Suggestion builder ───────────────────────────────────────────────────────
function createSuggestions(intent) {
  const suggestions = ['Group this by week', 'Compare it with last month', 'Show the top five only']

  if (intent.chartType !== 'pie') suggestions.push('Convert this into a pie chart')
  if (intent.chartType !== 'line') suggestions.push('Convert this into a line graph')

  return suggestions.slice(0, 4)
}

// ─── Main chat handler ────────────────────────────────────────────────────────
export async function runChatQuery({ message, sessionId }) {
  const startedAt = Date.now()
  const session = await getOrCreateSession(sessionId, message.slice(0, 120))

  await addConversationMessage({
    role: 'user',
    sessionId: session.id,
    text: message,
  })

  // ── Out-of-scope guard ───────────────────────────────────────────────────
  if (detectOutOfScope(message)) {
    const outOfScopeText = getOutOfScopeMessage()

    await addConversationMessage({
      role: 'assistant',
      sessionId: session.id,
      text: outOfScopeText,
    })

    return {
      appliedFilters: {},
      barChart: null,
      chart: null,
      message: outOfScopeText,
      outOfScope: true,
      pieChart: null,
      sessionId: session.session_uuid,
      suggestedQuestions: [
        'Show me missed shifts this week',
        'Which employee has the most overtime?',
        'Show revenue by customer this month',
        'Who clocked in late last week?',
      ],
      summaryCards: [],
      table: { columns: [], rows: [] },
      understoodQuery: null,
    }
  }

  try {
    const context = await loadConversationContext(session.id)
    const intent = await createValidatedIntent({
      context: context.messages,
      message,
      previousIntent: context.previousIntent,
    })

    if (intent.requiresClarification) {
      const clarification = intent.clarificationQuestion ?? 'Can you clarify the date range or grouping?'

      await addConversationMessage({
        intent,
        role: 'assistant',
        sessionId: session.id,
        text: clarification,
      })

      return {
        appliedFilters: {},
        chart: null,
        message: clarification,
        outOfScope: false,
        sessionId: session.session_uuid,
        suggestedQuestions: [],
        summaryCards: [],
        table: { columns: [], rows: [] },
        understoodQuery: intent.understoodQuery ?? message,
      }
    }

    const report = await executeReport(intent)

    await addConversationMessage({
      chart: report.chart,
      intent,
      role: 'assistant',
      sessionId: session.id,
      text: report.message,
    })

    await logAiQuery({
      executionTimeMs: Date.now() - startedAt,
      intent,
      reportType: intent.reportType,
      resultCount: report.rows.length,
      sessionId: session.id,
      status: 'success',
      userMessage: message,
    })

    return {
      ...report,
      outOfScope: false,
      sessionId: session.session_uuid,
      suggestedQuestions: createSuggestions(intent),
      understoodQuery: intent.understoodQuery ?? intent.chartTitle,
    }
  } catch (error) {
    await logAiQuery({
      errorMessage: error.message,
      executionTimeMs: Date.now() - startedAt,
      reportType: null,
      resultCount: 0,
      sessionId: session.id,
      status: 'failed',
      userMessage: message,
    }).catch(() => undefined)

    throw error
  }
}
