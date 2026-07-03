import React, { useState } from 'react';
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar"; 
import SettingsProfile from "./SettingsProfile";
import SettingsLogs from "./SettingsLogs";
import SettingsArchive from "./SettingsArchive";
// 1. I-IMPORT ANG BAGONG COMPONENT (Siguraduhing naka-create na itong file na ito sa directory mo)
import SettingsUsersRoles from "./SettingsUsersRoles"; 
import './Settings.css';   

const Settings = () => {
  const [viewMode, setViewMode] = useState('menu'); 
  const [searchQuery, setSearchQuery] = useState('');

  // 2. PINALAWAK NA MODULES ARRAY KASAMA ANG USERS & ROLES CARD
  const modules = [
    { id: 'profile', emoji: '👤', label: 'My Profile', description: 'Track personal account parameters, data scopes and roles', color: '#e8a020', bg: '#fff8ec' },
    { id: 'users-roles', emoji: '👥', label: 'Users & Roles', description: 'Manage employee system access levels, account provisioning and team permissions', color: '#a855f7', bg: '#f3e8ff' }, // Magandang Kulay: Purple Palette
    { id: 'audit-logs', emoji: '📋', label: 'Audit Logs', description: 'Monitor transaction histories, user modifications, and operational logs', color: '#5aab6e', bg: '#edf7f0' },
    { id: 'archive', emoji: '🗂️', label: 'Archive', description: 'View hidden structural parameters, records storage and recovery files', color: '#4a90d9', bg: '#eef4fc' }
  ];

  const filteredModules = modules.filter(m => 
    m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper function para sa Breadcrumbs Title allocation
  const getBreadcrumbTitle = () => {
    switch(viewMode) {
      case 'profile': return 'MY PROFILE';
      case 'users-roles': return 'USERS & ROLES';
      case 'audit-logs': return 'AUDIT LOGS';
      case 'archive': return 'ARCHIVE';
      default: return 'SUB-MODULE';
    }
  };

  return (
    <div className="inv-page">
      <Sidebar />
      
      <div className="settings-main">
        {/* ================= TOPBAR CONTROL ================= */}
        {viewMode === 'menu' && (
          <Topbar
            searchValue={searchQuery}
            onSearchChange={(e) => setSearchQuery(e.target.value)}
            searchPlaceholder="Search..."
          />
        )}

        {/* ================= FIXED BREADCRUMBS BAR (Lalabas lang kapag pumasok sa sub-module) ================= */}
        {viewMode !== 'menu' && (
          <div className="settings-top-action-bar" style={{ marginTop: '24px' }}>
            <div className="settings-breadcrumb-header">
              <span className="breadcrumb-root">SYSTEM</span>
              <span className="breadcrumb-arrow">❯</span>
              <span className="breadcrumb-current">
                {/* 3. GINAMITAN NATIN NG CLEANER LOGIC PARA SA MULTIPLE SUB-PAGES */}
                {getBreadcrumbTitle()}
              </span>
            </div>
          </div>
        )}

        {/* ================= CONDITION 1: MENU CARD GRID (Default Settings Menu View) ================= */}
        {viewMode === 'menu' && (
          <div style={{ marginTop: '40px' }}> 
            <h2 className="inv-title">SETTINGS</h2>
            <div className="settings-grid">
              {filteredModules.map((card, i) => (
                <button
                  key={card.id}
                  className="settings-card-node"
                  style={{ "--card-color": card.color, "--card-bg": card.bg, animationDelay: `${i * 80}ms` }}
                  onClick={() => setViewMode(card.id)}
                >
                  <div className="settings-icon-wrap"><span className="settings-emoji">{card.emoji}</span></div>
                  <div className="settings-body-wrap">
                    <span className="settings-label-text">{card.label}</span>
                    <span className="settings-desc-text">{card.description}</span>
                  </div>
                  <span className="settings-arrow-icon">›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= CONDITION 2: SUB-MODULE LAYOUT CONTENT IF ACTIVE ================= */}
        {viewMode !== 'menu' && (
          <div className="settings-content-body-injector" style={{ marginTop: '24px' }}>
            {viewMode === 'profile' && <SettingsProfile onBack={() => setViewMode('menu')} />}
            
            {/* 4. INJECT ANG BAGONG COMPONENT PARA SA USERS & ROLES MANIPULATION */}
            {viewMode === 'users-roles' && <SettingsUsersRoles onBack={() => setViewMode('menu')} />}
            
            {viewMode === 'audit-logs' && <SettingsLogs onBack={() => setViewMode('menu')} />}
            {viewMode === 'archive' && <SettingsArchive onBack={() => setViewMode('menu')} />}
          </div>
        )}

      </div>
    </div>
  );
};

export default Settings;