import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../config/api';
import { X, MessageCircle } from 'lucide-react';
import './Main.css';

type UserProfile = {
  username: string;
  profilePicUrl?: string | null;
};

type Props = {
  onClose: () => void;
  profiles: Record<string, UserProfile>;
};

export default function ContactsModal({ onClose, profiles }: Props) {
  const { username } = useAuth();
  const navigate = useNavigate();

  const startChat = async (partnerUsername: string) => {
    if (!username) return;
    try {
      const sortedUsers = [username, partnerUsername].sort();
      // Call our Express API to create the chat
      const res = await api.post('/chats', { participants: sortedUsers });
      const chatId = res.data.id;
      
      onClose();
      navigate(`/chat/${chatId}/${partnerUsername}`);
    } catch (e) {
      console.error('Failed to start chat', e);
    }
  };

  const contactList = Object.values(profiles).filter(p => p.username !== username);

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content glowing-border">
        <div className="modal-header">
          <h2>Select Node</h2>
          <button onClick={onClose} className="icon-button"><X size={24} /></button>
        </div>

        <div className="contact-list">
          {contactList.length === 0 ? (
            <p className="empty-state">No other nodes active.</p>
          ) : (
            contactList.map(contact => (
              <div
                key={contact.username}
                className="contact-item glass-panel"
                onClick={() => startChat(contact.username)}
              >
                <div className="avatar">
                  {contact.profilePicUrl ? (
                    <img src={contact.profilePicUrl} alt={contact.username} />
                  ) : (
                    <div className="avatar-placeholder">{contact.username.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <span className="contact-name">{contact.username}</span>
                <MessageCircle size={20} className="contact-action-icon" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
