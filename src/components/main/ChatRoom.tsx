import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../config/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CryptoJS from 'crypto-js';
import { ArrowLeft, Send, Shield, Paperclip, X, Loader2 } from 'lucide-react';
import './Main.css';

type Message = {
  id: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
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
    if (!ciphertext) return '';
    const bytes = CryptoJS.AES.decrypt(ciphertext, sharedKey);
    return bytes.toString(CryptoJS.enc.Utf8) || '';
  } catch {
    return '';
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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
  const sharedKey = getSharedKey(username, partnerUsername || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          text: decryptMessage(data.text || '', sharedKey),
          mediaUrl: data.mediaUrl || undefined,
          mediaType: data.mediaType || undefined,
          createdAt: data.createdAt,
        });
      });
      setMessages(msgs);
    }, (err) => {
      console.warn('Message listener error:', err);
    });
    
    return () => unsubscribe();
  }, [chatId, sharedKey]);

  // Handle media file selection
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      if (!isVideo && !isImage) {
        alert('Only images and videos are supported.');
        return;
      }

      setMediaFile(file);
      setMediaType(isVideo ? 'video' : 'image');
      
      // Generate preview
      const reader = new FileReader();
      reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
  };

  // Upload media at ORIGINAL quality (no compression)
  const uploadMedia = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'file';
    const filename = `chat_${chatId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const storageRef = ref(storage, `chat_media/${filename}`);
    
    // Upload original file — no compression, full quality
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
    
    return await getDownloadURL(snapshot.ref);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || !chatId || isSending) return;
    
    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    setUploadProgress(!!mediaFile);
    
    try {
      let uploadedMediaUrl: string | undefined;
      let uploadedMediaType: 'image' | 'video' | undefined;

      // Upload media if attached
      if (mediaFile && mediaType) {
        try {
          uploadedMediaUrl = await uploadMedia(mediaFile);
          uploadedMediaType = mediaType;
        } catch (uploadErr) {
          console.error('Media upload failed:', uploadErr);
          alert('Failed to upload media. Sending text only.');
        }
        clearMedia();
      }

      setUploadProgress(false);

      // Build message document
      const messageDoc: any = {
        senderId: username,
        text: messageText ? encryptMessage(messageText, sharedKey) : '',
        createdAt: serverTimestamp(),
      };

      if (uploadedMediaUrl) {
        messageDoc.mediaUrl = uploadedMediaUrl;
        messageDoc.mediaType = uploadedMediaType;
      }

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, messageDoc);
      
      // Update chat preview
      const chatRef = doc(db, 'chats', chatId);
      const previewText = uploadedMediaType === 'video' 
        ? '🎥 Video' 
        : uploadedMediaType === 'image' 
          ? '📷 Photo' 
          : messageText;
      
      await updateDoc(chatRef, {
        lastMessage: previewText ? encryptMessage(previewText, sharedKey) : '',
        lastMessageSender: username,
        lastMessageTime: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to send message", e);
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
      setUploadProgress(false);
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
                {/* Media Content */}
                {msg.mediaUrl && msg.mediaType === 'image' && (
                  <div 
                    className="media-content" 
                    onClick={() => setLightboxUrl(msg.mediaUrl!)}
                  >
                    <img 
                      src={msg.mediaUrl} 
                      alt="Shared photo" 
                      className="media-image"
                      loading="lazy"
                    />
                  </div>
                )}
                {msg.mediaUrl && msg.mediaType === 'video' && (
                  <div className="media-content">
                    <video 
                      src={msg.mediaUrl} 
                      className="media-video"
                      controls
                      preload="metadata"
                      playsInline
                    />
                  </div>
                )}
                {/* Text Content */}
                {msg.text && <p>{msg.text}</p>}
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

      {/* Media Preview Bar */}
      {mediaPreview && (
        <div className="media-preview-bar glass-panel">
          <div className="media-preview-thumb">
            {mediaType === 'image' ? (
              <img src={mediaPreview} alt="Preview" />
            ) : (
              <video src={mediaPreview} />
            )}
          </div>
          <div className="media-preview-info">
            <span className="media-preview-label">
              {mediaType === 'image' ? '📷 Photo' : '🎥 Video'} ready to send
            </span>
            <span className="media-preview-name">{mediaFile?.name}</span>
          </div>
          <button className="icon-button media-preview-close" onClick={clearMedia} aria-label="Remove">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="upload-progress-bar">
          <div className="upload-progress-inner" />
          <span>Uploading original quality…</span>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area glass-panel">
        <form onSubmit={handleSend} className="chat-form">
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            onChange={handleMediaSelect}
            style={{ display: 'none' }}
          />
          
          {/* Attach button */}
          <button 
            type="button" 
            className="attach-btn" 
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach media"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            className="chat-input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={mediaFile ? "Add a caption…" : "Type a message…"}
            autoComplete="off"
          />
          <button 
            type="submit" 
            className="send-btn" 
            disabled={(!newMessage.trim() && !mediaFile) || isSending} 
            aria-label="Send"
          >
            {isSending ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
          </button>
        </form>
      </div>

      {/* Lightbox for full-screen image viewing */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <button className="lightbox-close" onClick={() => setLightboxUrl(null)} aria-label="Close">
            <X size={28} />
          </button>
          <img src={lightboxUrl} alt="Full size" className="lightbox-image" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
