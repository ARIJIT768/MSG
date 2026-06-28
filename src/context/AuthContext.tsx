import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, socket } from '../config/api';

type AuthContextType = {
  username: string | null;
  profilePicUrl: string | null;
  isRegistered: boolean;
  isAuthenticated: boolean;
  login: (username: string, pin: string) => Promise<boolean>;
  register: (username: string, pin: string, file?: File | null) => Promise<boolean>;
  updateProfilePic: (file: File) => Promise<boolean>;
  logout: () => void;
  resetAllData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(!!localStorage.getItem('msg_username'));

  const isAuthenticated = !!username;

  useEffect(() => {
    // We don't auto-login anymore; user MUST enter PIN every session
    // So we don't set username here, unless we want to bypass PIN.
    // For maximum security, we require PIN.
    // We just check if they are registered.
    const storedUser = localStorage.getItem('msg_username');
    if (storedUser) {
      setIsRegistered(true);
    }

    return () => {
      socket.disconnect();
    }
  }, []);

  const login = async (usernameInput: string, pin: string) => {
    try {
      const res = await api.post('/auth/login', { username: usernameInput, pin });
      if (res.data.success) {
        setUsername(res.data.user.username);
        localStorage.setItem('msg_username', res.data.user.username);
        setIsRegistered(true);
        if (res.data.user.profilePicUrl) {
          setProfilePicUrl(res.data.user.profilePicUrl);
          localStorage.setItem('msg_profilePic', res.data.user.profilePicUrl);
        }
        socket.connect();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    }
  };

  const register = async (newUsername: string, pin: string, file?: File | null) => {
    try {
      let pfpUrl = null;

      if (file) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await api.post('/media/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          pfpUrl = uploadRes.data.url;
        } catch (uploadErr) {
          console.warn("PFP upload failed, continuing without it:", uploadErr);
        }
      }

      const res = await api.post('/auth/register', { 
        username: newUsername, 
        pin, 
        profilePicUrl: pfpUrl 
      });

      if (res.data.success) {
        localStorage.setItem('msg_username', res.data.user.username);
        setIsRegistered(true);
        setUsername(res.data.user.username);
        if (res.data.user.profilePicUrl) {
          localStorage.setItem('msg_profilePic', res.data.user.profilePicUrl);
          setProfilePicUrl(res.data.user.profilePicUrl);
        }
        socket.connect();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Registration failed:', e);
      return false;
    }
  };

  const updateProfilePic = async (file: File) => {
    if (!username) return false;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const pfpUrl = uploadRes.data.url;
      const res = await api.post('/auth/update-profile', { username, profilePicUrl: pfpUrl });
      
      if (res.data.success) {
        setProfilePicUrl(res.data.profilePicUrl);
        localStorage.setItem('msg_profilePic', res.data.profilePicUrl);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Update PFP failed:', e);
      return false;
    }
  };

  const logout = () => {
    socket.disconnect();
    setUsername(null); // Just clear the session (locks the app)
  };

  const resetAllData = async () => {
    localStorage.removeItem('msg_username');
    localStorage.removeItem('msg_profilePic');
    socket.disconnect();
    setUsername(null);
    setProfilePicUrl(null);
    setIsRegistered(false);
  };

  return (
    <AuthContext.Provider value={{ username, profilePicUrl, isRegistered, isAuthenticated, login, register, updateProfilePic, logout, resetAllData }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
