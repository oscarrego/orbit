import React, { useState } from 'react';

const ProfileModal = ({
  user,
  onClose,
  onChangeAvatar,
  onUpdateUsername,
  onLogout,
  isInvisible,
  onToggleInvisible,
  notificationsEnabled = false,
  notificationStatus = "idle",
  notificationPermission = "default",
  notificationsSupported = true,
  onToggleNotifications,
  themeMode = "dark",
  onThemeModeChange,
  buildingsEnabled = true,
  onBuildingsEnabledChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(user.username);
  const roomId = localStorage.getItem("roomId") || "Global";

  const handleSave = () => {
    const normalizedName = tempName.trim().toUpperCase();
    if (/^[A-Z]{5}$/.test(normalizedName) && normalizedName !== user.username) {
      onUpdateUsername(normalizedName);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setTempName(user.username);
      setIsEditing(false);
    }
  };

  const isLightMode = themeMode === "light";
  const handleThemeToggle = () => {
    onThemeModeChange?.(isLightMode ? "dark" : "light");
  };

  const notificationDescription = (() => {
    if (!notificationsSupported) return "Not supported on this browser";
    if (notificationPermission === "denied") return "Blocked in browser settings";
    if (notificationStatus === "requesting-permission") return "Requesting permission";
    if (notificationStatus === "prepared-placeholder") return "Ready for Firebase config";
    if (notificationsEnabled) return "Alert on nearby activity";
    return "Disabled locally";
  })();

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal pm-glass" onClick={(e) => e.stopPropagation()}>

        {/* ── Top bar: logout left, close right ── */}
        <div className="pm-topbar">
          <button className="pm-logout-btn" onClick={onLogout} title="Logout">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3V12" stroke="#f87171"/>
              <path d="M7 5.5A8 8 0 1 0 17 5.5" stroke="#f87171"/>
            </svg>
          </button>
          <button className="pm-close-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor"/>
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor"/>
            </svg>
          </button>
        </div>

        {/* ── Avatar ── */}
        <div
          className="pm-avatar"
          onClick={onChangeAvatar}
          title="Click to change avatar"
          role="button"
          tabIndex={0}
        >
          <img
            src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(user.avatarSeed)}`}
            alt="Avatar"
          />
          <div className="pm-avatar-hint">CHANGE</div>
        </div>

        {/* ── Username ── */}
        <div className="pm-name-row">
          {isEditing ? (
            <input
              type="text"
              className="pm-name-input"
              value={tempName}
              onChange={(e) => setTempName(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              maxLength={5}
              autoFocus
            />
          ) : (
            <div className="pm-name-display">
              <span className="pm-username">{user.username}</span>
              <button className="pm-edit-btn" onClick={() => setIsEditing(true)} title="Edit name">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Status indicator ── */}
        <div className={`pm-status ${isInvisible ? "pm-status--invisible" : "pm-status--active"}`}>
          <span className="pm-status-dot"/>
          <span className="pm-status-text">
            {isInvisible ? "OFFLINE · INVISIBLE" : "ACTIVE · VISIBLE"}
          </span>
        </div>

        {/* ── Divider ── */}
        <div className="pm-divider"/>

        {/* ── Current Room ── */}
        <div className="pm-section">
          <label className="pm-section-label">CURRENT ROOM</label>
          <div className="pm-room-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{width:14,height:14,opacity:0.5}}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a14.5 14.5 0 0 1 0 20 14.5 14.5 0 0 1 0-20"/>
              <path d="M2 12h20"/>
            </svg>
            <span className="pm-room-name">#{roomId}</span>
          </div>
        </div>

        {/* ── Invisible Mode toggle ── */}
        <div className="pm-toggle-row">
          <div className="pm-toggle-info">
            <span className="pm-toggle-label">Invisible Mode</span>
            <span className="pm-toggle-desc">Hide from other users</span>
          </div>
          <button
            type="button"
            className={`pm-toggle-switch ${isInvisible ? "pm-toggle-switch--on" : ""}`}
            onClick={() => onToggleInvisible(!isInvisible)}
            aria-pressed={isInvisible}
          >
            <span className="pm-toggle-thumb"/>
          </button>
        </div>

         {/* ── Notifications toggle ── */}
        <div className="pm-toggle-row">
          <div className="pm-toggle-info">
            <span className="pm-toggle-label">Notifications</span>
            <span className="pm-toggle-desc">{notificationDescription}</span>
          </div>
          <button
            type="button"
            className={`pm-toggle-switch ${notificationsEnabled ? "pm-toggle-switch--on" : ""}`}
            onClick={() => onToggleNotifications?.(!notificationsEnabled)}
            aria-pressed={notificationsEnabled}
            aria-label={`${notificationsEnabled ? "Disable" : "Enable"} notifications`}
          >
            <span className="pm-toggle-thumb"/>
          </button>
        </div>

        {/* ── Interface Theme toggle ── */}
        <div className="pm-theme-row">
          <div className="pm-toggle-info">
            <span className="pm-toggle-label">Interface Theme</span>
            <span className="pm-toggle-desc">{isLightMode ? "Light Mode" : "Dark Mode"}</span>
          </div>
          <button
            type="button"
            className={`profile-theme-switch ${isLightMode ? "light" : "dark"}`}
            onClick={handleThemeToggle}
            aria-pressed={isLightMode}
            aria-label={`Switch to ${isLightMode ? "dark" : "light"} mode`}
          >
            <span className="profile-theme-icon profile-theme-icon-dark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8z" />
              </svg>
            </span>
            <span className="profile-theme-thumb" />
            <span className="profile-theme-icon profile-theme-icon-light">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
              </svg>
            </span>
          </button>
        </div>

        <div className="pm-view-row">
          <div className="pm-toggle-info">
            <span className="pm-toggle-label">Building Depth</span>
            <span className="pm-toggle-desc">Extrusion rendering only</span>
          </div>
          <div className="pm-segmented-toggle" role="group" aria-label="Building rendering mode">
            <button
              type="button"
              className={!buildingsEnabled ? "selected" : ""}
              onClick={() => onBuildingsEnabledChange?.(false)}
              aria-pressed={!buildingsEnabled}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m3.5 7 6.5-3 6.5 3-6.5 3zM3.5 10l6.5 3 6.5-3M3.5 13l6.5 3 6.5-3" />
              </svg>
              2D
            </button>
            <button
              type="button"
              className={buildingsEnabled ? "selected" : ""}
              onClick={() => onBuildingsEnabledChange?.(true)}
              aria-pressed={buildingsEnabled}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m10 3 6 3.2v7.2L10 17l-6-3.6V6.2zM4 6.2l6 3.5 6-3.5M10 9.7V17" />
              </svg>
              3D
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
