import React, { useState, useEffect } from 'react';
import { getAllLeaveRequests, updateLeaveRequestStatus } from '../api';

const HRLeaveManagement = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [hrComment, setHrComment] = useState('');

  useEffect(() => {
    fetchAllRequests();
  }, []);

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const response = await getAllLeaveRequests();
      setRequests(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId, status) => {
    setError('');
    setSuccess('');

    try {
      await updateLeaveRequestStatus(requestId, {
        status,
        hr_comment: hrComment || null
      });
      setSuccess(`Demande ${status === 'approved' ? 'approuvée' : 'rejetée'} avec succès!`);
      setSelectedRequest(null);
      setHrComment('');
      fetchAllRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'var(--md-sys-color-tertiary)';
      case 'approved': return 'var(--md-sys-color-primary)';
      case 'rejected': return 'var(--md-sys-color-error)';
      default: return 'var(--md-sys-color-outline)';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'approved': return 'Approuvée';
      case 'rejected': return 'Rejetée';
      default: return status;
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--md-sys-color-primary)' }}>
          📊 Gestion des Demandes (DRH)
        </h2>

        {error && (
          <div className="px-4 py-3 rounded-xl mb-4" style={{
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div className="px-4 py-3 rounded-xl mb-4" style={{
            backgroundColor: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)'
          }}>
            {success}
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl text-center" style={{
            backgroundColor: 'var(--md-sys-color-tertiary-container)',
            color: 'var(--md-sys-color-on-tertiary-container)'
          }}>
            <div className="text-3xl font-bold">{pendingCount}</div>
            <div className="text-sm">En attente</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{
            backgroundColor: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)'
          }}>
            <div className="text-3xl font-bold">{approvedCount}</div>
            <div className="text-sm">Approuvées</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)'
          }}>
            <div className="text-3xl font-bold">{rejectedCount}</div>
            <div className="text-sm">Rejetées</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Toutes ({requests.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          >
            En attente ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg font-medium ${filter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Approuvées ({approvedCount})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-lg font-medium ${filter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Rejetées ({rejectedCount})
          </button>
        </div>

        {/* Liste des demandes */}
        {loading ? (
          <p>Chargement...</p>
        ) : filteredRequests.length === 0 ? (
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            Aucune demande dans cette catégorie
          </p>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded-xl border-2"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-variant)',
                  borderColor: getStatusColor(request.status)
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2">
                    <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{
                      backgroundColor: request.type === 'absence' 
                        ? 'var(--md-sys-color-tertiary-container)' 
                        : 'var(--md-sys-color-secondary-container)',
                      color: request.type === 'absence'
                        ? 'var(--md-sys-color-on-tertiary-container)'
                        : 'var(--md-sys-color-on-secondary-container)'
                    }}>
                      {request.type === 'absence' ? '🏥 Absence' : '🏖️ Congé'}
                    </span>
                  </div>
                  <span className="text-sm font-bold px-3 py-1 rounded-full" style={{
                    backgroundColor: `${getStatusColor(request.status)}20`,
                    color: getStatusColor(request.status)
                  }}>
                    {getStatusText(request.status)}
                  </span>
                </div>

                <div className="space-y-2">
                  <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    <strong>👤 Employé:</strong> {request.employee_email}
                  </p>
                  <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    <strong>📅 Période:</strong> {request.start_date} au {request.end_date}
                  </p>
                  <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    <strong>⏱️ Durée:</strong> {request.days_count} jour(s)
                  </p>
                  <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    <strong>📝 Motif:</strong> {request.reason}
                  </p>
                  {request.hr_comment && (
                    <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      <strong>💬 Commentaire DRH:</strong> {request.hr_comment}
                    </p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Créée le: {new Date(request.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {request.status === 'pending' && (
                  <div className="mt-4">
                    {selectedRequest === request.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={hrComment}
                          onChange={(e) => setHrComment(e.target.value)}
                          placeholder="Commentaire (optionnel)..."
                          className="input-field"
                          rows="3"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(request.id, 'approved')}
                            className="flex-1 px-4 py-2 rounded-lg font-medium"
                            style={{
                              backgroundColor: 'var(--md-sys-color-primary)',
                              color: 'var(--md-sys-color-on-primary)'
                            }}
                          >
                            ✅ Approuver
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(request.id, 'rejected')}
                            className="flex-1 px-4 py-2 rounded-lg font-medium"
                            style={{
                              backgroundColor: 'var(--md-sys-color-error)',
                              color: 'var(--md-sys-color-on-error)'
                            }}
                          >
                            ❌ Rejeter
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(null);
                              setHrComment('');
                            }}
                            className="btn-secondary px-4 py-2"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedRequest(request.id)}
                        className="btn-primary"
                      >
                        📋 Traiter cette demande
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HRLeaveManagement;
