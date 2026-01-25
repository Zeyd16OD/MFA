import React, { useState } from 'react';
import LeaveRequestForm from './LeaveRequestForm';
import DACModule from './DACModule';

const EmployeeDashboard = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('leave'); // 'leave' or 'dac'

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

      {/* Navigation Tabs */}
      <div className="container mx-auto px-6 pt-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveSection('leave')}
            className={`px-6 py-3 rounded-full font-medium transition ${activeSection === 'leave' ? 'shadow-lg' : ''}`}
            style={{
              backgroundColor: activeSection === 'leave' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-variant)',
              color: activeSection === 'leave' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)'
            }}
          >
            📝 Demandes de congés
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
              backgroundColor: 'var(--md-sys-color-primary-container)',
              border: '1px solid var(--md-sys-color-outline-variant)'
            }}>
              <h3 className="font-bold mb-2" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>
                🔐 Communication Sécurisée
              </h3>
              <p className="text-sm" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>
                Lorsque vous soumettez une demande, elle sera d'abord envoyée à l'Admin pour autorisation. 
                Une fois approuvée, l'Admin établira un canal de communication sécurisé (échange de clés Diffie-Hellman) 
                et votre demande chiffrée sera transmise au RH.
              </p>
            </div>

            {/* Leave Request Form */}
            <LeaveRequestForm />
          </>
        )}

        {activeSection === 'dac' && (
          <DACModule user={user} />
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
