import axiosClient from './axiosClient.js'

export async function sendChatQuery({ message, sessionId }) {
  const payload = { message }

  if (sessionId) {
    payload.sessionId = sessionId
  }

  const response = await axiosClient.post('/chat/query', payload)

  return response.data
}

export async function fetchChatSessions() {
  const response = await axiosClient.get('/chat/sessions')
  return response.data.sessions
}

export async function fetchChatSession(sessionId) {
  const response = await axiosClient.get(`/chat/sessions/${sessionId}`)
  return response.data
}

export async function deleteChatSession(sessionId) {
  const response = await axiosClient.delete(`/chat/sessions/${sessionId}`)
  return response.data
}
