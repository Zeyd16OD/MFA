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

// ================================================================
// DAC FEATURE 1: Document Sharing (HRU Matrix)
// ================================================================
export const createDocument = (title, content, is_confidential = false) =>
  api.post('/documents', { title, content, is_confidential });

export const getMyDocuments = () =>
  api.get('/documents');

export const getDocument = (doc_id) =>
  api.get(`/documents/${doc_id}`);

export const updateDocument = (doc_id, title, content, is_confidential) =>
  api.put(`/documents/${doc_id}`, { title, content, is_confidential });

export const shareDocumentDAC = (document_id, target_user_id, permissions) =>
  api.post('/documents/share/dac', { document_id, target_user_id, permissions });

export const shareDocumentSecure = (document_id, target_user_id, permissions, can_reshare = false) =>
  api.post('/documents/share/secure', { document_id, target_user_id, permissions, can_reshare });

export const getACLMatrix = () =>
  api.get('/documents/acl-matrix');

export const revokeDocumentAccess = (doc_id, user_id) =>
  api.delete(`/documents/${doc_id}/acl/${user_id}`);

// ================================================================
// DAC FEATURE 2: Delegation (Take-Grant)
// ================================================================
export const createDelegationDAC = (delegate_to_user_id, rights) =>
  api.post('/delegations/dac', { delegate_to_user_id, rights });

export const createDelegationSecure = (delegate_to_user_id, rights, max_depth = 1, expires_in_hours = 24) =>
  api.post('/delegations/secure', { delegate_to_user_id, rights, max_depth, expires_in_hours });

export const getMyDelegations = () =>
  api.get('/delegations/my');

export const getMyDelegatedRights = () =>
  api.get('/delegations/my-rights');

export const getDelegationGraph = () =>
  api.get('/delegations/graph');

export const revokeDelegation = (delegation_id) =>
  api.delete(`/delegations/${delegation_id}`);

// Users list for sharing/delegation
export const listUsers = () =>
  api.get('/users/list');

export default api;
