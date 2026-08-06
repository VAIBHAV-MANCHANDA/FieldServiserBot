export function login() {
  return {
    token: 'development-session',
    user: {
      id: 'operator',
      name: 'Field Operator',
      role: 'admin',
    },
  }
}
