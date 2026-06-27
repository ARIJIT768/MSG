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
    if (!username.trim() || pin.length !== 6) {
      alert('Please enter a valid username and a 6-digit PIN.');
      return;
    }

    setIsUploading(true);
    let downloadURL: string | undefined = undefined;
    
    if (pfpFile) {
      try {
        const filename = `pfp_${username}_${Date.now()}`;
        const storageRef = ref(storage, `pfps/${filename}`);
        
        const uploadPromise = uploadBytes(storageRef, pfpFile).then(snap => getDownloadURL(snap.ref));
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Upload timed out')), 10000)
        );
        
        downloadURL = await Promise.race([uploadPromise, timeoutPromise]);
      } catch (e: any) {
        console.warn("PFP upload failed, continuing without it:", e?.message);
      }
    }
    
    try {
      await register(username, pin, downloadURL);
      navigate('/');
    } catch (e) {
      console.error("Registration failed:", e);
      alert("Registration failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      <div className="glass-panel glowing-border auth-card">
        <div className="auth-header">
          <div className="auth-icon-wrap">
            <Fingerprint size={32} className="auth-icon" />
          </div>
          <h1 className="auth-title">Initialize Identity</h1>
          <p className="auth-subtitle">Create your encrypted node</p>
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
                  <Camera size={28} />
                  <span>Avatar</span>
                </div>
              )}
            </label>
          </div>

          <div className="input-group">
            <User size={18} className="input-icon" />
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="input-group">
            <Key size={18} className="input-icon" />
            <input 
              type="password" 
              placeholder="6-Digit PIN" 
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              required
              maxLength={6}
              inputMode="numeric"
              pattern="\d{6}"
              autoComplete="off"
            />
          </div>

          <button type="submit" className="auth-button" disabled={isUploading}>
            {isUploading ? <Loader2 size={20} className="spinner" /> : 'Encrypt & Join'}
          </button>
        </form>
      </div>
    </div>
  );
}
