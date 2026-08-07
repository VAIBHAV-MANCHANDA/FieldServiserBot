import { logAiQuery } from '../../repositories/report.repository.js'
import { createValidatedIntent } from '../ai/intent.service.js'
import { logQueryMiss } from '../ai/queryMiss.service.js'
import { executeReport } from '../reports/report.service.js'
import {
  addConversationMessage,
  getOrCreateSession,
  loadConversationContext,
} from './conversation.service.js'

function createSuggestions(intent) {
  const suggestions = ['Group this by week', 'Compare it with last month', 'Show the top five only']
  if (intent.chartType !== 'pie') suggestions.push('Convert this into a pie chart')
  if (intent.chartType !== 'line') suggestions.push('Convert this into a line graph')
  return suggestions.slice(0, 4)
}

function recordSelectionMiss(intent, message, rowCount) {
  if (!intent.usedFallback && intent.selectionConfidence >= 0.6 && rowCount > 0) return

  logQueryMiss({
    args: intent.toolArguments,
    functionCalled: intent.toolName,
    query: message,
    reason: intent.usedFallback
      ? 'fallback_used'
      : rowCount === 0
        ? 'no_rows'
        : 'low_confidence',
    rowCount,
  })
}

export async function runChatQuery({ message, sessionId }) {
  const startedAt = Date.now()
  const session = await getOrCreateSession(sessionId, message.slice(0, 120))

  await addConversationMessage({
    role: 'user',
    sessionId: session.id,
    text: message,
  })

  try {
    const context = await loadConversationContext(session.id)
    const { intent, toolContext } = await createValidatedIntent({
      context: context.messages,
      message,
      previousIntent: context.previousIntent,
    })

    const report = await executeReport(intent, { toolContext })
    recordSelectionMiss(intent, message, report.rows.length)

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
      assumption: intent.assumption,
      outOfScope: false,
      selectedTool: intent.toolName,
      selectionConfidence: intent.selectionConfidence,
      sessionId: session.session_uuid,
      suggestedQuestions: createSuggestions(intent),
      understoodQuery: intent.understoodQuery ?? intent.chartTitle,
      usedFallback: intent.usedFallback,
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
