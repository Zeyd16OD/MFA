import React, { useState, useEffect } from 'react';
import { createUser, getAllMessages } from '../api';

const AdminDashboard = ({ user, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // User creation form
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    role: 'employee',
  });

  useEffect(() => {
    fetchAllMessages();
  }, []);

  const fetchAllMessages = async () => {
    setLoading(true);
    try {
      const response = await getAllMessages();
      setMessages(response.data);
      setStatus(`✅ Loaded ${response.data.length} messages`);
    } catch (err) {
      setStatus('❌ Failed to load messages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserForm({ ...userForm, [name]: value });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('🔄 Creating user...');

    try {
      await createUser(userForm);
      setStatus('✅ User created successfully');
      setUserForm({ email: '', password: '', role: 'employee' });
    } catch (err) {
      setStatus('❌ Failed to create user: ' + (err.response?.data?.detail || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--md-sys-color-background)' }}>
      {/* Header */}
      <div className="p-4 shadow-md" style={{ backgroundColor: 'var(--md-sys-color-tertiary)', color: 'var(--md-sys-color-on-tertiary)' }}>
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm opacity-90">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-full hover:opacity-90 transition"
            style={{ backgroundColor: 'var(--md-sys-color-on-tertiary)', color: 'var(--md-sys-color-tertiary)' }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Status Banner */}
        {status && (
          <div className="p-4 rounded-2xl mb-6" style={{
            backgroundColor: status.includes('❌') ? 'var(--md-sys-color-error-container)' :
              status.includes('✅') ? 'var(--md-sys-color-tertiary-container)' :
              'var(--md-sys-color-primary-container)',
            color: status.includes('❌') ? 'var(--md-sys-color-on-error-container)' :
              status.includes('✅') ? 'var(--md-sys-color-on-tertiary-container)' :
              'var(--md-sys-color-on-primary-container)'
          }}>
            {status}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create User Section */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>👤 Create New User</h2>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={userForm.email}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="user@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={userForm.password}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Role
                </label>
                <select
                  name="role"
                  value={userForm.role}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  <option value="employee">Employee</option>
                  <option value="hr_manager">HR Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? '🔄 Creating...' : '➕ Create User'}
              </button>
            </form>
          </div>

          {/* System Overview */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>📊 System Overview</h2>
            
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ 
                border: '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor: 'var(--md-sys-color-surface-container-high)'
              }}>
                <h3 className="font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>Total Messages</h3>
                <p className="text-3xl font-bold" style={{ color: 'var(--md-sys-color-tertiary)' }}>{messages.length}</p>
              </div>

              <div className="rounded-2xl p-4" style={{ 
                border: '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor: 'var(--md-sys-color-surface-container-high)'
              }}>
                <h3 className="font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>Security Features</h3>
                <ul className="text-sm space-y-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <li>✅ Multi-Factor Authentication</li>
                  <li>✅ Diffie-Hellman Key Exchange</li>
                  <li>✅ AES-256 Encryption</li>
                  <li>✅ Email OTP Verification</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="mt-6 card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>📨 All Messages (Encrypted)</h2>
            <button
              onClick={fetchAllMessages}
              disabled={loading}
              className="btn-secondary disabled:opacity-50"
            >
              🔄 Refresh
            </button>
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>No messages in system</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>From</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg, index) => (
                    <tr key={msg.id} style={{ 
                      borderTop: index > 0 ? '1px solid var(--md-sys-color-outline-variant)' : 'none',
                      backgroundColor: 'transparent'
                    }}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{msg.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{msg.from}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{msg.to}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        {new Date(msg.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full" style={{
                          backgroundColor: 'var(--md-sys-color-tertiary-container)',
                          color: 'var(--md-sys-color-on-tertiary-container)'
                        }}>
                          🔒 Encrypted
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
