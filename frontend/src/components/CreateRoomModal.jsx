import React, { useState, useRef, useEffect } from 'react';
import './CreateRoomModal.css';

const CreateRoomModal = ({ onClose, onCreate }) => {
  const [roomName, setRoomName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [visibleIndex, setVisibleIndex] = useState(null);
  
  const [errors, setErrors] = useState({ roomName: '', passcode: '' });
  const [touched, setTouched] = useState({ roomName: false, passcode: false });
  const [shakeField, setShakeField] = useState(null); // 'roomName' or 'passcode'
  const [maxCharError, setMaxCharError] = useState(false);

  const roomNameRef = useRef(null);
  const otpRefs = useRef([]);

  // Alphanumeric, 4-8 chars
  const validateRoomName = (value) => {
    if (!value) return "Room name is required";
    if (value.length < 4) return "Room name must be at least 4 characters";
    if (value.length > 8) return "Maximum 8 characters allowed";
    if (!/^[A-Za-z0-9]+$/.test(value)) return "Only letters and numbers allowed";
    return "";
  };

  // Exactly 4 digits
  const validatePasscode = (value) => {
    if (!value || value.length < 4) return "Passcode must be exactly 4 digits";
    if (!/^\d{4}$/.test(value)) return "Passcode must be numeric only";
    return "";
  };

  useEffect(() => {
    if (touched.roomName) {
      setErrors(prev => ({ ...prev, roomName: validateRoomName(roomName) }));
    }
  }, [roomName, touched.roomName]);

  useEffect(() => {
    const passcode = otp.join('');
    if (touched.passcode) {
      setErrors(prev => ({ ...prev, passcode: validatePasscode(passcode) }));
    }
  }, [otp, touched.passcode]);

  const handleRoomNameChange = (e) => {
    const val = e.target.value;
    const filtered = val.replace(/[^A-Za-z0-9]/g, '');
    
    if (val.length > 8) {
      triggerShake('roomName');
      setMaxCharError(true);
      setTimeout(() => setMaxCharError(false), 2000);
    }
    
    setRoomName(filtered.slice(0, 8));
  };

const handleOtpChange = (index, value) => {
  // Only allow numbers
  const cleanValue = value.replace(/\D/g, '');
  if (!cleanValue && value !== '') return;

  const newOtp = [...otp];

  // If user typed/pasted more than 1 char in a box
  if (cleanValue.length > 1) {
    const chars = cleanValue.split('').slice(0, 4 - index);

    chars.forEach((char, i) => {
      if (index + i < 4) {
        newOtp[index + i] = char;

        // briefly reveal typed digit
        setVisibleIndex(index + i);

        setTimeout(() => {
          setVisibleIndex(null);
        }, 400);
      }
    });

    setOtp(newOtp);

    const nextFocus = Math.min(index + chars.length, 3);
    otpRefs.current[nextFocus].focus();

  } else {

    newOtp[index] = cleanValue;
    setOtp(newOtp);

    // briefly show typed digit
    setVisibleIndex(index);

    setTimeout(() => {
      setVisibleIndex(null);
    }, 400);

    if (cleanValue && index < 3) {
      otpRefs.current[index + 1].focus();
    }
  }
};
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        otpRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!data) return;

    const newOtp = [...otp];
    data.split('').forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    const nextFocus = Math.min(data.length, 3);
    otpRefs.current[nextFocus].focus();
  };

  const triggerShake = (field) => {
    setShakeField(field);
    setTimeout(() => setShakeField(null), 500);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    
    const passcode = otp.join('');
    const roomErr = validateRoomName(roomName);
    const passErr = validatePasscode(passcode);

    if (roomErr || passErr) {
      setErrors({ roomName: roomErr, passcode: passErr });
      setTouched({ roomName: true, passcode: true });
      
      if (roomErr) {
        triggerShake('roomName');
        roomNameRef.current?.focus();
      } else if (passErr) {
        triggerShake('passcode');
        otpRefs.current[passcode.length < 4 ? passcode.length : 3].focus();
      }
      return;
    }

onCreate({ 
  name: roomName.trim(), 
  isPrivate: true, 
  passcode: passcode
});
  }

  return (
    <div className="modal-overlay">
      <div className="create-room-modal">
        {/* Header - Stacked and Centered */}
        <div className="modal-header">
          <div className="header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div className="header-text">
            <h2>Create Private Room</h2>
            <p className="modal-subtitle">Secure, encrypted space</p>
          </div>
        </div>

        <form onSubmit={handleCreate} noValidate>
          <div className={`input-group ${errors.roomName && touched.roomName ? 'has-error' : ''} ${shakeField === 'roomName' ? 'shake' : ''} ${maxCharError ? 'excess-error' : ''}`}>
            <label>Room Name</label>
            <input 
              ref={roomNameRef}
              type="text" 
              placeholder="e.g. Secret" 
              value={roomName}
              onChange={handleRoomNameChange}
              onBlur={() => setTouched(prev => ({ ...prev, roomName: true }))}
              autoFocus
              autoComplete="off"
            />
            {(errors.roomName && touched.roomName) || maxCharError ? (
              <span className="error-text">
                {maxCharError ? "Maximum 8 characters allowed" : errors.roomName}
              </span>
            ) : null}
          </div>

          <div className={`input-group ${errors.passcode && touched.passcode ? 'has-error' : ''} ${shakeField === 'passcode' ? 'shake' : ''}`}>
            <label>Passcode</label>
            <div className="otp-container">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => otpRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  className="otp-box"
                  value={
  visibleIndex === index
    ? digit
    : digit
      ? "•"
      : ""
}
                  onChange={e => handleOtpChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  onBlur={() => {
                    if (index === 3) setTouched(prev => ({ ...prev, passcode: true }));
                  }}
                  autoComplete="off"
                />
              ))}
            </div>
            {errors.passcode && touched.passcode && <span className="error-text">{errors.passcode}</span>}
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="create-btn">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
