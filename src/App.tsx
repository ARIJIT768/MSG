import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Registration from './components/auth/Registration';
import PinAuth from './components/auth/PinAuth';
import Inbox from './components/main/Inbox';
import ChatRoom from './components/main/ChatRoom';

function App() {
  const { isRegistered, isAuthenticated } = useAuth();

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
