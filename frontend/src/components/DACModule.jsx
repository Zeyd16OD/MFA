import React, { useState, useEffect } from 'react';
import {
  createDACDocument,
  getMyDACDocuments,
  updateDACDocument,
  deleteDACDocument,
  shareDACDocument,
  revokeDACShare,
  copyDACDocument,
  getDACUsers,
  getDACauditLogs
} from '../api';

const DACModule = ({ user }) => {
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [newDoc, setNewDoc] = useState({ title: '', content: '', is_confidential: false });
  const [shareForm, setShareForm] = useState({ 
    targetUserId: '', 
    read: true, 
    write: false, 
    delete: false, 
    share: false 
  });
  const [copyTitle, setCopyTitle] = useState('');
  const [editDoc, setEditDoc] = useState({ title: '', content: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docsRes, usersRes, logsRes] = await Promise.all([
        getMyDACDocuments(),
        getDACUsers(),
        getDACauditLogs()
      ]);
      setDocuments(docsRes.data);
      setUsers(usersRes.data);
      setAuditLogs(logsRes.data);
    } catch (err) {
      setError('Failed to load data');
    }
    setLoading(false);
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    try {
      await createDACDocument(newDoc.title, newDoc.content, newDoc.is_confidential);
      setSuccess('Document created successfully!');
      setShowCreateModal(false);
      setNewDoc({ title: '', content: '', is_confidential: false });
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create document');
    }
  };

  const handleShareDocument = async (e) => {
    e.preventDefault();
    try {
      const res = await shareDACDocument(selectedDocument.id, parseInt(shareForm.targetUserId), {
        read: shareForm.read,
        write: shareForm.write,
        delete: shareForm.delete,
        share: shareForm.share
      });
      setSuccess(res.data.message);
      if (res.data.security_warning) {
        setError(res.data.security_warning);
      }
      setShowShareModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to share document');
    }
  };

  const handleCopyDocument = async (e) => {
    e.preventDefault();
    try {
      const res = await copyDACDocument(selectedDocument.id, copyTitle);
      setSuccess(res.data.message);
      if (res.data.security_warning) {
        setTimeout(() => setError(res.data.security_warning), 100);
      }
      setShowCopyModal(false);
      setCopyTitle('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to copy document');
    }
  };

  const handleEditDocument = async (e) => {
    e.preventDefault();
    try {
      await updateDACDocument(selectedDocument.id, editDoc.title, editDoc.content);
      setSuccess('Document updated successfully!');
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update document');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDACDocument(docId);
      setSuccess('Document deleted successfully!');
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete document');
    }
  };

  const handleRevokeAccess = async (docId, userId) => {
    try {
      await revokeDACShare(docId, userId);
      setSuccess('Access revoked!');
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to revoke access');
    }
  };

  const openShareModal = (doc) => {
    setSelectedDocument(doc);
    setShareForm({ targetUserId: '', read: true, write: false, delete: false, share: false });
    setShowShareModal(true);
  };

  const openCopyModal = (doc) => {
    setSelectedDocument(doc);
    setCopyTitle(`Copy of ${doc.title}`);
    setShowCopyModal(true);
  };

  const openEditModal = (doc) => {
    setSelectedDocument(doc);
    setEditDoc({ title: doc.title, content: doc.content });
    setShowEditModal(true);
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with DAC explanation */}
      <div className="mb-6 p-4 rounded-2xl" style={{ 
        backgroundColor: 'var(--md-sys-color-error-container)',
        border: '1px solid var(--md-sys-color-error)'
      }}>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-error-container)' }}>
          🔓 Module DAC - Demonstration des Faiblesses
        </h2>
        <p className="text-sm" style={{ color: 'var(--md-sys-color-on-error-container)' }}>
          <strong>Discretionary Access Control (DAC)</strong> permet au propriétaire d'un objet de décider qui peut y accéder.
          Ce module démontre les faiblesses principales du DAC :
        </p>
        <ul className="list-disc ml-6 mt-2 text-sm" style={{ color: 'var(--md-sys-color-on-error-container)' }}>
          <li><strong>Propagation non contrôlée :</strong> Un utilisateur avec droit de partage peut partager avec n'importe qui</li>
          <li><strong>Copie de données :</strong> Les données peuvent être copiées sans les restrictions originales</li>
          <li><strong>Pas de contrôle centralisé :</strong> L'administrateur ne peut pas imposer de politique globale</li>
        </ul>
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-4 p-4 rounded-xl" style={{ 
          backgroundColor: 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-on-primary-container)'
        }}>
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 rounded-xl" style={{ 
          backgroundColor: 'var(--md-sys-color-error-container)',
          color: 'var(--md-sys-color-on-error-container)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-full transition ${activeTab === 'documents' ? 'font-bold' : ''}`}
          style={{
            backgroundColor: activeTab === 'documents' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-variant)',
            color: activeTab === 'documents' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)'
          }}
        >
          📄 Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-full transition ${activeTab === 'audit' ? 'font-bold' : ''}`}
          style={{
            backgroundColor: activeTab === 'audit' ? 'var(--md-sys-color-secondary)' : 'var(--md-sys-color-surface-variant)',
            color: activeTab === 'audit' ? 'var(--md-sys-color-on-secondary)' : 'var(--md-sys-color-on-surface-variant)'
          }}
        >
          📋 Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div>
          {/* Create button - Only for Admin and HR */}
          {user.role !== 'employee' ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mb-4 px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)'
              }}
            >
              + Créer un document
            </button>
          ) : (
            <div className="mb-4 p-4 rounded-xl" style={{ 
              backgroundColor: 'var(--md-sys-color-surface-variant)',
              color: 'var(--md-sys-color-on-surface-variant)'
            }}>
              📄 En tant qu'employé, vous ne pouvez pas créer de documents. Vous pouvez uniquement consulter les documents partagés avec vous.
            </div>
          )}

          {/* Documents list */}
          <div className="grid gap-4">
            {documents.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                {user.role === 'employee' 
                  ? "Aucun document partagé avec vous pour le moment."
                  : "Aucun document. Créez-en un pour commencer."
                }
              </p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-2xl"
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    border: doc.is_confidential ? '2px solid var(--md-sys-color-error)' : '1px solid var(--md-sys-color-outline-variant)'
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                        {doc.is_confidential && '🔒 '}{doc.title}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        Propriétaire: {doc.owner_email} {doc.is_owner && '(vous)'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {doc.my_permissions.write && (
                        <button
                          onClick={() => openEditModal(doc)}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{ backgroundColor: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}
                        >
                          ✏️ Modifier
                        </button>
                      )}
                      {doc.my_permissions.share && (
                        <button
                          onClick={() => openShareModal(doc)}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{ backgroundColor: 'var(--md-sys-color-tertiary-container)', color: 'var(--md-sys-color-on-tertiary-container)' }}
                        >
                          🔗 Partager
                        </button>
                      )}
                      {doc.my_permissions.read && (
                        <button
                          onClick={() => openCopyModal(doc)}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}
                          title="DAC Weakness: Copy data without restrictions"
                        >
                          📋 Copier
                        </button>
                      )}
                      {doc.my_permissions.delete && (
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{ backgroundColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-on-error)' }}
                        >
                          🗑️ Supprimer
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl mb-3" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
                    <p style={{ color: 'var(--md-sys-color-on-surface)' }}>{doc.content}</p>
                  </div>

                  {/* Permissions display */}
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ 
                      backgroundColor: doc.my_permissions.read ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-variant)',
                      color: doc.my_permissions.read ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'
                    }}>
                      {doc.my_permissions.read ? '✓' : '✗'} Lecture
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ 
                      backgroundColor: doc.my_permissions.write ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-variant)',
                      color: doc.my_permissions.write ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'
                    }}>
                      {doc.my_permissions.write ? '✓' : '✗'} Écriture
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ 
                      backgroundColor: doc.my_permissions.delete ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-variant)',
                      color: doc.my_permissions.delete ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'
                    }}>
                      {doc.my_permissions.delete ? '✓' : '✗'} Suppression
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ 
                      backgroundColor: doc.my_permissions.share ? 'var(--md-sys-color-error-container)' : 'var(--md-sys-color-surface-variant)',
                      color: doc.my_permissions.share ? 'var(--md-sys-color-on-error-container)' : 'var(--md-sys-color-on-surface-variant)'
                    }}>
                      {doc.my_permissions.share ? '✓' : '✗'} Partage
                    </span>
                  </div>

                  {/* Shared with */}
                  {doc.is_owner && doc.shared_with && doc.shared_with.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}>
                      <p className="text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        Partagé avec:
                      </p>
                      {doc.shared_with.map((share) => (
                        <div key={share.user_id} className="flex justify-between items-center mb-1">
                          <span className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                            {share.email}
                            <span className="ml-2 text-xs">
                              ({[
                                share.permissions.read && 'R',
                                share.permissions.write && 'W',
                                share.permissions.delete && 'D',
                                share.permissions.share && 'S'
                              ].filter(Boolean).join(', ')})
                            </span>
                          </span>
                          <button
                            onClick={() => handleRevokeAccess(doc.id, share.user_id)}
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ backgroundColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-on-error)' }}
                          >
                            Révoquer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          {auditLogs.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              Aucun log d'audit.
            </p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl"
                style={{
                  backgroundColor: log.security_warning ? 'var(--md-sys-color-error-container)' : 'var(--md-sys-color-surface-container)',
                  border: log.security_warning ? '1px solid var(--md-sys-color-error)' : '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold" style={{ color: log.security_warning ? 'var(--md-sys-color-on-error-container)' : 'var(--md-sys-color-on-surface)' }}>
                      {log.action.toUpperCase()}
                    </span>
                    <span className="ml-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      - {log.document_title}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Par: {log.actor_email}
                  {log.target_user_email && ` → ${log.target_user_email}`}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {log.details}
                </p>
                {log.security_warning && (
                  <p className="text-sm mt-2 font-bold" style={{ color: 'var(--md-sys-color-error)' }}>
                    {log.security_warning}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-6 rounded-2xl max-w-lg w-full mx-4" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Créer un nouveau document
            </h3>
            <form onSubmit={handleCreateDocument}>
              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Titre
                </label>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  className="w-full p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface)' }}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Contenu
                </label>
                <textarea
                  value={newDoc.content}
                  onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                  className="w-full p-3 rounded-xl h-32"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface)' }}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  <input
                    type="checkbox"
                    checked={newDoc.is_confidential}
                    onChange={(e) => setNewDoc({ ...newDoc, is_confidential: e.target.checked })}
                  />
                  🔒 Document confidentiel
                </label>
                <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-error)' }}>
                  ⚠️ DAC Weakness: Le marquage "confidentiel" n'empêche pas le partage ou la copie!
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Document Modal */}
      {showShareModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-6 rounded-2xl max-w-lg w-full mx-4" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Partager "{selectedDocument.title}"
            </h3>
            {user.role === 'hr_manager' ? (
              <p className="text-sm mb-4 p-2 rounded-xl" style={{ backgroundColor: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}>
                ℹ️ En tant que RH, vous ne pouvez donner que l'accès en <strong>lecture seule</strong> aux employés.
              </p>
            ) : (
              <p className="text-sm mb-4 p-2 rounded-xl" style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
                ⚠️ DAC Weakness: Vous pouvez partager ce document avec n'importe qui, même s'il est confidentiel!
              </p>
            )}
            <form onSubmit={handleShareDocument}>
              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Utilisateur
                </label>
                <select
                  value={shareForm.targetUserId}
                  onChange={(e) => setShareForm({ ...shareForm, targetUserId: e.target.value })}
                  className="w-full p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface)' }}
                  required
                >
                  <option value="">Sélectionner un utilisateur</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Permissions
                </label>
                {/* Check if HR is sharing with an employee */}
                {(() => {
                  const selectedUser = users.find(u => u.id === parseInt(shareForm.targetUserId));
                  const isHRSharingWithEmployee = user.role === 'hr_manager' && selectedUser?.role === 'employee';
                  
                  return (
                    <div className="space-y-2">
                      {isHRSharingWithEmployee && (
                        <div className="p-2 mb-2 rounded-lg text-sm" style={{ 
                          backgroundColor: 'var(--md-sys-color-tertiary-container)', 
                          color: 'var(--md-sys-color-on-tertiary-container)' 
                        }}>
                          ℹ️ Partage avec un employé : seule la lecture est autorisée.
                        </div>
                      )}
                      <label className="flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                        <input
                          type="checkbox"
                          checked={isHRSharingWithEmployee ? true : shareForm.read}
                          onChange={(e) => setShareForm({ ...shareForm, read: e.target.checked })}
                          disabled={isHRSharingWithEmployee}
                        />
                        📖 Lecture {isHRSharingWithEmployee && '(obligatoire)'}
                      </label>
                      <label className="flex items-center gap-2" style={{ 
                        color: isHRSharingWithEmployee ? 'var(--md-sys-color-outline)' : 'var(--md-sys-color-on-surface)',
                        opacity: isHRSharingWithEmployee ? 0.5 : 1
                      }}>
                        <input
                          type="checkbox"
                          checked={isHRSharingWithEmployee ? false : shareForm.write}
                          onChange={(e) => setShareForm({ ...shareForm, write: e.target.checked })}
                          disabled={isHRSharingWithEmployee}
                        />
                        ✏️ Écriture {isHRSharingWithEmployee && '(non disponible)'}
                      </label>
                      <label className="flex items-center gap-2" style={{ 
                        color: isHRSharingWithEmployee ? 'var(--md-sys-color-outline)' : 'var(--md-sys-color-on-surface)',
                        opacity: isHRSharingWithEmployee ? 0.5 : 1
                      }}>
                        <input
                          type="checkbox"
                          checked={isHRSharingWithEmployee ? false : shareForm.delete}
                          onChange={(e) => setShareForm({ ...shareForm, delete: e.target.checked })}
                          disabled={isHRSharingWithEmployee}
                        />
                        🗑️ Suppression {isHRSharingWithEmployee && '(non disponible)'}
                      </label>
                      <label className="flex items-center gap-2" style={{ 
                        color: isHRSharingWithEmployee ? 'var(--md-sys-color-outline)' : 'var(--md-sys-color-error)',
                        opacity: isHRSharingWithEmployee ? 0.5 : 1
                      }}>
                        <input
                          type="checkbox"
                          checked={isHRSharingWithEmployee ? false : shareForm.share}
                          onChange={(e) => setShareForm({ ...shareForm, share: e.target.checked })}
                          disabled={isHRSharingWithEmployee}
                        />
                        🔗 Partage {isHRSharingWithEmployee ? '(non disponible)' : '(⚠️ Permet de re-partager!)'}
                      </label>
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                >
                  Partager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Document Modal */}
      {showCopyModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-6 rounded-2xl max-w-lg w-full mx-4" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Copier "{selectedDocument.title}"
            </h3>
            <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
              <p className="font-bold">⚠️ DAC CRITICAL WEAKNESS</p>
              <p className="text-sm mt-1">
                En copiant ce document, vous devenez propriétaire de la copie avec TOUS les droits.
                Les restrictions originales sont PERDUES!
              </p>
              {selectedDocument.is_confidential && (
                <p className="text-sm mt-2 font-bold">
                  🔒 Ce document est CONFIDENTIEL mais la copie NE le sera PAS!
                </p>
              )}
            </div>
            <form onSubmit={handleCopyDocument}>
              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Titre de la copie
                </label>
                <input
                  type="text"
                  value={copyTitle}
                  onChange={(e) => setCopyTitle(e.target.value)}
                  className="w-full p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface)' }}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-on-error)' }}
                >
                  Copier (ignorer les restrictions)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {showEditModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-6 rounded-2xl max-w-lg w-full mx-4" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Modifier "{selectedDocument.title}"
            </h3>
            <form onSubmit={handleEditDocument}>
              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Titre
                </label>
                <input
                  type="text"
                  value={editDoc.title}
                  onChange={(e) => setEditDoc({ ...editDoc, title: e.target.value })}
                  className="w-full p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface)' }}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Contenu
                </label>
                <textarea
                  value={editDoc.content}
                  onChange={(e) => setEditDoc({ ...editDoc, content: e.target.value })}
                  className="w-full p-3 rounded-xl h-32"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface)' }}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DACModule;
