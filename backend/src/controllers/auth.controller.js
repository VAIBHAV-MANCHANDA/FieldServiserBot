import { sendSuccess } from '../utils/response.js'

export function postLogin(req, res) {
  sendSuccess(res, {
    token: 'development-session',
    user: {
      id: 'operator',
      name: 'Field Operator',
      role: 'admin',
    },
  }, 'Authenticated.')
}
