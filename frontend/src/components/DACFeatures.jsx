import { useState, useEffect } from 'react';
import {
  createDocument, getMyDocuments, getDocument, updateDocument, shareDocumentDAC, shareDocumentSecure,
  getACLMatrix, revokeDocumentAccess,
  createDelegationDAC, createDelegationSecure, getMyDelegations,
  getDelegationGraph, revokeDelegation, listUsers
} from '../api';

export default function DACFeatures({ user }) {
  const [activeTab, setActiveTab] = useState('documents');
  const [activeMode, setActiveMode] = useState('comparison'); // 'dac', 'secure', 'comparison'
  
  // Documents state
  const [documents, setDocuments] = useState({ owned_documents: [], shared_documents: [] });
  const [newDoc, setNewDoc] = useState({ title: '', content: '', is_confidential: false });
  const [shareData, setShareData] = useState({ document_id: '', target_user_id: '', permissions: ['read'] });
  const [aclMatrix, setAclMatrix] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null); // Pour consulter un document
  const [editingDocument, setEditingDocument] = useState(null); // Pour modifier un document
  const [editForm, setEditForm] = useState({ title: '', content: '', is_confidential: false });
  
  // Delegations state
  const [delegations, setDelegations] = useState({ delegations_given: [], delegations_received: [] });
  const [delegationGraph, setDelegationGraph] = useState(null);
  const [newDelegation, setNewDelegation] = useState({ 
    delegate_to_user_id: '', 
    rights: ['view_requests'],
    max_depth: 1,
    expires_in_hours: 24
  });
  
  // Common state
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  
  // Check if user can delegate (HR/Admin OR has received a delegation with 'delegate' right or can_redelegate)
  const canDelegate = user.role === 'hr_manager' || user.role === 'admin' || 
    delegations.delegations_received.some(d => d.can_redelegate || d.rights.includes('delegate'));
  
  // Get the delegated rights the user has (for re-delegation)
  const myDelegatedRights = delegations.delegations_received.reduce((acc, d) => {
    d.rights.forEach(r => acc.add(r));
    return acc;
  }, new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [docsRes, delegRes, usersRes] = await Promise.all([
        getMyDocuments(),
        getMyDelegations(),
        listUsers()
      ]);
      setDocuments(docsRes.data);
      setDelegations(delegRes.data);
      setUsers(usersRes.data);
      
      if (user.role === 'admin') {
        const [matrixRes, graphRes] = await Promise.all([
          getACLMatrix(),
          getDelegationGraph()
        ]);
        setAclMatrix(matrixRes.data);
        setDelegationGraph(graphRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // =============== DOCUMENT FUNCTIONS ===============
  const handleCreateDocument = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createDocument(newDoc.title, newDoc.content, newDoc.is_confidential);
      showMessage(`✅ ${res.data.message}`, 'success');
      setNewDoc({ title: '', content: '', is_confidential: false });
      loadData();
    } catch (error) {
      showMessage(`❌ ${error.response?.data?.detail || 'Erreur'}`, 'error');
    }
    setLoading(false);
  };

  const handleShareDocument = async (mode) => {
    setLoading(true);
    try {
      let res;
      if (mode === 'dac') {
        // En mode DAC, on ajoute 'share' aux permissions pour permettre le re-partage
        const permsWithShare = [...shareData.permissions];
        if (!permsWithShare.includes('share')) permsWithShare.push('share');
        res = await shareDocumentDAC(
          parseInt(shareData.document_id),
          parseInt(shareData.target_user_id),
          permsWithShare
        );
      } else {
        res = await shareDocumentSecure(
          parseInt(shareData.document_id),
          parseInt(shareData.target_user_id),
          shareData.permissions,
          false // can_reshare = false
        );
      }
      showMessage(`${res.data.message}\n${res.data.warning || res.data.solution || ''}`, 
        mode === 'dac' ? 'warning' : 'success');
      loadData();
    } catch (error) {
      showMessage(`❌ ${error.response?.data?.detail || 'Erreur'}`, 'error');
    }
    setLoading(false);
  };

  // =============== DELEGATION FUNCTIONS ===============
  const handleCreateDelegation = async (mode) => {
    setLoading(true);
    try {
      let res;
      if (mode === 'dac') {
        const rightsWithDelegate = [...newDelegation.rights];
        if (!rightsWithDelegate.includes('delegate')) rightsWithDelegate.push('delegate');
        res = await createDelegationDAC(
          parseInt(newDelegation.delegate_to_user_id),
          rightsWithDelegate
        );
      } else {
        res = await createDelegationSecure(
          parseInt(newDelegation.delegate_to_user_id),
          newDelegation.rights,
          newDelegation.max_depth,
          newDelegation.expires_in_hours
        );
      }
      showMessage(`${res.data.message}`, mode === 'dac' ? 'warning' : 'success');
      loadData();
    } catch (error) {
      showMessage(`❌ ${error.response?.data?.detail || 'Erreur'}`, 'error');
    }
    setLoading(false);
  };

  const handleRevokeDelegation = async (id) => {
    try {
      await revokeDelegation(id);
      showMessage('✅ Délégation révoquée', 'success');
      loadData();
    } catch (error) {
      showMessage(`❌ ${error.response?.data?.detail || 'Erreur'}`, 'error');
    }
  };

  // =============== VIEW DOCUMENT FUNCTION ===============
  const handleViewDocument = async (doc) => {
    setViewingDocument(doc);
  };

  // =============== EDIT DOCUMENT FUNCTIONS ===============
  const handleOpenEdit = (doc) => {
    setEditingDocument(doc);
    setEditForm({
      title: doc.title,
      content: doc.content,
      is_confidential: doc.is_confidential
    });
  };

  const handleSaveDocument = async () => {
    if (!editingDocument) return;
    setLoading(true);
    try {
      const res = await updateDocument(
        editingDocument.id,
        editForm.title,
        editForm.content,
        editForm.is_confidential
      );
      showMessage(`✅ ${res.data.message}`, 'success');
      setEditingDocument(null);
      loadData();
    } catch (error) {
      showMessage(`❌ ${error.response?.data?.detail || 'Erreur lors de la modification'}`, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* View Document Modal */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">👁️ Consultation: {viewingDocument.title}</h3>
                  {viewingDocument.is_confidential && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">🔒 Confidentiel</span>
                  )}
                </div>
                <button 
                  onClick={() => setViewingDocument(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4 min-h-[150px]">
                <p className="whitespace-pre-wrap">{viewingDocument.content}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-blue-50 rounded p-3">
                  <p className="font-medium text-blue-800">Propriétaire</p>
                  <p className="text-blue-600">{viewingDocument.owner_email}</p>
                </div>
                <div className={`rounded p-3 ${viewingDocument.is_owner ? 'bg-amber-50' : viewingDocument.is_dac_mode ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className="font-medium">Mes permissions</p>
                  <p className="text-sm">{viewingDocument.permissions?.join(', ')}</p>
                </div>
              </div>
              
              {!viewingDocument.is_owner && viewingDocument.granted_by && (
                <div className="mt-4 p-3 rounded text-sm" style={{
                  backgroundColor: viewingDocument.is_dac_mode ? '#fef2f2' : '#f0fdf4'
                }}>
                  <p className={viewingDocument.is_dac_mode ? 'text-red-700' : 'text-green-700'}>
                    <strong>{viewingDocument.is_dac_mode ? '🔴 Mode DAC' : '🟢 Mode Sécurisé'}</strong>
                    {' - '}Partagé par {viewingDocument.granted_by}
                  </p>
                </div>
              )}
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setViewingDocument(null)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {editingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">✏️ Modifier le document</h3>
                <button 
                  onClick={() => setEditingDocument(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contenu</label>
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({...editForm, content: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    rows={6}
                  />
                </div>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_confidential}
                    onChange={(e) => setEditForm({...editForm, is_confidential: e.target.checked})}
                    className="rounded text-amber-600"
                  />
                  <span>Document confidentiel</span>
                </label>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setEditingDocument(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveDocument}
                  disabled={loading}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {loading ? 'Enregistrement...' : '💾 Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-900 rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          🔐 Fonctionnalités DAC (Discretionary Access Control)
        </h2>
        <p className="mt-2 text-amber-100">
          Démonstration des modèles de contrôle d'accès discrétionnaires et leurs vulnérabilités
        </p>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
          message.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
          message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
          'bg-blue-100 text-blue-800 border border-blue-300'
        }`}>
          <pre className="whitespace-pre-wrap text-sm">{message.text}</pre>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-amber-200">
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 font-medium rounded-t-lg transition ${
            activeTab === 'documents' 
              ? 'bg-amber-100 text-amber-800 border-b-2 border-amber-600' 
              : 'text-gray-600 hover:bg-amber-50'
          }`}
        >
          📁 Documents (HRU Matrix)
        </button>
        <button
          onClick={() => setActiveTab('delegations')}
          className={`px-4 py-2 font-medium rounded-t-lg transition ${
            activeTab === 'delegations' 
              ? 'bg-amber-100 text-amber-800 border-b-2 border-amber-600' 
              : 'text-gray-600 hover:bg-amber-50'
          }`}
        >
          🔑 Délégations (Take-Grant)
        </button>
        {user.role === 'admin' && (
          <button
            onClick={() => setActiveTab('visualization')}
            className={`px-4 py-2 font-medium rounded-t-lg transition ${
              activeTab === 'visualization' 
                ? 'bg-amber-100 text-amber-800 border-b-2 border-amber-600' 
                : 'text-gray-600 hover:bg-amber-50'
            }`}
          >
            📊 Visualisation
          </button>
        )}
      </div>

      {/* =============== DOCUMENTS TAB =============== */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Theory Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-bold text-amber-800 mb-2">📚 Modèle HRU (Harrison-Ruzzo-Ullman)</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="font-bold text-red-700">🔴 Mode DAC (Vulnérable)</p>
                <ul className="mt-2 text-red-600 list-disc list-inside">
                  <li>Permission "share" = marque de copie (*)</li>
                  <li>Le destinataire peut RE-PARTAGER</li>
                  <li><strong>Faiblesse:</strong> Propagation non contrôlée</li>
                  <li>Problème de sûreté indécidable</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <p className="font-bold text-green-700">🟢 Mode Sécurisé</p>
                <ul className="mt-2 text-green-600 list-disc list-inside">
                  <li>Flag "transfer_only" (can_reshare=false)</li>
                  <li>Le destinataire NE PEUT PAS re-partager</li>
                  <li><strong>Solution:</strong> Contrôle de propagation</li>
                  <li>Sûreté garantie</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Create Document */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">➕ Créer un Document</h3>
            <form onSubmit={handleCreateDocument} className="space-y-4">
              <input
                type="text"
                placeholder="Titre du document"
                value={newDoc.title}
                onChange={(e) => setNewDoc({...newDoc, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                required
              />
              <textarea
                placeholder="Contenu du document"
                value={newDoc.content}
                onChange={(e) => setNewDoc({...newDoc, content: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                rows={3}
                required
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newDoc.is_confidential}
                  onChange={(e) => setNewDoc({...newDoc, is_confidential: e.target.checked})}
                  className="rounded text-amber-600"
                />
                <span>Document confidentiel</span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
              >
                Créer (je deviens propriétaire - OWN)
              </button>
            </form>
          </div>

          {/* Share Document - Comparison Mode */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">🔗 Partager un Document</h3>
            <div className="space-y-4">
              <select
                value={shareData.document_id}
                onChange={(e) => setShareData({...shareData, document_id: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">-- Sélectionner un document --</option>
                {documents.owned_documents.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} (Propriétaire)
                  </option>
                ))}
                {documents.shared_documents.filter(d => d.can_reshare).map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} (Partagé - peut re-partager)
                  </option>
                ))}
              </select>
              
              <select
                value={shareData.target_user_id}
                onChange={(e) => setShareData({...shareData, target_user_id: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">-- Sélectionner un utilisateur --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                ))}
              </select>

              <div className="flex gap-2 flex-wrap">
                {['read', 'write'].map(perm => (
                  <label key={perm} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={shareData.permissions.includes(perm)}
                      onChange={(e) => {
                        const perms = e.target.checked 
                          ? [...shareData.permissions, perm]
                          : shareData.permissions.filter(p => p !== perm);
                        setShareData({...shareData, permissions: perms});
                      }}
                      className="rounded text-amber-600"
                    />
                    <span className="capitalize">{perm}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleShareDocument('dac')}
                  disabled={loading || !shareData.document_id || !shareData.target_user_id}
                  className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  🔴 Partager (DAC - Vulnérable)<br/>
                  <span className="text-xs">Peut re-partager</span>
                </button>
                <button
                  onClick={() => handleShareDocument('secure')}
                  disabled={loading || !shareData.document_id || !shareData.target_user_id}
                  className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  🟢 Partager (Sécurisé)<br/>
                  <span className="text-xs">Ne peut pas re-partager</span>
                </button>
              </div>
            </div>
          </div>

          {/* My Documents */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📂 Mes Documents</h3>
            
            <h4 className="font-medium text-gray-700 mb-2">Documents que je possède (OWN):</h4>
            <div className="space-y-2 mb-4">
              {documents.owned_documents.map(doc => (
                <div key={doc.id} className="bg-amber-50 border border-amber-200 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="font-bold">{doc.title}</span>
                      {doc.is_confidential && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Confidentiel</span>}
                      <p className="text-sm text-gray-600 mt-1 truncate">{doc.content.substring(0, 80)}...</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Permissions: <code className="bg-gray-100 px-1">{doc.permissions.join(', ')}</code>
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {doc.permissions.includes('read') && (
                        <button
                          onClick={() => handleViewDocument(doc)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          title="Consulter le document"
                        >
                          👁️ Consulter
                        </button>
                      )}
                      {doc.permissions.includes('write') && (
                        <button
                          onClick={() => handleOpenEdit(doc)}
                          className="bg-amber-600 text-white px-3 py-1 rounded text-sm hover:bg-amber-700"
                          title="Modifier le document"
                        >
                          ✏️ Modifier
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {documents.owned_documents.length === 0 && (
                <p className="text-gray-500 italic">Aucun document</p>
              )}
            </div>

            <h4 className="font-medium text-gray-700 mb-2">Documents partagés avec moi:</h4>
            <div className="space-y-2">
              {documents.shared_documents.map(doc => (
                <div key={doc.id} className={`border rounded p-3 ${
                  doc.is_dac_mode ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="font-bold">{doc.title}</span>
                      <span className={`ml-2 text-xs px-2 py-1 rounded ${
                        doc.is_dac_mode ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {doc.is_dac_mode ? '🔴 DAC' : '🟢 Sécurisé'}
                      </span>
                      {doc.can_reshare && <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">⚠️ Peut re-partager</span>}
                      <p className="text-sm text-gray-600 mt-1 truncate">{doc.content.substring(0, 80)}...</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Partagé par: {doc.granted_by} | Permissions: <code className="bg-gray-100 px-1">{doc.permissions.join(', ')}</code>
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {doc.permissions.includes('read') && (
                        <button
                          onClick={() => handleViewDocument(doc)}
                          className={`text-white px-3 py-1 rounded text-sm ${
                            doc.is_dac_mode ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                          }`}
                          title="Consulter le document"
                        >
                          👁️ Consulter
                        </button>
                      )}
                      {doc.permissions.includes('write') && (
                        <button
                          onClick={() => handleOpenEdit(doc)}
                          className={`text-white px-3 py-1 rounded text-sm ${
                            doc.is_dac_mode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-teal-600 hover:bg-teal-700'
                          }`}
                          title="Modifier le document"
                        >
                          ✏️ Modifier
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {documents.shared_documents.length === 0 && (
                <p className="text-gray-500 italic">Aucun document partagé</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============== DELEGATIONS TAB =============== */}
      {activeTab === 'delegations' && (
        <div className="space-y-6">
          {/* Theory Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-bold text-amber-800 mb-2">📚 Modèle Take-Grant (Jones, Lipton, Snyder)</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="font-bold text-red-700">🔴 Mode DAC (Vulnérable)</p>
                <ul className="mt-2 text-red-600 list-disc list-inside">
                  <li>Droit "delegate" = arc 'g' (grant)</li>
                  <li>Le délégué peut RE-DÉLÉGUER sans limite</li>
                  <li><strong>Faiblesse:</strong> Chemin tg non contrôlé</li>
                  <li>Prédicat "can" toujours satisfaisable</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <p className="font-bold text-green-700">🟢 Mode Sécurisé</p>
                <ul className="mt-2 text-green-600 list-disc list-inside">
                  <li>Profondeur limitée (max_depth)</li>
                  <li>Expiration temporelle</li>
                  <li><strong>Solution:</strong> Casse le chemin tg</li>
                  <li>Prédicat "can" contrôlé</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Create Delegation (HR/Admin OR user with delegate right) */}
          {canDelegate && (
            <div className={`rounded-lg shadow p-6 ${
              user.role !== 'hr_manager' && user.role !== 'admin' 
                ? 'bg-amber-50 border-2 border-amber-300' 
                : 'bg-white'
            }`}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                ➕ Créer une Délégation
                {user.role !== 'hr_manager' && user.role !== 'admin' && (
                  <span className="ml-2 text-sm font-normal text-amber-600">(Re-délégation)</span>
                )}
              </h3>
              
              {/* Warning for delegated users */}
              {user.role !== 'hr_manager' && user.role !== 'admin' && (
                <div className="mb-4 p-3 bg-amber-100 border border-amber-300 rounded-lg text-sm text-amber-800">
                  ⚠️ Vous re-déléguez des droits qui vous ont été délégués. 
                  Vous ne pouvez déléguer que les droits que vous possédez : 
                  <strong className="ml-1">{Array.from(myDelegatedRights).join(', ')}</strong>
                </div>
              )}
              
              <div className="space-y-4">
                <select
                  value={newDelegation.delegate_to_user_id}
                  onChange={(e) => setNewDelegation({...newDelegation, delegate_to_user_id: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Déléguer à --</option>
                  {users.filter(u => u.id !== user.id).map(u => (
                    <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                  ))}
                </select>

                <div className="flex gap-4 flex-wrap">
                  {['approve_leave', 'view_requests', 'delegate'].map(right => {
                    // Pour les utilisateurs délégués, désactiver les droits qu'ils n'ont pas
                    const isHROrAdmin = user.role === 'hr_manager' || user.role === 'admin';
                    const hasRight = isHROrAdmin || myDelegatedRights.has(right);
                    
                    return (
                      <label key={right} className={`flex items-center gap-1 ${!hasRight ? 'opacity-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={newDelegation.rights.includes(right)}
                          disabled={!hasRight}
                          onChange={(e) => {
                            const rights = e.target.checked 
                              ? [...newDelegation.rights, right]
                              : newDelegation.rights.filter(r => r !== right);
                            setNewDelegation({...newDelegation, rights: rights});
                          }}
                          className="rounded text-amber-600"
                        />
                        <span>{right.replace(/_/g, ' ')}</span>
                        {!hasRight && <span className="text-xs text-gray-400">(non disponible)</span>}
                      </label>
                    );
                  })}
                </div>

                {/* Secure mode options */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-green-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-green-700">Profondeur max (0 = pas de re-délégation)</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={newDelegation.max_depth}
                      onChange={(e) => setNewDelegation({...newDelegation, max_depth: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-700">Expiration (heures)</label>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={newDelegation.expires_in_hours}
                      onChange={(e) => setNewDelegation({...newDelegation, expires_in_hours: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleCreateDelegation('dac')}
                    disabled={loading || !newDelegation.delegate_to_user_id}
                    className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    🔴 Déléguer (DAC - Vulnérable)<br/>
                    <span className="text-xs">Peut re-déléguer sans limite</span>
                  </button>
                  <button
                    onClick={() => handleCreateDelegation('secure')}
                    disabled={loading || !newDelegation.delegate_to_user_id}
                    className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    🟢 Déléguer (Sécurisé)<br/>
                    <span className="text-xs">Limité + Expire</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* My Delegations */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">🔑 Mes Délégations</h3>
            
            <h4 className="font-medium text-gray-700 mb-2">Délégations que j'ai données:</h4>
            <div className="space-y-2 mb-4">
              {delegations.delegations_given.map(d => (
                <div key={d.id} className={`border rounded p-3 ${
                  d.mode === 'DAC' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold">→ {d.delegate}</span>
                      <span className={`ml-2 text-xs px-2 py-1 rounded ${
                        d.mode === 'DAC' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {d.mode === 'DAC' ? '🔴 DAC (∞)' : '🟢 Sécurisé'}
                      </span>
                      <p className="text-sm text-gray-600">Droits: {d.rights.join(', ')}</p>
                      {d.expires_at && <p className="text-xs text-gray-500">Expire: {new Date(d.expires_at).toLocaleString()}</p>}
                    </div>
                    <button
                      onClick={() => handleRevokeDelegation(d.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Révoquer
                    </button>
                  </div>
                </div>
              ))}
              {delegations.delegations_given.length === 0 && (
                <p className="text-gray-500 italic">Aucune délégation donnée</p>
              )}
            </div>

            <h4 className="font-medium text-gray-700 mb-2">Délégations que j'ai reçues:</h4>
            <div className="space-y-2">
              {delegations.delegations_received.map(d => (
                <div key={d.id} className={`border rounded p-3 ${
                  d.mode === 'DAC' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div>
                    <span className="font-bold">← {d.delegator}</span>
                    <span className={`ml-2 text-xs px-2 py-1 rounded ${
                      d.mode === 'DAC' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                    }`}>
                      {d.mode === 'DAC' ? '🔴 DAC' : '🟢 Sécurisé'}
                    </span>
                    {d.can_redelegate && <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Peut re-déléguer</span>}
                    <p className="text-sm text-gray-600">Droits: {d.rights.join(', ')}</p>
                    {d.mode !== 'DAC' && (
                      <p className="text-xs text-gray-500">
                        Profondeur: {d.current_depth}/{d.max_depth} | Expire: {new Date(d.expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {delegations.delegations_received.length === 0 && (
                <p className="text-gray-500 italic">Aucune délégation reçue</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============== VISUALIZATION TAB (Admin only) =============== */}
      {activeTab === 'visualization' && user.role === 'admin' && (
        <div className="space-y-6">
          {/* ACL Matrix */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Matrice de Contrôle d'Accès (HRU)</h3>
            {aclMatrix && (
              <div className="overflow-x-auto">
                <p className="text-sm text-gray-600 mb-2">
                  Documents: {aclMatrix.total_documents} | ACLs: {aclMatrix.total_acls}
                </p>
                <div className="bg-amber-50 p-3 rounded mb-4 text-sm">
                  <strong>Légende:</strong> * = Marque de copie (peut transférer) | DAC = Vulnérable | SECURE = Sécurisé
                </div>
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2">Sujet (Utilisateur)</th>
                      <th className="border border-gray-300 px-4 py-2">Objet (Document)</th>
                      <th className="border border-gray-300 px-4 py-2">A[s,o] = Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(aclMatrix.matrix).map(([user, docs]) =>
                      Object.entries(docs).map(([doc, perms], idx) => (
                        <tr key={`${user}-${doc}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {idx === 0 && (
                            <td className="border border-gray-300 px-4 py-2 font-medium" rowSpan={Object.keys(docs).length}>
                              {user}
                            </td>
                          )}
                          <td className="border border-gray-300 px-4 py-2">{doc}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            {Array.isArray(perms) ? (
                              <code className="bg-blue-100 px-2 py-1 rounded">{perms.join(', ')}</code>
                            ) : (
                              <div>
                                <code className={`px-2 py-1 rounded ${
                                  perms.mode === 'DAC' ? 'bg-red-100' : 'bg-green-100'
                                }`}>
                                  {perms.permissions.join(', ')}
                                </code>
                                <span className={`ml-2 text-xs ${
                                  perms.mode === 'DAC' ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  [{perms.mode}]
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Delegation Graph */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📈 Graphe de Délégation (Take-Grant)</h3>
            {delegationGraph && (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{delegationGraph.vulnerability_analysis.dac_edges}</p>
                    <p className="text-sm text-red-700">Arcs DAC (Vulnérables)</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{delegationGraph.vulnerability_analysis.secure_edges}</p>
                    <p className="text-sm text-green-700">Arcs Sécurisés</p>
                  </div>
                </div>

                <h4 className="font-medium text-gray-700 mb-2">Nœuds (Utilisateurs):</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {delegationGraph.nodes.map(node => (
                    <span key={node} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                      {node}
                    </span>
                  ))}
                </div>

                <h4 className="font-medium text-gray-700 mb-2">Arcs (Délégations):</h4>
                <div className="space-y-2">
                  {delegationGraph.edges.map((edge, idx) => (
                    <div key={idx} className={`flex items-center gap-2 p-2 rounded ${
                      edge.mode === 'DAC' ? 'bg-red-50' : 'bg-green-50'
                    } ${!edge.is_active ? 'opacity-50' : ''}`}>
                      <span className="font-medium">{edge.from}</span>
                      <span className={`px-2 py-1 rounded text-sm ${
                        edge.mode === 'DAC' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                      }`}>
                        → {edge.label} →
                      </span>
                      <span className="font-medium">{edge.to}</span>
                      {!edge.is_active && <span className="text-xs text-gray-500">(révoqué)</span>}
                    </div>
                  ))}
                  {delegationGraph.edges.length === 0 && (
                    <p className="text-gray-500 italic">Aucune délégation</p>
                  )}
                </div>

                {delegationGraph.tg_paths.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 mb-2">⚠️ Chemins tg détectés (vulnérabilité Take-Grant):</h4>
                    <div className="space-y-1">
                      {delegationGraph.tg_paths.map((path, idx) => (
                        <p key={idx} className={`text-sm px-3 py-1 rounded ${
                          path.vulnerability ? 'bg-red-100 text-red-700' : 'bg-gray-100'
                        }`}>
                          {path.path} {path.vulnerability && '⚠️'}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
