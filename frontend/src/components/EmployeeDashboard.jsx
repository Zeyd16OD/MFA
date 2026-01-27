import React, { useState, useEffect } from 'react';
import LeaveRequestForm from './LeaveRequestForm';
import DACFeatures from './DACFeatures';
import HRLeaveManagement from './HRLeaveManagement';
import { getMyDelegatedRights } from '../api';

const EmployeeDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('leave'); // 'leave', 'dac', 'hr_management'
  const [delegatedRights, setDelegatedRights] = useState(null);
  const [loadingRights, setLoadingRights] = useState(true);

  useEffect(() => {
    fetchDelegatedRights();
  }, []);

  const fetchDelegatedRights = async () => {
    try {
      const response = await getMyDelegatedRights();
      setDelegatedRights(response.data);
    } catch (err) {
      console.error('Erreur lors de la récupération des droits délégués:', err);
      setDelegatedRights({ delegated_rights: [], has_view_requests: false, has_approve_leave: false });
    } finally {
      setLoadingRights(false);
    }
  };

  // Vérifier si l'utilisateur a des droits de gestion des demandes
  const hasHRDelegation = delegatedRights?.has_view_requests || delegatedRights?.has_approve_leave;

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
        <div className="flex gap-2 mb-6 flex-wrap">
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
          {/* Onglet Gestion des Demandes - Visible uniquement si délégation active */}
          {!loadingRights && hasHRDelegation && (
            <button
              onClick={() => setActiveTab('hr_management')}
              className={`px-6 py-3 rounded-lg font-medium relative ${
                activeTab === 'hr_management' ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              📋 Gestion des Demandes
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                Délégué
              </span>
            </button>
          )}
        </div>

        {/* Delegation Info Banner - Only shown if user has delegation */}
        {!loadingRights && hasHRDelegation && (
          <div className="p-4 rounded-2xl mb-6 bg-amber-50 border border-amber-200">
            <h3 className="font-bold mb-2 text-amber-800">
              🎖️ Droits Délégués Actifs
            </h3>
            <p className="text-sm text-amber-700">
              Vous avez reçu une délégation du RH Manager. Droits accordés : 
              <span className="font-bold ml-1">
                {delegatedRights.delegated_rights.join(', ')}
              </span>
            </p>
            {delegatedRights.has_approve_leave && (
              <p className="text-sm text-green-700 mt-1">
                ✅ Vous pouvez approuver/rejeter les demandes de congé
              </p>
            )}
            {delegatedRights.has_view_requests && !delegatedRights.has_approve_leave && (
              <p className="text-sm text-blue-700 mt-1">
                👁️ Vous pouvez consulter les demandes (lecture seule)
              </p>
            )}
          </div>
        )}

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

        {/* HR Management Tab - Délégation */}
        {activeTab === 'hr_management' && hasHRDelegation && (
          <div>
            {/* Warning banner for delegated access */}
            <div className="p-4 rounded-2xl mb-6 bg-amber-100 border-2 border-amber-400">
              <h3 className="font-bold mb-2 text-amber-800">
                ⚠️ Mode Délégation Active
              </h3>
              <p className="text-sm text-amber-700">
                Vous agissez en tant que délégué du RH Manager. Toutes vos actions sont enregistrées.
                {!delegatedRights.has_approve_leave && (
                  <span className="block mt-1 text-red-600 font-bold">
                    ⛔ Vous avez uniquement le droit de consultation (pas d'approbation).
                  </span>
                )}
              </p>
            </div>
            
            {/* Composant de gestion des demandes */}
            <HRLeaveManagement 
              isDelegated={true} 
              canApprove={delegatedRights.has_approve_leave}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
