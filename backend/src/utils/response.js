export function sendSuccess(res, data, message = 'OK', status = 200) {
  return res.status(status).json({
    data,
    message,
    success: true,
  })
}

export function sendError(res, error, status = 500, code = 'SERVER_ERROR') {
  return res.status(status).json({
    code,
    message: error instanceof Error ? error.message : String(error),
    success: false,
  })
}
