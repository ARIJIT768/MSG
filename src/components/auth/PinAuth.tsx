import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, Lock, RotateCcw, Loader2 } from 'lucide-react';
import './Auth.css';

export default function PinAuth() {
  const { login, resetAllData } = useAuth();
  const navigate = useNavigate();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) return;
    
    setIsLoading(true);
    try {
      const success = await login(pin);
      if (success) {
        navigate('/inbox');
      } else {
        setError('Access Denied. Invalid PIN.');
        setPin('');
      }
    } catch (err) {
      setError('Authentication failed.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm("This will erase all local data and your encryption keys. Are you sure?")) {
      await resetAllData();
      window.location.reload();
    }
  };

  return (
    <div className="auth-container">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      <div className={`glass-panel glowing-border auth-card ${error ? 'error-border' : ''}`}>
        <div className="auth-header">
          <div className="auth-icon-wrap">
            <Lock size={32} className={`auth-icon ${error ? 'text-danger' : ''}`} />
          </div>
          <h1 className="auth-title">Secure Node</h1>
          <p className="auth-subtitle">Enter key to decrypt session</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <div className={`input-group pin-group ${error ? 'input-error' : ''}`}>
            <KeyRound size={22} className="input-icon pin-icon" />
            <input 
              type="password" 
              placeholder="• • • • • •" 
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
              required
              maxLength={6}
              autoFocus
              inputMode="numeric"
              className="pin-input"
              autoComplete="off"
            />
          </div>
          
          <div className="error-message">
            {error && <span>{error}</span>}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading || pin.length !== 6}>
            {isLoading ? <Loader2 size={20} className="spinner" /> : 'Decrypt & Enter'}
          </button>
        </form>

        <button onClick={handleReset} className="reset-button">
          <RotateCcw size={14} />
          System Reset
        </button>
      </div>
    </div>
  );
}
