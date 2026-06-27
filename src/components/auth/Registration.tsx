import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, User, Key, Loader2, Fingerprint } from 'lucide-react';
import './Auth.css';

export default function Registration() {
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [pfpFile, setPfpFile] = useState<File | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPfpFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPfpPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && pin.length === 6) {
      let downloadURL = undefined;
      
      if (pfpFile) {
        try {
          setIsUploading(true);
          const filename = `pfp_${username}_${Date.now()}`;
          const storageRef = ref(storage, `pfps/${filename}`);
          
          const snapshot = await uploadBytes(storageRef, pfpFile);
          downloadURL = await getDownloadURL(snapshot.ref);
        } catch (e: any) {
          console.error("Failed to upload PFP", e);
          if (e.message && e.message.includes('unauthorized')) {
             alert("Firebase Storage Rules error! You need to allow read/write in your Firebase Console. Continuing without a profile picture for now.");
          } else {
             alert("Failed to upload profile picture. Try again without one.");
             setIsUploading(false);
             return;
          }
        }
      }
      
      try {
        await register(username, pin, downloadURL);
        navigate('/');
      } catch (e) {
        console.error("Failed to register", e);
      } finally {
        setIsUploading(false);
      }
    } else {
      alert('Please enter a valid username and a 6-digit PIN.');
    }
  };

  return (
    <div className="auth-container">
      {/* Animated Orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>

      <div className="glass-panel glowing-border auth-card">
        <div className="auth-header">
          <Fingerprint size={48} className="auth-icon" />
          <h1 className="auth-title">Initialize Identity</h1>
          <p className="auth-subtitle">Create your highly encrypted node</p>
        </div>

        <form onSubmit={handleRegister} className="auth-form">
          <div className="pfp-upload-container">
            <input 
              type="file" 
              id="pfp-upload" 
              accept="image/*" 
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <label htmlFor="pfp-upload" className="pfp-label">
              {pfpPreview ? (
                <img src={pfpPreview} alt="Preview" className="pfp-image" />
              ) : (
                <div className="pfp-placeholder">
                  <Camera size={32} />
                  <span>Upload Avatar</span>
                </div>
              )}
            </label>
          </div>

          <div className="input-group">
            <User size={20} className="input-icon" />
            <input 
              type="text" 
              placeholder="Username (e.g. Neo)" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <Key size={20} className="input-icon" />
            <input 
              type="password" 
              placeholder="6-Digit Master PIN" 
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              required
              maxLength={6}
              pattern="\d{6}"
            />
          </div>

          <button type="submit" className="auth-button" disabled={isUploading}>
            {isUploading ? <Loader2 className="spinner" /> : 'Encrypt & Join'}
          </button>
        </form>
      </div>
    </div>
  );
}
