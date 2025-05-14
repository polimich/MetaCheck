import axios from 'axios';

// Axios instance for API requests
export default axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 60000,
});
