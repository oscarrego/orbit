import React, { useState } from 'react';

const ProfileModal = ({ user, onClose, onChangeAvatar, onUpdateUsername, onLogout, isInvisible, onToggleInvisible }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(user.username);
  const roomId = localStorage.getItem("roomId") || "Global";

  const handleSave = () => {
    if (tempName.trim() && tempName.trim() !== user.username) {
      onUpdateUsername(tempName);
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

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        
        <button className="floating-logout-btn" onClick={onLogout} title="Logout">
          <svg className="power-logout" viewBox="0 0 24 24" fill="none">
            <path className="power-ring" d="M12 3V12" />
            <path className="power-ring" d="M7 5.5A8 8 0 1 0 17 5.5" />
          </svg>
        </button>

        <div 
          className="profile-avatar clickable" 
          onClick={onChangeAvatar}
          title="Click to change avatar"
        >
          <img 
            src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(user.avatarSeed)}`} 
            alt="My Avatar" 
            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
          />
        </div>

        <div className="profile-name-container">
          {isEditing ? (
            <input 
              type="text" 
              className="profile-name-input"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <h2 className="profile-name">
              {user.username}
              <button className="edit-name-btn" onClick={() => setIsEditing(true)} title="Edit name">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            </h2>
          )}
        </div>

        <div className="profile-section">
          <label className="profile-label">Current Room</label>
          <div className="profile-box">#{roomId}</div>
        </div>

        <div className="profile-toggle">
          <span>Invisible Mode</span>
          <input 
            type="checkbox" 
            checked={isInvisible} 
            onChange={(e) => onToggleInvisible(e.target.checked)} 
          />
        </div>

        <div className="profile-toggle">
          <span>Notifications</span>
          <input type="checkbox" defaultChecked />
        </div>

        <div className="status" style={isInvisible ? { color: '#6b7280' } : undefined}>
          <span 
            className="dot" 
            style={isInvisible ? { 
              background: '#6b7280', 
              boxShadow: '0 0 10px #6b7280' 
            } : undefined} 
          ></span>
          {isInvisible ? 'OFFLINE / INVISIBLE' : 'ACTIVE / VISIBLE'}
        </div>

        <button className="close-btn" onClick={onClose}>
            <path className="close-x-line" d="M8 8L16 16" />
            <path className="close-x-line" d="M16 8L8 16" />
          
          Close
        </button>

      </div>
    </div>
  );
};

export default ProfileModal;

