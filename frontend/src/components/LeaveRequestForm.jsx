import React, { useState, useEffect } from 'react';
import { createLeaveRequest, getMyLeaveRequests, deleteLeaveRequest } from '../api';

const LeaveRequestForm = () => {
  const [formData, setFormData] = useState({
    type: 'absence',
    start_date: '',
    end_date: '',
    reason: '',
    days_count: 0
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    try {
      const response = await getMyLeaveRequests();
      setRequests(response.data);
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleDateChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    if (field === 'start_date' || field === 'end_date') {
      newData.days_count = calculateDays(newData.start_date, newData.end_date);
    }
    setFormData(newData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await createLeaveRequest(formData);
      setSuccess('Demande créée avec succès!');
      setFormData({
        type: 'absence',
        start_date: '',
        end_date: '',
        reason: '',
        days_count: 0
      });
      fetchMyRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (requestId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette demande?')) {
      return;
    }

    try {
      await deleteLeaveRequest(requestId);
      setSuccess('Demande supprimée avec succès!');
      fetchMyRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la suppression');
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

  return (
    <div className="space-y-6">
      {/* Formulaire de création */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--md-sys-color-primary)' }}>
          📝 Nouvelle Demande
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Type de demande
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input-field"
              required
            >
              <option value="absence">Absence</option>
              <option value="conge">Congé</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Date de début
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleDateChange('start_date', e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Date de fin
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleDateChange('end_date', e.target.value)}
                className="input-field"
                min={formData.start_date}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Nombre de jours: <span className="font-bold text-lg">{formData.days_count}</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Motif
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="input-field"
              rows="4"
              placeholder="Expliquez le motif de votre demande..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Envoi...' : 'Soumettre la demande'}
          </button>
        </form>
      </div>

      {/* Liste des demandes */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--md-sys-color-primary)' }}>
          📋 Mes Demandes
        </h2>

        {requests.length === 0 ? (
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            Aucune demande pour le moment
          </p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded-xl border-2"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-variant)',
                  borderColor: getStatusColor(request.status)
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
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

                <div className="mt-3 space-y-2">
                  <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    <strong>Période:</strong> {request.start_date} au {request.end_date}
                  </p>
                  <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    <strong>Durée:</strong> {request.days_count} jour(s)
                  </p>
                  <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    <strong>Motif:</strong> {request.reason}
                  </p>
                  {request.hr_comment && (
                    <p style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      <strong>Commentaire DRH:</strong> {request.hr_comment}
                    </p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Créée le: {new Date(request.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {request.status === 'pending' && (
                  <button
                    onClick={() => handleDelete(request.id)}
                    className="mt-3 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--md-sys-color-error-container)',
                      color: 'var(--md-sys-color-on-error-container)'
                    }}
                  >
                    🗑️ Supprimer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveRequestForm;
