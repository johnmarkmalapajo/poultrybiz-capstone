import React, { useState, useEffect } from 'react';
import './SettingsProfile.css';

export default function SettingsProfile({ onBack }) {
  // Dynamic system dataset structure mirroring your strict core template fields
  const [userProfile, setUserProfile] = useState({
    fullName: "",
    emailAddress: "",
    phoneNumber: "",
    role: "",
    address: "",
    dateJoined: "",
    lastLogin: "",
    status: "Active",
    emailNotifications: true,
    loginAlerts: true
  });

  useEffect(() => {
    // Kinukuha ang aktibong operational session profile data
    const activeUser = JSON.parse(localStorage.getItem("user")) || {
      fullName: "", 
      emailAddress: "",
      phoneNumber: "",
      role: "Staff / Owner",
      address: "",
      dateJoined: "2026-01-15",
      lastLogin: "2026-06-13 09:42 AM", // Kasalukuyang active state timestamp marker
      status: "Active",
      emailNotifications: true,
      loginAlerts: true
    };
    setUserProfile(activeUser);
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserProfile(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  return (
    <div className="profile-workspace-view">
      <div className="profile-layout-container">
        
        {/* ================= LEFT COLUMN: AVATAR CARD RESUME PANEL ================= */}
        <div className="profile-avatar-card">
          <div className="avatar-frame-bubble">
            <span className="avatar-emoji-placeholder">🧑‍🌾</span>
            <button className="avatar-change-camera-btn" title="Change Avatar">📷</button>
          </div>
          
          <h2 className="profile-display-name">{userProfile.fullName || "Daisy..."}</h2>
          <span className="profile-display-role">{userProfile.role}</span>
          
          {/* Dynamic Status Pill Badge Indicator */}
          <div className={`profile-badge-status-wrap ${userProfile.status?.toLowerCase() === 'active' ? 'active-pill' : 'inactive-pill'}`}>
            <span className="status-dot-active"></span> {userProfile.status || "Active"}
          </div>

          {/* Complete System Meta-Data Info Stack from your UI Mockup guide */}
          <div className="profile-quick-meta-list">
            <div className="meta-item-row">📧 {userProfile.emailAddress || "no-email@farm.com"}</div>
            <div className="meta-item-row">📞 {userProfile.phoneNumber || "No Contact Added"}</div>
            <div className="meta-item-row">🛡️ <strong>Role:</strong> {userProfile.role}</div>
            <div className="meta-item-row">📅 <strong>Joined:</strong> {userProfile.dateJoined}</div>
            <div className="meta-item-row">⏱️ <strong>Last Login:</strong> {userProfile.lastLogin}</div>
          </div>

          <button className="profile-change-pw-action-btn">🔒 Change Password</button>
        </div>

        {/* ================= RIGHT COLUMN: DATA FORM FIELDS CONTAINER ================= */}
        <div className="profile-form-data-card">
          
          {/* Seksyon 1: Personal Information Block */}
          <div className="form-data-group-section">
            <h3 className="section-form-title">👤 Personal Information</h3>
            
            <div className="form-inputs-dual-grid">
              <div className="input-field-block">
                <label>Full Name <span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  name="fullName" 
                  placeholder="Enter full name"
                  value={userProfile.fullName} 
                  onChange={handleInputChange} 
                />
              </div>
              <div className="input-field-block">
                <label>Email Address <span className="required-mark">*</span></label>
                <input 
                  type="email" 
                  name="emailAddress" 
                  placeholder="name@poultrybriz.com"
                  value={userProfile.emailAddress} 
                  onChange={handleInputChange} 
                />
              </div>
            </div>

            <div className="form-inputs-dual-grid">
              <div className="input-field-block">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  name="phoneNumber" 
                  placeholder="+63 9xx xxx xxxx"
                  value={userProfile.phoneNumber} 
                  onChange={handleInputChange} 
                />
              </div>
              <div className="input-field-block">
                <label>Role</label>
                <input 
                  type="text" 
                  name="role" 
                  value={userProfile.role} 
                  disabled 
                  className="disabled-input-view"
                />
              </div>
            </div>

            <div className="input-field-block-full">
              <label>Address</label>
              <input 
                type="text" 
                name="address" 
                placeholder="Street, Barangay, Municipality, Province"
                value={userProfile.address} 
                onChange={handleInputChange} 
              />
            </div>
          </div>

          {/* Seksyon 2: Security & Status Log Control (Date Joined, Last Login, Status) */}
          <div className="form-data-group-section" style={{ marginTop: '24px' }}>
            <h3 className="section-form-title">🛡️ Security & Account Status</h3>
            <div className="form-inputs-dual-grid">
              <div className="input-field-block">
                <label>Date Joined</label>
                <input type="text" value={userProfile.dateJoined} disabled className="disabled-input-view" />
              </div>
              <div className="input-field-block">
                <label>Last System Login Session</label>
                <input type="text" value={userProfile.lastLogin} disabled className="disabled-input-view" />
              </div>
            </div>
            <div className="form-inputs-dual-grid">
              <div className="input-field-block">
                <label>Account Status Selector</label>
                <select name="status" value={userProfile.status} onChange={handleInputChange}>
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Seksyon 3: Alerts & Notification Toggles (Email Notifications, Login Alerts) */}
          <div className="form-data-group-section" style={{ marginTop: '24px' }}>
            <h3 className="section-form-title">🔔 Notification & Security Alerts</h3>
            <div className="checkbox-toggle-wrapper-row">
              <label className="switch-control-node">
                <input 
                  type="checkbox" 
                  name="emailNotifications" 
                  checked={userProfile.emailNotifications} 
                  onChange={handleInputChange} 
                />
                <span className="slider-round-bubble"></span>
              </label>
              <div className="toggle-label-desc-block">
                <strong>Email Notifications</strong>
                <p>Receive daily transaction receipts, system digests and regular operational updates.</p>
              </div>
            </div>

            <div className="checkbox-toggle-wrapper-row" style={{ marginTop: '16px' }}>
              <label className="switch-control-node">
                <input 
                  type="checkbox" 
                  name="loginAlerts" 
                  checked={userProfile.loginAlerts} 
                  onChange={handleInputChange} 
                />
                <span className="slider-round-bubble"></span>
              </label>
              <div className="toggle-label-desc-block">
                <strong>Login Security Alerts</strong>
                <p>Get instant systemic warnings anytime your account parameters are accessed from a new device.</p>
              </div>
            </div>
          </div>

          {/* Action buttons footer drawer spacing */}
          <div className="profile-form-footer-actions">
            <button className="btn-cancel-form" type="button" onClick={onBack}>Cancel</button>
            <button className="btn-save-form-changes" type="submit">💾 Save Changes</button>
          </div>

        </div>

      </div>
    </div>
  );
}