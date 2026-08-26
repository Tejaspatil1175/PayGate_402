import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor for injecting auth token and user ID
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('paygate_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const storedUser = localStorage.getItem('paygate_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user._id || user.id) {
          config.headers['x-user-id'] = user._id || user.id;
        }
      } catch (err) {
        // ignore parse error
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear expired credentials if needed
      // localStorage.removeItem('paygate_token');
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default apiClient;
