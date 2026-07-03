import React, { useState, useEffect } from 'react';
import './AddUser.css';

export default function AddUser({ onCancel, onSave, editingUser }) {
  const [formState, setFormState] = useState({ 
    fullName: '', 
    emailAddress: '', 
    role: 'Staff', 
    status: 'Active' 
  });

  // Kung may pinili para i-edit, i-load ang data niya sa form
  useEffect(() => {
    if (editingUser) {
      setFormState({
        fullName: editingUser.fullName,
        emailAddress: editingUser.emailAddress,
        role: editingUser.role,
        status: editingUser.status
      });
    }
  }, [editingUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formState); // Ipasa ang data pabalik sa main file
  };

  return (
    <div className="roles-workspace-view" style={{ animation: 'fadeInRoles 0.3s ease-out' }}>
      <div className="roles-layout-container">
        
        {/* Banner Card katulad ng sa image_57afe5.png */}
        <div className="form-header-banner-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f0f0f0', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 6px 0', color: '#a855f7', fontSize: '1.4rem', fontWeight: '700' }}>
            {editingUser ? "⚙️ Modify User Access Privileges" : "👤 Provision New User"}
          </h3>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
            {editingUser ? "Update database authorization levels and parameters for this employee profile." : "Fill in the parameters below to deploy a new system registration credentials container."}
          </p>
        </div>

        {/* Exclusive Form Panel Area */}
        <div className="exclusive-form-surface-panel" style={{ background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid #eef2f6', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
          <form onSubmit={handleSubmit}>
            
            <div className="form-fields-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: '600', color: '#4b5563' }}>Full Name *</label>
                <input type="text" name="fullName" placeholder="e.g., Jane Doe" value={formState.fullName} onChange={handleInputChange} required style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: '600', color: '#4b5563' }}>Email Address *</label>
                <input type="email" name="emailAddress" placeholder="username@poultrybiz.com" value={formState.emailAddress} onChange={handleInputChange} required style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: '600', color: '#4b5563' }}>Role Assignment</label>
                <select name="role" value={formState.role} onChange={handleInputChange} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                  <option value="Administrator">Administrator</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: '600', color: '#4b5563' }}>Account Status</label>
                <select name="status" value={formState.status} onChange={handleInputChange} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Triggers */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '20px' }}>
              <button type="button" onClick={onCancel} className="form-cancel-utility-btn" style={{ padding: '12px 24px', background: '#f3f4f6', border: 'none', borderRadius: '8px', color: '#4b5563', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem' }}>Cancel</button>
              <button type="submit" className="form-submit-utility-btn" style={{ padding: '12px 28px', background: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 2px 8px rgba(168,85,247,0.2)' }}>Save User</button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}