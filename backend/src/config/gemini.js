import { GoogleGenAI } from '@google/genai'
import { env } from './env.js'

let client = null

export function getGeminiClient() {
  if (!env.geminiApiKey) {
    return null
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: env.geminiApiKey })
  }

  return client
}
