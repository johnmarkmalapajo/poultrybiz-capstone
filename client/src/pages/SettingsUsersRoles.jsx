import React, { useState } from 'react';
import AddUser from './AddUser'; // In-import natin ang bagong file mo!
import './SettingsUsersRoles.css'; 

export default function SettingsUsersRoles({ onBack }) {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const handleSaveUser = (formData) => {
    if (editingUser) {
      // Edit logic
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...formData } : u));
      setEditingUser(null);
    } else {
      // Add logic
      const newUserNode = { id: Date.now(), ...formData };
      setUsers(prev => [...prev, newUserNode]);
      setIsAdding(false);
    }
  };

  const handleDeleteUser = (id) => {
    if (window.confirm("Are you sure you want to completely revoke system access privileges for this employee account?")) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.emailAddress.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = roleFilter === 'All' || user.role === roleFilter;
    return matchesSearch && matchesFilter;
  });

  // ================= DYNAMIC ROUTE ISOLATION ENGINE =================
  // Kapag engaged ang Form, i-render ang hiwalay na file at itago ang table view!
  if (isAdding || editingUser) {
    return (
      <AddUser 
        editingUser={editingUser}
        onCancel={() => { setIsAdding(false); setEditingUser(null); }}
        onSave={handleSaveUser}
      />
    );
  }

  // ================= DEFAULT MANIFEST REGISTER STATE =================
  return (
    <div className="roles-workspace-view">
      <div className="roles-layout-container">
        
        {/* Action Controls Cluster */}
        <div className="module-action-block-wrapper">
          
          {/* Ginawang flex-start para malinis tingnan ang single button layout */}
          <div className="action-row-top" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
            <button 
              className="add-record-trigger-btn" 
              onClick={() => setIsAdding(true)}
              style={{ background: '#e8a020', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(232,160,32,0.08)' }}
            >
              <span>+</span> Add User
            </button>
          </div>

          <div className="action-row-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            
            <div className="search-input-box-wrapper">
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', width: '280px', outline: 'none', background: '#fff' }}
              />
            </div>
            
            <div className="utility-cluster-right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className="filter-dropdown-selector"
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#555', cursor: 'pointer', outline: 'none', minWidth: '110px' }}
              >
                <option value="All">Filter</option>
                <option value="Administrator">Administrator</option>
                <option value="Staff">Staff</option>
              </select>

              <button 
                type="button"
                onClick={() => alert("Exporting User Registry manifest...")} 
                className="export-action-trigger-btn"
                style={{ padding: '12px 20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#555', cursor: 'pointer', fontWeight: '500' }}
              >
                Export
              </button>
            </div>

          </div>
        </div>

        {/* Data Presentation Table Card Grid */}
        <div className="poultrybiz-table-card-container">
          <table className="poultrybiz-structured-table">
            <thead>
              <tr style={{ background: '#fff8ec', borderBottom: '1px solid #f0e6d5' }}>
                <th style={{ padding: '16px 20px', color: '#8d6e63', fontWeight: '600', fontSize: '0.88rem' }}>NAME</th>
                <th style={{ padding: '16px 20px', color: '#8d6e63', fontWeight: '600', fontSize: '0.88rem' }}>EMAIL</th>
                <th style={{ padding: '16px 20px', color: '#8d6e63', fontWeight: '600', fontSize: '0.88rem' }}>ROLE</th>
                <th style={{ padding: '16px 20px', color: '#8d6e63', fontWeight: '600', fontSize: '0.88rem' }}>STATUS</th>
                <th style={{ padding: '16px 20px', color: '#8d6e63', fontWeight: '600', fontSize: '0.88rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="table-data-row" style={{ borderBottom: '1px solid #f9f9f9', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 20px', fontWeight: '500', color: '#333', fontSize: '0.9rem' }}>{user.fullName}</td>
                    <td style={{ padding: '16px 20px', color: '#666', fontSize: '0.9rem' }}>{user.emailAddress}</td>
                    <td style={{ padding: '16px 20px', fontSize: '0.85rem' }}>
                      <span style={{ background: user.role === 'Administrator' ? '#fff4e5' : '#f3e8ff', color: user.role === 'Administrator' ? '#e8a020' : '#a855f7', padding: '4px 10px', borderRadius: '6px', fontWeight: '600' }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.85rem' }}>
                      <span style={{ background: user.status === 'Active' ? '#edf7f0' : '#fef2f2', color: user.status === 'Active' ? '#5aab6e' : '#ef4444', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.status === 'Active' ? '#5aab6e' : '#ef4444' }}></span>
                        {user.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button"
                          onClick={() => setEditingUser(user)} 
                          className="action-edit-inline-btn"
                          style={{ padding: '6px 12px', background: '#f3e8ff', color: '#a855f7', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteUser(user.id)} 
                          className="action-delete-inline-btn"
                          style={{ padding: '6px 12px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: '#999', fontSize: '0.95rem' }}>
                    <div style={{ marginBottom: '8px', fontSize: '1.5rem' }}>🌾</div>
                    No records found. The dashboard is fresh and back to zero!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}