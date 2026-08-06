import axios from 'axios'

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api',
  timeout: 20000,
})

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ??
      error.message ??
      'Unable to reach the analytics API.'

    const normalized = new Error(message)
    normalized.code = error.response?.data?.code ?? 'API_ERROR'
    normalized.status = error.response?.status
    normalized.payload = error.response?.data
    throw normalized
  },
)

export default axiosClient
