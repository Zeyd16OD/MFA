import React, { useState } from 'react';
import LeaveRequestForm from './LeaveRequestForm';
import DACFeatures from './DACFeatures';

const EmployeeDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('leave'); // 'leave', 'dac'

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
            onClick={() => setActiveTab('leave')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'leave' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            📝 Demandes de Congé
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

        {/* Leave Request Tab */}
        {activeTab === 'leave' && (
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

        {/* DAC Features Tab */}
        {activeTab === 'dac' && (
          <DACFeatures user={user} />
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
