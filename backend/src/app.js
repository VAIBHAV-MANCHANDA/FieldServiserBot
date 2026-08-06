import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { apiRateLimit } from './middleware/rateLimit.middleware.js'
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js'
import { requestIdMiddleware, requestLogger } from './middleware/requestLogger.middleware.js'
import routes from './routes/index.js'

const app = express()

app.use(requestIdMiddleware)
app.use(helmet())
app.use(cors({ origin: env.clientUrl, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(requestLogger)
app.use(apiRateLimit)

app.use('/api', routes)

app.use(notFoundMiddleware)
app.use(errorMiddleware)

export default app
