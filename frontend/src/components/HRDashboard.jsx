import React, { useState } from 'react';
import HRLeaveManagement from './HRLeaveManagement';
import DACFeatures from './DACFeatures';

const HRDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('leave'); // 'leave', 'dac'

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
            onClick={() => setActiveTab('leave')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'leave' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            📋 Gestion des Demandes
          </button>
          <button
            onClick={() => setActiveTab('dac')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'dac' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            🔐 DAC Features
          </button>
        </div>

        {/* Leave Management Tab */}
        {activeTab === 'leave' && (
          <>
            {/* Info Banner */}
            <div className="p-4 rounded-2xl mb-6" style={{ 
              backgroundColor: 'var(--md-sys-color-secondary-container)',
              border: '1px solid var(--md-sys-color-outline-variant)'
            }}>
              <h3 className="font-bold mb-2" style={{ color: 'var(--md-sys-color-on-secondary-container)' }}>
                🔐 Communication Sécurisée
              </h3>
              <p className="text-sm" style={{ color: 'var(--md-sys-color-on-secondary-container)' }}>
                Les demandes reçues ont été autorisées par l'Admin et transmises via un canal sécurisé 
                (échange de clés Diffie-Hellman + chiffrement AES-256).
              </p>
            </div>

            {/* Leave Management */}
            <HRLeaveManagement />
          </>
        )}

        {/* DAC Features Tab */}
        {activeTab === 'dac' && (
          <DACFeatures user={user} />
        )}
      </div>
    </div>
  );
};

export default HRDashboard;
