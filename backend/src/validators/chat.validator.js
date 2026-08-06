import Joi from 'joi'

const chatQuerySchema = Joi.object({
  message: Joi.string().trim().min(1).max(800).required(),
  sessionId: Joi.string().guid({ version: ['uuidv4'] }).allow(null, '').optional(),
}).unknown(false)

export function validateChatQuery(payload = {}) {
  const { error, value } = chatQuerySchema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  })

  if (error) {
    error.status = 400
    error.code = 'INVALID_CHAT_QUERY'
    throw error
  }

  return {
    ...value,
    sessionId: value.sessionId || undefined,
  }
}
