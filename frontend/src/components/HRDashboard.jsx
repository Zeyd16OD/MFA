import React, { useState } from 'react';
import HRLeaveManagement from './HRLeaveManagement';
import DACModule from './DACModule';

const HRDashboard = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('leave'); // 'leave' or 'dac'

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

      {/* Navigation Tabs */}
      <div className="container mx-auto px-6 pt-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveSection('leave')}
            className={`px-6 py-3 rounded-full font-medium transition ${activeSection === 'leave' ? 'shadow-lg' : ''}`}
            style={{
              backgroundColor: activeSection === 'leave' ? 'var(--md-sys-color-secondary)' : 'var(--md-sys-color-surface-variant)',
              color: activeSection === 'leave' ? 'var(--md-sys-color-on-secondary)' : 'var(--md-sys-color-on-surface-variant)'
            }}
          >
            📋 Gestion des congés
          </button>
          <button
            onClick={() => setActiveSection('dac')}
            className={`px-6 py-3 rounded-full font-medium transition ${activeSection === 'dac' ? 'shadow-lg' : ''}`}
            style={{
              backgroundColor: activeSection === 'dac' ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-surface-variant)',
              color: activeSection === 'dac' ? 'var(--md-sys-color-on-error)' : 'var(--md-sys-color-on-surface-variant)'
            }}
          >
            🔓 Module DAC
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-6">
        {activeSection === 'leave' && (
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

        {activeSection === 'dac' && (
          <DACModule user={user} />
        )}
      </div>
    </div>
  );
};

export default HRDashboard;
