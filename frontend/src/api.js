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

export const resendOTP = (email, password) => 
  api.post('/auth/resend-otp', { email, password });

export const cancelOTP = (email) => 
  api.post('/auth/cancel-otp', { email });

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

// Leave Request endpoints
export const createLeaveRequest = (requestData) => 
  api.post('/leave-requests', requestData);

export const getMyLeaveRequests = () => 
  api.get('/leave-requests/my-requests');

export const getAllLeaveRequests = () => 
  api.get('/leave-requests/all');

export const updateLeaveRequestStatus = (requestId, updateData) => 
  api.put(`/leave-requests/${requestId}/status`, updateData);

export const deleteLeaveRequest = (requestId) => 
  api.delete(`/leave-requests/${requestId}`);

// Admin endpoints
export const createUser = (userData) => 
  api.post('/admin/users', userData);

export const getAllMessages = () => 
  api.get('/admin/messages');

// Communication Authorization endpoints (Admin)
export const getPendingCommunicationAuths = () =>
  api.get('/communication-auth/pending');

export const getAllCommunicationAuths = () =>
  api.get('/communication-auth/all');

export const updateCommunicationAuth = (authId, action) =>
  api.put(`/communication-auth/${authId}`, { action });

// Communication Authorization endpoints (Employee)
export const getMyCommunicationAuths = () =>
  api.get('/communication-auth/my-requests');

// ==================== DAC (Discretionary Access Control) endpoints ====================

// Document management
export const createDACDocument = (title, content, is_confidential = false) =>
  api.post('/dac/documents', { title, content, is_confidential });

export const getMyDACDocuments = () =>
  api.get('/dac/documents');

export const getDACDocument = (docId) =>
  api.get(`/dac/documents/${docId}`);

export const updateDACDocument = (docId, title, content) =>
  api.put(`/dac/documents/${docId}`, { title, content });

export const deleteDACDocument = (docId) =>
  api.delete(`/dac/documents/${docId}`);

// Document sharing
export const shareDACDocument = (docId, targetUserId, permissions) =>
  api.post(`/dac/documents/${docId}/share`, { 
    target_user_id: targetUserId, 
    permissions 
  });

export const revokeDACShare = (docId, userId) =>
  api.delete(`/dac/documents/${docId}/share/${userId}`);

// Document copying (demonstrates DAC weakness)
export const copyDACDocument = (docId, newTitle) =>
  api.post(`/dac/documents/${docId}/copy`, { new_title: newTitle });

// Users for sharing
export const getDACUsers = () =>
  api.get('/dac/users');

// Audit logs
export const getDACauditLogs = () =>
  api.get('/dac/audit-logs');

export default api;
