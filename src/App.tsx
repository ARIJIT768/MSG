import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { api, socket } from './config/api';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import Registration from './components/auth/Registration';
import PinAuth from './components/auth/PinAuth';
import Inbox from './components/main/Inbox';
import ChatRoom from './components/main/ChatRoom';

function App() {
  const { username, isRegistered, isAuthenticated } = useAuth();

  useEffect(() => {
    const setupUpdater = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        await CapacitorUpdater.notifyAppReady();
        
        const res = await api.get('/update/check');
        const latestVersion = res.data.version;
        const downloadUrl = res.data.url;

        const storedVersion = localStorage.getItem('app_version');
        
        if (latestVersion && storedVersion !== latestVersion) {
          console.log(`Downloading update ${latestVersion}...`);
          
          const bundle = await CapacitorUpdater.download({
            url: downloadUrl,
            version: latestVersion
          });
          localStorage.setItem('app_version', latestVersion);
          await CapacitorUpdater.set({ id: bundle.id });
        }
      } catch (err) {
        console.warn('OTA Update check failed:', err);
      }
    };
    setupUpdater();
  }, []);

  // Global Theme Initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('msg_theme') || '';
    document.body.className = savedTheme;
  }, []);

  useEffect(() => {
    if (isAuthenticated && username) {
      socket.connect();
      socket.emit('user-connected', username);
    }
  }, [isAuthenticated, username]);

  if (!isRegistered) {
    return <Registration />;
  }

  if (!isAuthenticated) {
    return <PinAuth />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/inbox" replace />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/chat/:chatId/:partnerUsername" element={<ChatRoom />} />
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}

export default App;
