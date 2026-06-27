import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import CryptoJS from 'crypto-js';
import { ArrowLeft, Send, Shield } from 'lucide-react';
import './Main.css';

type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
};

const getSharedKey = (user1: string, user2: string) => {
  const sorted = [user1, user2].sort();
  return `secret_key_${sorted[0]}_${sorted[1]}`;
};

const encryptMessage = (message: string, sharedKey: string) => {
  return CryptoJS.AES.encrypt(message, sharedKey).toString();
};

const decryptMessage = (ciphertext: string, sharedKey: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, sharedKey);
    return bytes.toString(CryptoJS.enc.Utf8) || 'Decryption Error';
  } catch {
    return 'Decryption Error';
  }
};

export default function ChatRoom() {
  const { chatId, partnerUsername } = useParams();
  const { username } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [partnerPic, setPartnerPic] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const sharedKey = getSharedKey(username, partnerUsername || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!partnerUsername) return;
    const fetchPartner = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', partnerUsername));
        if (snap.exists()) {
          setPartnerPic(snap.data().profilePicUrl || null);
        }
      } catch (err) {
        console.warn('Failed to fetch partner profile:', err);
      }
    };
    fetchPartner();
  }, [partnerUsername]);

  useEffect(() => {
    if (!chatId) return;
    
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          senderId: data.senderId,
          text: decryptMessage(data.text, sharedKey),
          createdAt: data.createdAt,
        });
      });
      setMessages(msgs);
    }, (err) => {
      console.warn('Message listener error:', err);
    });
    
    return () => unsubscribe();
  }, [chatId, sharedKey]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || isSending) return;
    
    const messageText = newMessage.trim();
    const encryptedText = encryptMessage(messageText, sharedKey);
    setNewMessage('');
    setIsSending(true);
    
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: username,
        text: encryptedText,
        createdAt: serverTimestamp(),
      });
      
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: encryptedText,
        lastMessageSender: username,
        lastMessageTime: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to send message", e);
      setNewMessage(messageText); // Restore message on failure
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="main-layout chat-layout">
      {/* Header */}
      <div className="chat-header glass-panel">
        <button className="icon-button back-btn" onClick={() => navigate('/inbox')} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="chat-partner-info">
          <div className="avatar small-avatar">
            {partnerPic ? (
              <img src={partnerPic} alt={partnerUsername} />
            ) : (
              <div className="avatar-placeholder">{partnerUsername?.charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="header-text">
            <h2>{partnerUsername}</h2>
            <div className="encryption-badge">
              <Shield size={10} className="shield-icon" />
              <span>AES-256 Encrypted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state" style={{ padding: 40 }}>
            <Shield size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
            <p style={{ fontSize: 13 }}>Messages are end-to-end encrypted</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Say hello to start the conversation</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === username;
          return (
            <div key={msg.id} className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}>
              <div className={`message-bubble ${isMine ? 'my-bubble' : 'their-bubble'}`}>
                <p>{msg.text}</p>
                <span className="message-time">
                  {msg.createdAt?.toDate?.()
                    ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '…'}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area glass-panel">
        <form onSubmit={handleSend} className="chat-form">
          <input
            type="text"
            className="chat-input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message…"
            autoComplete="off"
          />
          <button type="submit" className="send-btn" disabled={!newMessage.trim() || isSending} aria-label="Send">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
