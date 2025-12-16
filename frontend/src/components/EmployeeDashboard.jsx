import React, { useState, useEffect } from 'react';
import { getDHParams, exchangeDHKeys, submitLeaveRequest } from '../api';
import {
  generatePrivateKey,
  calculatePublicKey,
  calculateSharedSecret,
  deriveAESKey,
  aesEncrypt,
  bigIntToHex,
} from '../crypto';
import LeaveRequestForm from './LeaveRequestForm';

const EmployeeDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('leave-requests'); // 'leave-requests' or 'messaging'
  const [dhParams, setDhParams] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [sharedSecret, setSharedSecret] = useState(null);
  const [aesKey, setAesKey] = useState(null);
  const [keyExchangeComplete, setKeyExchangeComplete] = useState(false);

  // Leave request form
  const [leaveForm, setLeaveForm] = useState({
    employee_name: '',
    start_date: '',
    end_date: '',
    reason: '',
    days: 1,
  });

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch DH parameters on mount
  useEffect(() => {
    fetchDHParams();
  }, []);

  const fetchDHParams = async () => {
    try {
      const response = await getDHParams();
      setDhParams(response.data);
      setStatus('✅ DH Parameters received from TTP');
    } catch (err) {
      setStatus('❌ Failed to fetch DH parameters');
      console.error(err);
    }
  };

  const performKeyExchange = async () => {
    if (!dhParams) {
      setStatus('❌ DH parameters not available');
      return;
    }

    setLoading(true);
    setStatus('🔄 Performing Diffie-Hellman key exchange...');

    try {
      const p = dhParams.p;
      const g = dhParams.g;

      // Generate private key
      const privKey = generatePrivateKey(p);
      setPrivateKey(privKey);
      setStatus('✅ Private key generated');

      // Calculate public key A = g^a mod p
      const pubKey = calculatePublicKey(g, privKey, p);
      setPublicKey(pubKey);
      setStatus('✅ Public key calculated');

      // Send public key to server and receive B
      const response = await exchangeDHKeys(bigIntToHex(pubKey));
      const serverPublicKey = response.data.public_key;
      setStatus('✅ Server public key received');

      // Calculate shared secret S = B^a mod p
      const secret = calculateSharedSecret(serverPublicKey, privKey, p);
      setSharedSecret(secret);
      setStatus('✅ Shared secret calculated');

      // Derive AES key from shared secret
      const key = await deriveAESKey(secret);
      setAesKey(key);
      setKeyExchangeComplete(true);
      setStatus('🎉 Key exchange complete! You can now send encrypted messages.');
    } catch (err) {
      setStatus('❌ Key exchange failed: ' + (err.response?.data?.detail || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLeaveForm({ ...leaveForm, [name]: value });
  };

  const handleSubmitLeaveRequest = async (e) => {
    e.preventDefault();

    if (!keyExchangeComplete || !aesKey) {
      setStatus('❌ Please complete key exchange first');
      return;
    }

    setLoading(true);
    setStatus('🔄 Encrypting and sending leave request...');

    try {
      // Convert form data to JSON
      const plaintext = JSON.stringify(leaveForm);

      // Encrypt with AES
      const { encrypted, iv } = await aesEncrypt(plaintext, aesKey);

      // Send encrypted message
      await submitLeaveRequest(encrypted, iv);

      setStatus('✅ Leave request submitted successfully!');
      
      // Reset form
      setLeaveForm({
        employee_name: '',
        start_date: '',
        end_date: '',
        reason: '',
        days: 1,
      });
    } catch (err) {
      setStatus('❌ Failed to submit leave request: ' + (err.response?.data?.detail || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--md-sys-color-background)' }}>
      {/* Header */}
      <div className="p-4 shadow-md" style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Employee Dashboard</h1>
            <p className="text-sm opacity-90">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-full hover:opacity-90 transition"
            style={{ backgroundColor: 'var(--md-sys-color-on-primary)', color: 'var(--md-sys-color-primary)' }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('leave-requests')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'leave-requests' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            📋 Demandes d'Absence/Congés
          </button>
          <button
            onClick={() => setActiveTab('messaging')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'messaging' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            � Messagerie Sécurisée
          </button>
        </div>

        {activeTab === 'leave-requests' ? (
          <LeaveRequestForm />
        ) : (
          <>
            {/* Status Banner */}
            {status && (
              <div className="p-4 rounded-2xl mb-6" style={{
                backgroundColor: status.includes('❌') ? 'var(--md-sys-color-error-container)' :
                  status.includes('✅') || status.includes('🎉') ? 'var(--md-sys-color-tertiary-container)' :
                  'var(--md-sys-color-primary-container)',
                color: status.includes('❌') ? 'var(--md-sys-color-on-error-container)' :
                  status.includes('✅') || status.includes('🎉') ? 'var(--md-sys-color-on-tertiary-container)' :
                  'var(--md-sys-color-on-primary-container)'
              }}>
                {status}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Key Exchange Section */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>🔐 Secure Key Exchange</h2>
            
            {!keyExchangeComplete ? (
              <>
                <p className="mb-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Perform Diffie-Hellman key exchange to establish secure communication with HR Manager.
                </p>
                
                <button
                  onClick={performKeyExchange}
                  disabled={loading || !dhParams}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {loading ? '🔄 Exchanging Keys...' : '🚀 Start Key Exchange'}
                </button>

                {dhParams && (
                  <div className="mt-4 text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    <p className="font-mono">p: {dhParams.p.substring(0, 30)}...</p>
                    <p className="font-mono">g: {dhParams.g}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center" style={{ color: 'var(--md-sys-color-tertiary)' }}>
                  <span className="text-2xl mr-2">✅</span>
                  <span className="font-bold">Secure channel established!</span>
                </div>
                <div className="text-xs space-y-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <p className="font-mono truncate">Public Key: {bigIntToHex(publicKey).substring(0, 40)}...</p>
                  <p className="font-mono truncate">Shared Secret: {bigIntToHex(sharedSecret).substring(0, 40)}...</p>
                </div>
                <button
                  onClick={performKeyExchange}
                  className="btn-secondary w-full"
                >
                  🔄 Refresh Keys
                </button>
              </div>
            )}
          </div>

          {/* Leave Request Form */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>📝 Leave Request (Encrypted)</h2>
            
            <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Employee Name
                </label>
                <input
                  type="text"
                  name="employee_name"
                  value={leaveForm.employee_name}
                  onChange={handleInputChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={leaveForm.start_date}
                  onChange={handleInputChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={leaveForm.end_date}
                  onChange={handleInputChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Number of Days
                </label>
                <input
                  type="number"
                  name="days"
                  value={leaveForm.days}
                  onChange={handleInputChange}
                  min="1"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Reason
                </label>
                <textarea
                  name="reason"
                  value={leaveForm.reason}
                  onChange={handleInputChange}
                  rows="3"
                  className="input-field"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !keyExchangeComplete}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? '🔒 Encrypting...' : '🔒 Submit Encrypted Request'}
              </button>
            </form>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 rounded-2xl p-4" style={{ 
          backgroundColor: 'var(--md-sys-color-primary-container)', 
          border: '1px solid var(--md-sys-color-outline-variant)' 
        }}>
          <h3 className="font-bold mb-2" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>🔐 Security Information</h3>
          <ul className="text-sm space-y-1" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>
            <li>• All communications use Diffie-Hellman key exchange</li>
            <li>• Messages are encrypted with AES-256-CBC</li>
            <li>• Only HR Manager can decrypt your requests</li>
            <li>• Your private key never leaves your browser</li>
          </ul>
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
