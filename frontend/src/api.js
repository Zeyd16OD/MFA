import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const login = (email, password) => 
  api.post('/auth/login', { email, password });

export const verifyOTP = (email, otp_code) => 
  api.post('/auth/verify-otp', { email, otp_code });

export const getCurrentUser = () => 
  api.get('/auth/me');

// DH Handshake endpoints
export const getDHParams = () => 
  api.get('/handshake/params');

export const exchangeDHKeys = (public_key) => 
  api.post('/handshake/exchange', { public_key });

// Messaging endpoints
export const submitLeaveRequest = (encrypted_content, iv) => 
  api.post('/requests/leave', { encrypted_content, iv });

export const getReceivedMessages = () => 
  api.get('/messages/received');

export const decryptMessage = (message_id) => 
  api.post(`/messages/${message_id}/decrypt`);

// Admin endpoints
export const createUser = (userData) => 
  api.post('/admin/users', userData);

export const getAllMessages = () => 
  api.get('/admin/messages');

export default api;
