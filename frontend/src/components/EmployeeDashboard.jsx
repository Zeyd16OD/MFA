import React from 'react';
import LeaveRequestForm from './LeaveRequestForm';

const EmployeeDashboard = ({ user, onLogout }) => {
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
      </div>
    </div>
  );
};

export default EmployeeDashboard;
