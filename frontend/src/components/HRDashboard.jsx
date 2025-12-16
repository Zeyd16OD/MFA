import React, { useState, useEffect } from 'react';
import { getReceivedMessages, decryptMessage } from '../api';
import HRLeaveManagement from './HRLeaveManagement';

const HRDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('leave-management'); // 'leave-management' or 'messages'
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState({});
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await getReceivedMessages();
      setMessages(response.data);
      setStatus(`✅ Loaded ${response.data.length} encrypted messages`);
    } catch (err) {
      setStatus('❌ Failed to load messages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async (messageId) => {
    setLoading(true);
    setStatus('🔄 Decrypting message...');

    try {
      const response = await decryptMessage(messageId);
      setDecryptedMessages({
        ...decryptedMessages,
        [messageId]: response.data.decrypted_content,
      });
      setStatus('✅ Message decrypted successfully');
    } catch (err) {
      setStatus('❌ Decryption failed: ' + (err.response?.data?.detail || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--md-sys-color-background)' }}>
      {/* Header */}
      <div className="p-4 shadow-md" style={{ backgroundColor: 'var(--md-sys-color-secondary)', color: 'var(--md-sys-color-on-secondary)' }}>
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">HR Manager Dashboard</h1>
            <p className="text-sm opacity-90">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-full hover:opacity-90 transition"
            style={{ backgroundColor: 'var(--md-sys-color-on-secondary)', color: 'var(--md-sys-color-secondary)' }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('leave-management')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'leave-management' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            📋 Gestion des Demandes
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'messages' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            📬 Messages Chiffrés
          </button>
        </div>

        {activeTab === 'leave-management' ? (
          <HRLeaveManagement />
        ) : (
          <>
            {/* Status Banner */}
            {status && (
              <div className="p-4 rounded-2xl mb-6" style={{
                backgroundColor: status.includes('❌') ? 'var(--md-sys-color-error-container)' :
                  status.includes('✅') ? 'var(--md-sys-color-tertiary-container)' :
                  'var(--md-sys-color-secondary-container)',
                color: status.includes('❌') ? 'var(--md-sys-color-on-error-container)' :
                  status.includes('✅') ? 'var(--md-sys-color-on-tertiary-container)' :
                  'var(--md-sys-color-on-secondary-container)'
              }}>
                {status}
              </div>
            )}

            {/* Messages List */}
            <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>📬 Encrypted Leave Requests</h2>
            <button
              onClick={fetchMessages}
              disabled={loading}
              className="btn-secondary disabled:opacity-50"
            >
              🔄 Refresh
            </button>
          </div>

          {loading && messages.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>No messages received yet</div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="rounded-2xl p-4 hover:shadow-lg transition" style={{ 
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)'
                }}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                        <strong>From:</strong> {msg.from_email} ({msg.from_role})
                      </p>
                      <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        {new Date(msg.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDecrypt(msg.id)}
                      disabled={loading || decryptedMessages[msg.id]}
                      className="px-4 py-2 rounded-full text-sm transition disabled:opacity-50"
                      style={{ 
                        backgroundColor: decryptedMessages[msg.id] ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-tertiary)',
                        color: decryptedMessages[msg.id] ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-tertiary)'
                      }}
                    >
                      {decryptedMessages[msg.id] ? '✅ Decrypted' : '🔓 Decrypt'}
                    </button>
                  </div>

                  {decryptedMessages[msg.id] ? (
                    <div className="rounded-xl p-4 mt-3" style={{ 
                      backgroundColor: 'var(--md-sys-color-tertiary-container)',
                      border: '1px solid var(--md-sys-color-tertiary)'
                    }}>
                      <h4 className="font-bold mb-2" style={{ color: 'var(--md-sys-color-on-tertiary-container)' }}>📄 Decrypted Content:</h4>
                      <div className="space-y-1 text-sm" style={{ color: 'var(--md-sys-color-on-tertiary-container)' }}>
                        <p><strong>Employee:</strong> {decryptedMessages[msg.id].employee_name}</p>
                        <p><strong>Start Date:</strong> {decryptedMessages[msg.id].start_date}</p>
                        <p><strong>End Date:</strong> {decryptedMessages[msg.id].end_date}</p>
                        <p><strong>Days:</strong> {decryptedMessages[msg.id].days}</p>
                        <p><strong>Reason:</strong> {decryptedMessages[msg.id].reason}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl p-4 mt-3" style={{ 
                      backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                      border: '1px solid var(--md-sys-color-outline-variant)'
                    }}>
                      <p className="text-xs font-mono break-all" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <strong>Encrypted:</strong> {msg.encrypted_content.substring(0, 100)}...
                      </p>
                      <p className="text-xs font-mono mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <strong>IV:</strong> {msg.iv}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 rounded-2xl p-4" style={{ 
          backgroundColor: 'var(--md-sys-color-secondary-container)',
          border: '1px solid var(--md-sys-color-outline-variant)'
        }}>
          <h3 className="font-bold mb-2" style={{ color: 'var(--md-sys-color-on-secondary-container)' }}>🔐 Security Information</h3>
          <ul className="text-sm space-y-1" style={{ color: 'var(--md-sys-color-on-secondary-container)' }}>
            <li>• Messages are encrypted end-to-end using AES-256</li>
            <li>• Decryption uses shared secret from Diffie-Hellman exchange</li>
            <li>• Only you (HR Manager) can decrypt these messages</li>
            <li>• Original encryption keys are never transmitted over the network</li>
          </ul>
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HRDashboard;
