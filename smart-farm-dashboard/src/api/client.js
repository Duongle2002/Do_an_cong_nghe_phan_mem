import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  // We use Authorization header (JWT in localStorage), not cookies
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken')
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    // Basic 401 handling (optional: implement refresh flow)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      // Redirect to login page
      if (location.pathname !== '/login') location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
