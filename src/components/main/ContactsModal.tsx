import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { X, MessageCircle } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import './Main.css';

type UserProfile = {
  username: string;
  profilePicUrl?: string;
};

type Props = {
  onClose: () => void;
  profiles: Record<string, UserProfile>;
};

export default function ContactsModal({ onClose, profiles }: Props) {
  const { username } = useAuth();
  const navigate = useNavigate();

  const startChat = async (partnerUsername: string) => {
    try {
      const sortedUsers = [username, partnerUsername].sort();
      const chatId = `${sortedUsers[0]}_${sortedUsers[1]}`;
      const chatRef = doc(db, 'chats', chatId);
      
      const chatDoc = await getDoc(chatRef);
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: sortedUsers,
          createdAt: serverTimestamp(),
          lastMessage: null,
          lastMessageSender: null,
          lastMessageTime: null,
        });
      }
      
      onClose();
      navigate(`/chat/${chatId}/${partnerUsername}`);
    } catch (e) {
      console.error("Failed to start chat", e);
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
