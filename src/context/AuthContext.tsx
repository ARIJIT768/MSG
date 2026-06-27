import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

type AuthContextType = {
  isRegistered: boolean;
  isAuthenticated: boolean;
  username: string;
  profilePicUrl: string | null;
  login: (pin: string) => Promise<boolean>;
  register: (username: string, pin: string, profilePicUri?: string) => Promise<void>;
  logout: () => void;
  resetAllData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkRegistration = () => {
      try {
        const storedPin = localStorage.getItem('user_pin');
        const storedName = localStorage.getItem('user_name');
        const storedPic = localStorage.getItem('user_pic');
        if (storedPin) {
          setIsRegistered(true);
          if (storedName) setUsername(storedName);
          if (storedPic) setProfilePicUrl(storedPic);
        }
      } catch (e) {
        console.error('Failed to check registration status', e);
      }
    };
    checkRegistration();
  }, []);

  const login = async (pin: string) => {
    try {
      const storedPin = localStorage.getItem('user_pin');
      const storedName = localStorage.getItem('user_name');
      const storedPic = localStorage.getItem('user_pic');
      if (storedPin === pin) {
        if (storedName) setUsername(storedName);
        if (storedPic) setProfilePicUrl(storedPic);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to login', e);
      return false;
    }
  };

  const register = async (username: string, pin: string, profilePicUri?: string) => {
    try {
      localStorage.setItem('user_pin', pin);
      localStorage.setItem('user_name', username);
      if (profilePicUri) {
        localStorage.setItem('user_pic', profilePicUri);
      }
      
      // Save to global Firestore registry
      await setDoc(doc(db, 'users', username), {
        username,
        profilePicUrl: profilePicUri || null,
        registeredAt: new Date().toISOString()
      }, { merge: true });

      setUsername(username);
      if (profilePicUri) setProfilePicUrl(profilePicUri);
      setIsRegistered(true);
      setIsAuthenticated(true);
    } catch (e) {
      console.error('Failed to register', e);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const resetAllData = async () => {
    try {
      localStorage.removeItem('user_pin');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_pic');
      localStorage.removeItem('user_theme');
      setIsRegistered(false);
      setIsAuthenticated(false);
      setUsername('');
      setProfilePicUrl(null);
    } catch (e) {
      console.error('Failed to reset app data', e);
    }
  };

  return (
    <AuthContext.Provider value={{ isRegistered, isAuthenticated, username, profilePicUrl, login, register, logout, resetAllData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
