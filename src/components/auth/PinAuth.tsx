import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, Lock, RotateCcw } from 'lucide-react';
import './Auth.css';

export default function PinAuth() {
  const { login, resetAllData } = useAuth();
  const navigate = useNavigate();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      const success = await login(pin);
      if (success) {
        navigate('/inbox');
      } else {
        setError('Access Denied. Invalid PIN.');
        setPin('');
      }
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to completely reset the app and lose your master PIN?")) {
      await resetAllData();
      navigate('/');
    }
  }

  return (
    <div className="auth-container">
      {/* Animated Orbs */}
      <div className="orb orb-1 auth-orb"></div>
      <div className="orb orb-2 auth-orb"></div>

      <div className={`glass-panel glowing-border auth-card ${error ? 'error-border' : ''}`}>
        <div className="auth-header">
          <Lock size={48} className={`auth-icon ${error ? 'text-danger' : ''}`} />
          <h1 className="auth-title">Secure Node</h1>
          <p className="auth-subtitle">Enter 6-digit key to decrypt session</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <div className={`input-group pin-group ${error ? 'input-error' : ''}`}>
            <KeyRound size={24} className="input-icon pin-icon" />
            <input 
              type="password" 
              placeholder="• • • • • •" 
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
              required
              maxLength={6}
              autoFocus
              className="pin-input"
            />
          </div>
          
          <div className="error-message">
            {error && <span>{error}</span>}
          </div>

          <button type="submit" className="auth-button login-button">
            Decrypt & Enter
          </button>
        </form>

        <button onClick={handleReset} className="reset-button">
          <RotateCcw size={16} />
          System Reset
        </button>
      </div>
    </div>
  );
}
