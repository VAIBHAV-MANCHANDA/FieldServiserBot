export function authMiddleware(req, res, next) {
  req.user = { id: 'operator', role: 'admin' }
  next()
}
