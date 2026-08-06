const formatMessage = (level, message, details) => ({
  details,
  level,
  message,
  timestamp: new Date().toISOString(),
})

export const logger = {
  debug: (message, details) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, details))
    }
  },
  error: (message, details) => {
    console.error(formatMessage('error', message, details))
  },
  info: (message, details) => {
    console.info(formatMessage('info', message, details))
  },
  warn: (message, details) => {
    console.warn(formatMessage('warn', message, details))
  },
}
