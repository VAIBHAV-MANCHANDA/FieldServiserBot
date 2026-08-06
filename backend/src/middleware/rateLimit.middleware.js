import rateLimit from 'express-rate-limit'

export const apiRateLimit = rateLimit({
  legacyHeaders: false,
  limit: 300,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
})

export const chatRateLimit = rateLimit({
  handler: (req, res) => {
    res.status(429).json({
      code: 'CHAT_RATE_LIMITED',
      message: 'Too many chat requests. Please wait a moment and try again.',
      success: false,
    })
  },
  legacyHeaders: false,
  limit: 30,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
})
