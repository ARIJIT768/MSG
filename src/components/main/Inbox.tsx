import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, socket } from '../../config/api';
import CryptoJS from 'crypto-js';
import { MessageSquarePlus, LogOut, Shield } from 'lucide-react';
import ContactsModal from './ContactsModal';
import './Main.css';

const getSharedKey = (user1: string, user2: string) => {
  const sorted = [user1, user2].sort();
  return `secret_key_${sorted[0]}_${sorted[1]}`;
};

const decryptMessage = (ciphertext: string, sharedKey: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, sharedKey);
    return bytes.toString(CryptoJS.enc.Utf8) || 'Encrypted Message';
  } catch {
    return 'Encrypted Message';
  }
};

type ChatRoom = {
  id: string;
  participants: string[];
  lastMessage: string | null;
  lastMessageSender: string | null;
  lastMessageTime: string | null;
};

type UserProfile = {
  username: string;
  profilePicUrl?: string | null;
};

export default function Inbox() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [showContacts, setShowContacts] = useState(false);

  const fetchInboxData = async () => {
    if (!username) return;
    try {
      const [usersRes, chatsRes] = await Promise.all([
        api.get('/auth/users'),
        api.get(`/chats/${username}`)
      ]);

      const profileMap: Record<string, UserProfile> = {};
      usersRes.data.forEach((user: any) => {
        profileMap[user.username] = user;
      });
      setProfiles(profileMap);
      setChats(chatsRes.data);
    } catch (err) {
      console.warn('Failed to load inbox data:', err);
    }
  };

  useEffect(() => {
    fetchInboxData();

    socket.on('chat-updated', () => {
      fetchInboxData();
    });

    return () => {
      socket.off('chat-updated');
    };
  }, [username]);

  return (
    <div className="main-layout">
      <div className="sidebar glass-panel">
        <div className="sidebar-header">
          <h2>Inbox <span className="badge">{chats.length}</span></h2>
          <button className="icon-button" onClick={() => setShowContacts(true)} aria-label="New chat">
            <MessageSquarePlus size={22} />
          </button>
        </div>

        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="empty-state">
              <Shield size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p>No active sessions</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Start a secure conversation</p>
              <button className="primary-btn" onClick={() => setShowContacts(true)}>
                New Encrypted Chat
              </button>
            </div>
          ) : (
            chats.map(chat => {
              const partnerUsername = chat.participants.find(p => p !== username) || 'Unknown';
              const partnerProfile = profiles[partnerUsername];
              let displayLastMessage = chat.lastMessage || '';

              if (chat.lastMessage) {
                const sharedKey = getSharedKey(username || '', partnerUsername);
                displayLastMessage = decryptMessage(chat.lastMessage, sharedKey);
              }

              return (
                <div
                  key={chat.id}
                  className="chat-item"
                  onClick={() => navigate(`/chat/${chat.id}/${partnerUsername}`)}
                >
                  <div className="avatar">
                    {partnerProfile?.profilePicUrl ? (
                      <img src={partnerProfile.profilePicUrl} alt={partnerUsername} />
                    ) : (
                      <div className="avatar-placeholder">{partnerUsername.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <div className="chat-preview">
                    <div className="chat-preview-header">
                      <h3>{partnerUsername}</h3>
                      {chat.lastMessageTime && (
                        <span className="time">
                          {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="last-message">
                      {chat.lastMessageSender === username ? 'You: ' : ''}{displayLastMessage || 'Start chatting…'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <LogOut size={16} /> Disconnect
          </button>
        </div>
      </div>

      <div className="main-content hidden-mobile">
        <div className="welcome-screen">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="glass-panel welcome-card glowing-border">
            <h1>MSG Secure Network</h1>
            <p>End-to-end encrypted messaging</p>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Select a conversation to begin</p>
          </div>
        </div>
      </div>

      {showContacts && <ContactsModal onClose={() => setShowContacts(false)} profiles={profiles} />}
    </div>
  );
}
