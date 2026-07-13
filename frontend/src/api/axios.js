import axios from 'axios'
import { useAuthStore } from '../store/authStore'

/**
 * Axios instance — wired to real backend via Vite proxy.
 * 
 * In dev: Vite proxies /api/* → http://localhost:3000/api/*
 * In prod: Set VITE_API_URL to your deployed backend URL.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true // send cookies with requests
})

// Request interceptor — inject auth token + org header
api.interceptors.request.use((config) => {
  const { accessToken, activeOrgId } = useAuthStore.getState()

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  if (activeOrgId) {
    config.headers['X-Organization-ID'] = activeOrgId
  }

  return config
})

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Response interceptor — handle 401 (token expired) with silent refresh retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and it's not a retry already
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't refresh if the request failed was already a login/refresh request
      if (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')) {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        const newToken = data.token
        
        useAuthStore.setState({ accessToken: newToken })
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        
        processQueue(null, newToken)
        isRefreshing = false
        
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        isRefreshing = false
        
        useAuthStore.getState().logout()
        window.location.href = '/login?session_expired=true'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
