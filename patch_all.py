#!/usr/bin/env python3
"""Orbit UI Patch Script — applies all 4 parts of the UI overhaul."""
import re, os

BASE = r"c:\Users\oscar\OneDrive\Desktop\Orbit\frontend\src"

def r(path):
    with open(os.path.join(BASE, path), "r", encoding="utf-8") as f:
        return f.read()

def w(path, content):
    with open(os.path.join(BASE, path), "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✓ Written {path}")

# ─────────────────────────────────────────────────────────────────────────────
# PART 2: Replace CameraModeIcon in App.jsx with premium 2D/3D icons
# ─────────────────────────────────────────────────────────────────────────────
app = r("App.jsx")

# Find and replace the CameraModeIcon block
# Use regex that handles both \n and \r\n
old_pattern = r"const CameraModeIcon = \(\{ mode \}\) =>.*?^};"
new_icon_code = r'''// ── Premium 2D / 3D Toggle Icons ─────────────────────────────────────────────
const Icon2D = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Flat map layer grid */}
    <rect x="2.5" y="6.5" width="19" height="11" rx="1.5"
      stroke="currentColor" strokeWidth="1.55" fill="none"/>
    <line x1="2.5" y1="10" x2="21.5" y2="10" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5"/>
    <line x1="2.5" y1="13.5" x2="21.5" y2="13.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5"/>
    <line x1="9" y1="6.5" x2="9" y2="17.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5"/>
    <line x1="15.5" y1="6.5" x2="15.5" y2="17.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5"/>
  </svg>
);

const Icon3D = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Isometric building extrusion */}
    {/* Top face */}
    <path d="M12 3 L20 7.5 L12 12 L4 7.5 Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      fill="currentColor" fillOpacity="0.14"/>
    {/* Left face */}
    <path d="M4 7.5 L4 16.5 L12 21 L12 12 Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      fill="currentColor" fillOpacity="0.07"/>
    {/* Right face */}
    <path d="M12 12 L12 21 L20 16.5 L20 7.5 Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      fill="currentColor" fillOpacity="0.11"/>
  </svg>
);

const CameraModeIcon = ({ mode }) => {
  if (mode === CAMERA_MODES.TOP) return <Icon2D />;
  return <Icon3D />;
};'''

# Replace using regex with DOTALL
app_new = re.sub(
    r'const CameraModeIcon = \(\{ mode \}\) =>.*?\n\};',
    new_icon_code,
    app,
    flags=re.DOTALL
)

if app_new == app:
    print("  ⚠ CameraModeIcon pattern not matched, trying alternate…")
    # Try to find the block manually
    start_marker = "const CameraModeIcon"
    end_marker = "\n};\n"
    si = app.find(start_marker)
    if si != -1:
        ei = app.find(end_marker, si) + len(end_marker)
        app_new = app[:si] + new_icon_code + "\n" + app[ei:]
        print("  ✓ Manual replacement done")
    else:
        print("  ✗ Could not find CameraModeIcon block")
        app_new = app
else:
    print("  ✓ CameraModeIcon replaced via regex")

w("App.jsx", app_new)

# ─────────────────────────────────────────────────────────────────────────────
# PART 3: Rebuild ProfileModal.jsx with premium unified design
# ─────────────────────────────────────────────────────────────────────────────

profile_modal = '''import React, { useState } from 'react';

const ProfileModal = ({
  user,
  onClose,
  onChangeAvatar,
  onUpdateUsername,
  onLogout,
  isInvisible,
  onToggleInvisible,
  themeMode = "dark",
  onThemeModeChange,
}) => {
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

  const isLightMode = themeMode === "light";
  const handleThemeToggle = () => {
    onThemeModeChange?.(isLightMode ? "dark" : "light");
  };

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
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
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

        {/* ── Notifications toggle ── */}
        <div className="pm-toggle-row">
          <div className="pm-toggle-info">
            <span className="pm-toggle-label">Notifications</span>
            <span className="pm-toggle-desc">Alert on nearby activity</span>
          </div>
          <button
            type="button"
            className="pm-toggle-switch pm-toggle-switch--on"
            aria-pressed={true}
          >
            <span className="pm-toggle-thumb"/>
          </button>
        </div>

      </div>
    </div>
  );
};

export default ProfileModal;
'''

w("components/ProfileModal.jsx", profile_modal)

# ─────────────────────────────────────────────────────────────────────────────
# PART 3: Add premium profile modal CSS to App.css
# ─────────────────────────────────────────────────────────────────────────────
app_css = r("App.css")

