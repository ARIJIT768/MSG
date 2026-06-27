import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import CryptoJS from 'crypto-js';
import { MessageSquarePlus, LogOut } from 'lucide-react';
import ContactsModal from './ContactsModal';
import './Main.css';

const getSharedKey = (user1: string, user2: string) => {
  const sorted = [user1, user2].sort();
  return `secret_key_${sorted[0]}_${sorted[1]}`;
};

const decryptMessage = (ciphertext: string, sharedKey: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, sharedKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return 'Encrypted Message';
  }
};

type ChatRoom = {
  id: string;
  participants: string[];
  lastMessage: string | null;
  lastMessageSender: string | null;
  lastMessageTime: any;
};

type UserProfile = {
  username: string;
  profilePicUrl?: string;
};

export default function Inbox() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    if (!username) return;

    const fetchProfiles = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const profs: Record<string, UserProfile> = {};
      snap.forEach(d => {
        profs[d.id] = d.data() as UserProfile;
      });
      setProfiles(profs);
    };
    fetchProfiles();

    const q = query(collection(db, 'chats'), where('participants', 'array-contains', username));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList: ChatRoom[] = [];
      snapshot.forEach(doc => {
        chatList.push({ id: doc.id, ...doc.data() } as ChatRoom);
      });
      
      chatList.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.toMillis() - a.lastMessageTime.toMillis();
      });
      
      setChats(chatList);
    });

    return () => unsubscribe();
  }, [username]);

  return (
    <div className="main-layout">
      {/* Sidebar */}
      <div className="sidebar glass-panel">
        <div className="sidebar-header">
          <h2>Inbox <span className="badge">{chats.length}</span></h2>
          <button className="icon-button" onClick={() => setShowContacts(true)}>
            <MessageSquarePlus size={24} />
          </button>
        </div>

        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="empty-state">
              <p>No active sessions.</p>
              <button className="primary-btn" onClick={() => setShowContacts(true)}>
                Start a Secure Chat
              </button>
            </div>
          ) : (
            chats.map(chat => {
              const partnerUsername = chat.participants.find(p => p !== username) || 'Unknown';
              const partnerProfile = profiles[partnerUsername];
              let displayLastMessage = chat.lastMessage || '';
              
              if (chat.lastMessage) {
                const sharedKey = getSharedKey(username, partnerUsername);
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
                          {chat.lastMessageTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="last-message">
                      {chat.lastMessageSender === username ? 'You: ' : ''}{displayLastMessage}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} /> Disconnect
          </button>
        </div>
      </div>

      {/* Main Content Area (Desktop only preview) */}
      <div className="main-content hidden-mobile">
        <div className="welcome-screen">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="glass-panel welcome-card glowing-border">
            <h1>MSG Secure Network</h1>
            <p>End-to-end encrypted messaging node.</p>
            <p>Select a chat to begin.</p>
          </div>
        </div>
      </div>

      {showContacts && <ContactsModal onClose={() => setShowContacts(false)} profiles={profiles} />}
    </div>
  );
}
