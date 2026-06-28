import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, socket } from '../../config/api';
import CryptoJS from 'crypto-js';
import { MessageSquarePlus, LogOut, Shield, Camera, Menu, X, Palette, CircleDashed } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import ContactsModal from './ContactsModal';
import StatusViewer from './StatusViewer';
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

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageSender: string;
  lastMessageTime: Date;
  unreadCount?: number;
}

export interface StatusItem {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
}

export interface UserStatuses {
  senderId: string;
  lastUpdateTime: string;
  statuses: StatusItem[];
};

type UserProfile = {
  username: string;
  profilePicUrl?: string | null;
};

export default function Inbox() {
  const { username, profilePicUrl, updateProfilePic, logout } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [statuses, setStatuses] = useState<UserStatuses[]>([]);
  const [activeTab, setActiveTab] = useState<'chats'|'updates'>('chats');
  const [activeStatusViewer, setActiveStatusViewer] = useState<UserStatuses | null>(null);
  
  const [showContacts, setShowContacts] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [isUpdatingPfp, setIsUpdatingPfp] = useState(false);
  const [isUploadingStatus, setIsUploadingStatus] = useState(false);
  const [activeTheme, setActiveTheme] = useState(localStorage.getItem('msg_theme') || '');

  useEffect(() => {
    document.body.className = activeTheme;
    localStorage.setItem('msg_theme', activeTheme);
  }, [activeTheme]);

  const handleImageUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUpdatingPfp(true);
      try {
        const file = e.target.files[0];
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        await updateProfilePic(compressedFile as File);
      } catch (err) {
        console.error("PFP update error:", err);
        alert("Failed to update profile picture");
      } finally {
        setIsUpdatingPfp(false);
      }
    }
  };

  const fetchChatsAndProfiles = async () => {
    try {
      const chatsRes = await api.get(`/chats/${username}`);
      setChats(chatsRes.data);

      const uniqueUsers = new Set<string>();
      chatsRes.data.forEach((chat: ChatRoom) => {
        chat.participants.forEach(p => uniqueUsers.add(p));
      });
      uniqueUsers.add(username || '');

      const profilesData: Record<string, UserProfile> = {};
      await Promise.all(
        Array.from(uniqueUsers).map(async (user) => {
          try {
            const profileRes = await api.get(`/auth/profile/${user}`);
            profilesData[user] = profileRes.data;
          } catch (e) {
            console.error(`Failed to load profile for ${user}`);
          }
        })
      );
      setProfiles(profilesData);
      
      // Fetch statuses
      try {
        const statusRes = await api.get(`/status/${username}`);
        setStatuses(statusRes.data);
      } catch (err) {
        console.error('Failed to load statuses', err);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

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

    socket.on('user-status-changed', ({ username: changedUser, isOnline, lastSeen }) => {
      setProfiles(prev => ({
        ...prev,
        [changedUser]: {
          ...prev[changedUser],
          username: changedUser,
          isOnline,
          lastSeen
        }
      }));
    });

    socket.on('user-new-status', () => {
      // Refresh statuses when someone posts a new one
      if (username) fetchChatsAndProfiles();
    });

    return () => {
      socket.off('chat-updated');
      socket.off('user-status-changed');
      socket.off('user-new-status');
    };
  }, [username]);

  const handleStatusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        setIsUploadingStatus(true);
        const file = e.target.files[0];
        
        let fileToUpload = file;
        const isVideo = file.type.startsWith('video/');
        
        if (!isVideo) {
          fileToUpload = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1280,
            useWebWorker: true
          });
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);

        const mediaRes = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        await api.post('/status', {
          senderId: username,
          mediaUrl: mediaRes.data.url,
          mediaType: isVideo ? 'video' : 'image',
          caption: ''
        });

        fetchChatsAndProfiles();
        socket.emit('new-status', { senderId: username });
      } catch (error) {
        console.error('Status upload failed:', error);
        alert('Failed to post status');
      } finally {
        setIsUploadingStatus(false);
      }
    }
  };

  const totalUnread = chats.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);

  return (
    <div className="main-layout">
      <div className="sidebar glass-panel">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="icon-button" onClick={() => setShowDrawer(true)} aria-label="Menu">
              <Menu size={24} />
            </button>
            <h2>Inbox {totalUnread > 0 && <span className="badge">{totalUnread}</span>}</h2>
          </div>
          <button className="icon-button" onClick={() => setShowContacts(true)} aria-label="New chat">
            <MessageSquarePlus size={22} />
          </button>
        </div>

        <div className="tab-switcher">
          <button className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>Chats</button>
          <button className={`tab-btn ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => setActiveTab('updates')}>Updates</button>
        </div>

        <div className="chat-list" style={{ marginTop: '10px' }}>
          {activeTab === 'chats' ? (
            chats.length === 0 ? (
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
                        <div className="chat-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {!!chat.unreadCount && chat.unreadCount > 0 && (
                            <span className="badge" style={{ padding: '2px 6px', fontSize: '10px' }}>{chat.unreadCount}</span>
                          )}
                          {chat.lastMessageTime && (
                            <span className="time">
                              {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="last-message">
                        {chat.lastMessageSender === username ? 'You: ' : ''}{displayLastMessage || 'Start chatting…'}
                      </p>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div className="updates-tab">
              <div className="status-item my-status">
                <input
                  type="file"
                  id="upload-status"
                  accept="image/*,video/*"
                  onChange={handleStatusUpload}
                  style={{ display: 'none' }}
                  disabled={isUploadingStatus}
                />
                <label htmlFor="upload-status" className="avatar status-ring my-status-ring">
                  {profilePicUrl ? (
                    <img src={profilePicUrl} alt="Me" />
                  ) : (
                    <div className="avatar-placeholder">{username?.charAt(0).toUpperCase()}</div>
                  )}
                  <div className="add-status-icon">+</div>
                </label>
                <div className="status-info">
                  <h3>My Status</h3>
                  <p>{isUploadingStatus ? 'Uploading...' : 'Tap to add status update'}</p>
                </div>
              </div>
              
              <h4 className="updates-header">Recent updates</h4>
              {statuses.filter(s => s.senderId !== username).map(statusUser => (
                <div key={statusUser.senderId} className="status-item" onClick={() => setActiveStatusViewer(statusUser)}>
                  <div className="avatar status-ring unread">
                    {profiles[statusUser.senderId]?.profilePicUrl ? (
                      <img src={profiles[statusUser.senderId].profilePicUrl} alt={statusUser.senderId} />
                    ) : (
                      <div className="avatar-placeholder">{statusUser.senderId.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <div className="status-info">
                    <h3>{statusUser.senderId}</h3>
                    <p>{new Date(statusUser.lastUpdateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
              
              {statuses.filter(s => s.senderId !== username).length === 0 && (
                <div className="empty-state" style={{ marginTop: '20px' }}>
                  <CircleDashed size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ fontSize: 13 }}>No recent updates from your network</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Removed, moved to Hamburger Menu */}
      </div>

      {showDrawer && (
        <div className="drawer-overlay" onClick={() => setShowDrawer(false)}>
          <div className="settings-drawer glass-panel" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>Settings</h2>
              <button className="icon-button" onClick={() => setShowDrawer(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="drawer-content">
              {/* Profile Section */}
              <div className="settings-section">
                <h3>Profile</h3>
                <div className="profile-edit-box">
                  <input
                    type="file"
                    id="update-pfp"
                    accept="image/*"
                    onChange={handleImageUpdate}
                    style={{ display: 'none' }}
                    disabled={isUpdatingPfp}
                  />
                  <label htmlFor="update-pfp" className="avatar large-avatar" style={{ cursor: 'pointer', opacity: isUpdatingPfp ? 0.5 : 1 }}>
                    {profilePicUrl ? (
                      <img src={profilePicUrl} alt="Me" />
                    ) : (
                      <div className="avatar-placeholder">{username?.charAt(0).toUpperCase()}</div>
                    )}
                    <div className="avatar-overlay">
                      <Camera size={24} color="#fff" />
                    </div>
                  </label>
                  <div className="profile-info">
                    <span className="profile-username">{username}</span>
                    <span className="profile-sub">Tap avatar to change</span>
                  </div>
                </div>
              </div>

              {/* Theme Section */}
              <div className="settings-section">
                <h3><Palette size={16} /> Appearance</h3>
                <div className="theme-options">
                  <button className={`theme-btn ${activeTheme === '' ? 'active' : ''}`} onClick={() => setActiveTheme('')}>Midnight Glass</button>
                  <button className={`theme-btn ${activeTheme === 'theme-cyberpunk' ? 'active' : ''}`} onClick={() => setActiveTheme('theme-cyberpunk')}>Cyberpunk Neon</button>
                  <button className={`theme-btn ${activeTheme === 'theme-emerald' ? 'active' : ''}`} onClick={() => setActiveTheme('theme-emerald')}>Emerald Forest</button>
                  <button className={`theme-btn ${activeTheme === 'theme-sunset' ? 'active' : ''}`} onClick={() => setActiveTheme('theme-sunset')}>Sunset Glow</button>
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button className="logout-btn full-width" onClick={logout}>
                <LogOut size={16} /> Disconnect from Network
              </button>
            </div>
          </div>
        </div>
      )}

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

      {activeStatusViewer && (
        <StatusViewer 
          userStatuses={activeStatusViewer} 
          profilePicUrl={profiles[activeStatusViewer.senderId]?.profilePicUrl}
          onClose={() => setActiveStatusViewer(null)} 
        />
      )}

      {showContacts && <ContactsModal onClose={() => setShowContacts(false)} profiles={profiles} />}
    </div>
  );
}
