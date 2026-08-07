import { FunctionCallingConfigMode } from '@google/genai'
import { getGeminiClient } from '../../config/gemini.js'
import { env } from '../../config/env.js'
import { WORKFORCE_TOOL_DECLARATIONS, WORKFORCE_TOOL_NAMES } from '../../tools/workforce.tools.js'
import { logger } from '../../utils/logger.js'
import { buildSummaryPrompt } from './prompt.service.js'
import { logQueryMiss } from './queryMiss.service.js'
import { buildIntentFromToolCall, createFallbackToolSelection } from './workforceTool.service.js'

const TOOL_SELECTION_INSTRUCTION = `
You are the routing brain for a FieldServicer workforce analytics assistant.
Interpret the user's meaning, correct obvious spelling mistakes, and tolerate informal or loosely related wording.
Always select exactly one of the provided functions. Never write SQL, invent an endpoint, or request arbitrary code execution.
The functions are fixed, validated backend operations over the FieldServicer RosterShiftList API.
Use previous intent and recent messages to understand follow-up questions such as "group this by week".
If no function is a strong match, select the closest useful workforce function, lower confidence, and state the assumption.
Do not select financial, pay, revenue, precise overtime, or lateness calculations because those values are not supplied by this API.
StatusID 3 means Clocked-In. StatusIDs 4 and 12 both mean Clocked-Out.
`.trim()

const GROUNDED_RESPONSE_INSTRUCTION = `
You are a workforce analytics assistant completing a function-calling turn.
Answer strictly from the function response. Never invent employees, totals, dates, hours, statuses, or conclusions absent from the response.
If rowCount is zero, explicitly say that no matching FieldServicer records were found and suggest one useful rephrasing.
If an assumption is present, state it clearly in the overview.
Return JSON only with exactly these string fields:
{
  "overview": "Direct 2-3 sentence answer to the user's question",
  "lineInsight": "Brief time/ranking insight, or a factual no-data statement",
  "pieInsight": "Brief distribution insight, or a factual no-data statement",
  "barInsight": "Brief comparison insight, or a factual no-data statement"
}
Keep each field under 70 words.
`.trim()

function isTransientGeminiError(error) {
  const value = `${error?.status ?? ''} ${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase()
  return ['429', '503', 'resource_exhausted', 'unavailable', 'high demand', 'fetch failed', 'timeout']
    .some(fragment => value.includes(fragment))
}

async function withGeminiRetry(operation, attempts = 3) {
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (!isTransientGeminiError(error) || attempt === attempts) throw error

      logger.warn('Transient Gemini error; retrying.', {
        attempt,
        message: error.message,
      })
      await new Promise(resolve => setTimeout(resolve, attempt * 350))
    }
  }

  throw lastError
}

async function withModelFallback(operation) {
  const models = [...new Set([env.geminiModel, env.geminiFallbackModel].filter(Boolean))]
  let lastError

  for (const model of models) {
    try {
      return await withGeminiRetry(() => operation(model), 2)
    } catch (error) {
      lastError = error
      if (!isTransientGeminiError(error) || model === models.at(-1)) throw error

      logger.warn('Preferred Gemini model is unavailable; trying fallback model.', {
        fallbackModel: models[models.indexOf(model) + 1],
        model,
      })
    }
  }

  throw lastError
}

function selectionPrompt({ context = [], message, previousIntent }) {
  return `
Today's date is ${new Date().toISOString().slice(0, 10)}.

Recent conversation:
${JSON.stringify(context.slice(-8))}

Previous validated workforce intent:
${JSON.stringify(previousIntent)}

Current user question:
${message}

Choose the single best workforce function and populate only arguments supported by its schema.
  `.trim()
}

function selectionConfig(mode) {
  return {
    systemInstruction: TOOL_SELECTION_INSTRUCTION,
    temperature: 0.1,
    toolConfig: {
      functionCallingConfig: {
        allowedFunctionNames: mode === FunctionCallingConfigMode.ANY ? WORKFORCE_TOOL_NAMES : undefined,
        mode,
      },
    },
    tools: [{ functionDeclarations: WORKFORCE_TOOL_DECLARATIONS }],
  }
}

/**
 * Ask Gemini to select one fixed API-backed workforce tool.
 * A deterministic closest-match intent is returned only when Gemini is unavailable
 * or produces an invalid function call.
 */
export async function generateReportIntent({
  client = getGeminiClient(),
  context,
  message,
  previousIntent,
}) {
  if (!client) {
    const intent = createFallbackToolSelection(message, previousIntent, 'Gemini is not configured')
    logQueryMiss({
      args: intent.toolArguments,
      functionCalled: intent.toolName,
      query: message,
      reason: 'gemini_not_configured',
    })
    return { intent, toolContext: null }
  }

  try {
    const { chat, response } = await withModelFallback(async (model) => {
      const nextChat = client.chats.create({ model })
      const nextResponse = await nextChat.sendMessage({
        config: selectionConfig(FunctionCallingConfigMode.ANY),
        message: selectionPrompt({ context, message, previousIntent }),
      })
      return { chat: nextChat, response: nextResponse }
    })
    const functionCall = response.functionCalls?.[0]

    if (!functionCall) {
      const error = new Error('Gemini did not select a workforce function.')
      error.code = 'GEMINI_NO_FUNCTION_CALL'
      throw error
    }

    const intent = buildIntentFromToolCall(functionCall, { message, previousIntent })

    return {
      intent,
      toolContext: {
        chat,
        functionCall: {
          args: functionCall.args ?? {},
          id: functionCall.id,
          name: functionCall.name,
        },
      },
    }
  } catch (error) {
    logger.warn('Gemini workforce tool selection failed; using closest safe fallback.', {
      code: error.code,
      message: error.message,
    })

    const intent = createFallbackToolSelection(message, previousIntent, 'Gemini tool selection failed')
    logQueryMiss({
      args: intent.toolArguments,
      functionCalled: intent.toolName,
      query: message,
      reason: error.code ?? 'gemini_tool_selection_failed',
    })

    return { intent, toolContext: null }
  }
}

function toolResponsePayload(payload) {
  return {
    appliedFilters: payload.appliedFilters,
    assumption: payload.assumption ?? null,
    rowCount: payload.rows.length,
    rows: payload.rows.slice(0, 100),
    summaryCards: payload.summaryCards,
    tool: payload.toolName,
    userQuery: payload.userQuery,
  }
}

export async function generateResultSummary(payload) {
  const client = getGeminiClient()
  if (!client) return null

  try {
    if (payload.toolContext?.chat && payload.toolContext.functionCall?.name) {
      const call = payload.toolContext.functionCall
      const response = await withGeminiRetry(() => payload.toolContext.chat.sendMessage({
        config: {
          ...selectionConfig(FunctionCallingConfigMode.NONE),
          responseMimeType: 'application/json',
          systemInstruction: GROUNDED_RESPONSE_INSTRUCTION,
        },
        message: [{
          functionResponse: {
            id: call.id,
            name: call.name,
            response: { output: toolResponsePayload(payload) },
          },
        }],
      }))

      return String(response.text ?? '').trim() || null
    }

    const response = await withModelFallback((model) => client.models.generateContent({
      contents: buildSummaryPrompt(payload),
      model,
      config: {
        responseMimeType: 'application/json',
        systemInstruction: GROUNDED_RESPONSE_INSTRUCTION,
        temperature: 0.1,
      },
    }))

    return String(response.text ?? '').trim() || null
  } catch (error) {
    logger.warn('Gemini grounded response generation failed.', {
      code: error.code,
      message: error.message,
    })
    return null
  }
}