premium_profile_css = """

/* ═══════════════════════════════════════════════════════════════
   💎 PREMIUM PROFILE MODAL — Unified glass design language
   ═══════════════════════════════════════════════════════════════ */

/* Glass panel base */
.pm-glass {
  background:
    radial-gradient(circle at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%),
    linear-gradient(180deg, rgba(20,21,24,0.88), rgba(9,10,12,0.92));
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.04),
    0 32px 72px rgba(0,0,0,0.72),
    0 8px 28px rgba(0,0,0,0.46),
    inset 0 1px 0 rgba(255,255,255,0.12),
    inset 0 -1px 0 rgba(0,0,0,0.3);
  backdrop-filter: blur(28px) saturate(1.2);
  -webkit-backdrop-filter: blur(28px) saturate(1.2);
  padding: 0;
  overflow: hidden;
}

/* Faint noise grain texture via pseudo-element */
.pm-glass::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 0;
  border-radius: inherit;
}

.profile-modal.pm-glass > * { position: relative; z-index: 1; }

/* ── Top action bar ── */
.pm-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px 0 20px;
}

.pm-logout-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(248,113,113,0.07);
  border: 1px solid rgba(248,113,113,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.pm-logout-btn svg { width: 18px; height: 18px; }

.pm-logout-btn:hover {
  background: rgba(248,113,113,0.15);
  border-color: rgba(248,113,113,0.36);
  transform: scale(1.07);
  box-shadow: 0 0 16px rgba(248,113,113,0.22);
}

.pm-close-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.10);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.7);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.pm-close-btn svg { width: 16px; height: 16px; }

.pm-close-btn:hover {
  background: rgba(255,255,255,0.10);
  border-color: rgba(255,255,255,0.20);
  transform: scale(1.06);
  color: #fff;
}

/* ── Avatar ── */
.pm-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin: 20px auto 0 auto;
  cursor: pointer;
  position: relative;
  border: 2px solid rgba(255,255,255,0.10);
  box-shadow:
    0 0 0 4px rgba(255,255,255,0.04),
    0 12px 32px rgba(0,0,0,0.4);
  overflow: hidden;
  transition: transform 220ms cubic-bezier(0.34,1.56,0.64,1), border-color 220ms ease, box-shadow 220ms ease;
}

.pm-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.pm-avatar-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: rgba(255,255,255,0.9);
  opacity: 0;
  transition: opacity 200ms ease;
}

.pm-avatar:hover {
  transform: scale(1.08);
  border-color: rgba(255,255,255,0.26);
  box-shadow:
    0 0 0 4px rgba(255,255,255,0.06),
    0 16px 40px rgba(0,0,0,0.52),
    0 0 28px rgba(255,255,255,0.08);
}

.pm-avatar:hover .pm-avatar-hint { opacity: 1; }

/* ── Name row ── */
.pm-name-row {
  margin-top: 14px;
  text-align: center;
  padding: 0 24px;
}

.pm-name-display {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.pm-username {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgba(248,250,252,0.96);
}

.pm-edit-btn {
  background: none;
  border: none;
  color: rgba(148,163,184,0.6);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 150ms ease, transform 150ms ease;
}

.pm-edit-btn svg { width: 15px; height: 15px; }
.pm-edit-btn:hover { color: rgba(255,211,107,0.9); transform: scale(1.15); }

.pm-name-input {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,211,107,0.38);
  border-radius: 10px;
  color: rgba(248,250,252,0.96);
  font-size: 20px;
  font-weight: 700;
  padding: 6px 14px;
  text-align: center;
  outline: none;
  width: 85%;
  box-shadow: 0 0 0 3px rgba(255,211,107,0.10);
}

/* ── Status indicator ── */
.pm-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.8px;
}

.pm-status--active { color: rgba(52,211,118,0.9); }
.pm-status--invisible { color: rgba(148,163,184,0.65); }

.pm-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pm-status--active .pm-status-dot {
  background: #34d376;
  box-shadow: 0 0 0 3px rgba(52,211,118,0.18), 0 0 10px rgba(52,211,118,0.5);
  animation: pmStatusPulse 2.4s ease-in-out infinite;
}

.pm-status--invisible .pm-status-dot {
  background: rgba(148,163,184,0.6);
  box-shadow: 0 0 6px rgba(148,163,184,0.2);
}

@keyframes pmStatusPulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(52,211,118,0.18), 0 0 10px rgba(52,211,118,0.5); }
  50% { box-shadow: 0 0 0 5px rgba(52,211,118,0.10), 0 0 18px rgba(52,211,118,0.4); }
}

/* ── Divider ── */
.pm-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent);
  margin: 20px 24px;
}

/* ── Sections ── */
.pm-section {
  padding: 0 24px 16px;
}

.pm-section-label {
  display: block;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 1.8px;
  color: rgba(148,163,184,0.6);
  margin-bottom: 8px;
}

.pm-room-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(0,0,0,0.22);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  font-size: 13px;
  font-weight: 600;
  color: rgba(226,232,240,0.92);
  letter-spacing: 0.3px;
}

.pm-room-name {
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: 0.5px;
}

/* ── Toggle rows ── */
.pm-toggle-row, .pm-theme-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  transition: background 150ms ease;
}

.pm-toggle-row:hover { background: rgba(255,255,255,0.025); }

.pm-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pm-toggle-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(226,232,240,0.92);
}

.pm-toggle-desc {
  font-size: 11px;
  color: rgba(148,163,184,0.55);
  letter-spacing: 0.2px;
}

/* ── Premium toggle switch (matches theme switch quality) ── */
.pm-toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  cursor: pointer;
  transition: background 240ms ease, border-color 240ms ease, box-shadow 240ms ease;
  flex-shrink: 0;
}

.pm-toggle-switch--on {
  background: rgba(52,211,118,0.22);
  border-color: rgba(52,211,118,0.36);
  box-shadow: 0 0 14px rgba(52,211,118,0.18), inset 0 0 8px rgba(52,211,118,0.08);
}

.pm-toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(148,163,184,0.8);
  transition: transform 240ms cubic-bezier(0.34,1.56,0.64,1), background 240ms ease, box-shadow 240ms ease;
  box-shadow: 0 1px 4px rgba(0,0,0,0.35);
}

.pm-toggle-switch--on .pm-toggle-thumb {
  transform: translateX(20px);
  background: #34d376;
  box-shadow: 0 0 8px rgba(52,211,118,0.55), 0 1px 4px rgba(0,0,0,0.3);
}

/* Bottom padding */
.pm-toggle-row:last-child {
  margin-bottom: 6px;
  padding-bottom: 18px;
}

"""

# Append to App.css
if "pm-glass" not in app_css:
    app_css += premium_profile_css
    w("App.css", app_css)
    print("  ✓ Profile CSS appended")
else:
    print("  ~ Profile CSS already present, skipping")

print("\n✅ All patches applied successfully!")
