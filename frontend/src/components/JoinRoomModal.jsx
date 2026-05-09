import React, { useState, useRef, useEffect } from 'react';
import './JoinRoomModal.css';

/**
 * JoinRoomModal
 * Props:
 *   roomName   – the room the user is trying to join
 *   onJoin(passcode) – called with the 4-digit passcode string
 *   onCancel   – called when the user dismisses the modal
 *   error      – error string to display (from parent, cleared on new attempt)
 *   loading    – bool, disables submit while waiting for server response
 */
const JoinRoomModal = ({ roomName, onJoin, onCancel, error, loading }) => {
  const [otp, setOtp]           = useState(['', '', '', '']);
  const [visibleIndex, setVisibleIndex] = useState(null);
  const [shake, setShake]       = useState(false);
  const otpRefs                 = useRef([]);

  // Auto-focus first box when modal opens
  useEffect(() => {
    otpRefs.current[0]?.focus();
  }, []);

  // Trigger shake when a new error arrives
  useEffect(() => {
    if (error) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      // Clear boxes so user can retype
      setOtp(['', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    }
  }, [error]);

  const handleChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    if (!clean && value !== '') return;

    const next = [...otp];

    if (clean.length > 1) {
      // Paste handling
      const chars = clean.split('').slice(0, 4 - index);
      chars.forEach((c, i) => { if (index + i < 4) next[index + i] = c; });
      setOtp(next);
      const focusIdx = Math.min(index + chars.length, 3);
      otpRefs.current[focusIdx]?.focus();
    } else {
      next[index] = clean;
      setOtp(next);
      if (clean && index < 3) otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      otpRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && index === 3) {
      handleSubmit();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!data) return;
    const next = [...otp];
    data.split('').forEach((c, i) => { next[i] = c; });
    setOtp(next);
    otpRefs.current[Math.min(data.length, 3)]?.focus();
  };

  const handleSubmit = () => {
    const passcode = otp.join('');
    if (passcode.length < 4 || loading) return;
    onJoin(passcode);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const passcode    = otp.join('');
  const canSubmit   = passcode.length === 4 && !loading;

  return (
    <div className="jr-overlay" onClick={handleOverlayClick}>
      <div className="jr-modal">

        {/* Header */}
        <div className="jr-header">
          <div className="jr-lock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="jr-title">Enter Room Passcode</h2>
            <p className="jr-subtitle">
              Joining&nbsp;<span className="jr-room-name">{roomName}</span>
            </p>
          </div>
        </div>

        {/* OTP inputs */}
        <div className={`jr-otp-wrap ${shake ? 'jr-shake' : ''} ${error ? 'jr-has-error' : ''}`}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => (otpRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className="jr-otp-box"
              value={
              visibleIndex === i
                ? digit
                : digit
                  ? "•"
                  : ""
            }
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              autoComplete="off"
              disabled={loading}
            />
          ))}
        </div>

        {/* Error message */}
        <div className={`jr-error-wrap ${error ? 'jr-error-visible' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="jr-error-icon">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>

        {/* Actions */}
        <div className="jr-actions">
          <button
            type="button"
            className="jr-cancel-btn"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="jr-join-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <span className="jr-spinner" />
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ width: 14, height: 14 }}>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                JOIN ROOM
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default JoinRoomModal;
