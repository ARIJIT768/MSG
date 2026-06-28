import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, socket } from '../../config/api';
import CryptoJS from 'crypto-js';
import { ArrowLeft, Send, Shield, Paperclip, X, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
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

  const sharedKey = getSharedKey(username || '', partnerUsername || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!partnerUsername) return;
    const fetchPartner = async () => {
      try {
        const res = await api.get('/auth/users');
        const partner = res.data.find((u: any) => u.username === partnerUsername);
        if (partner) {
          setPartnerPic(partner.profilePicUrl || null);
        }
      } catch (err) {
        console.warn('Failed to fetch partner profile:', err);
      }
    };
    fetchPartner();
  }, [partnerUsername]);

  const loadMessages = async () => {
    if (!chatId) return;
    try {
      const res = await api.get(`/messages/${chatId}`);
      const msgs = res.data.map((msg: any) => ({
        ...msg,
        text: decryptMessage(msg.text, sharedKey)
      }));
      setMessages(msgs);
    } catch (err) {
      console.warn('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    if (!chatId) return;

    // Load initial messages
    loadMessages();

    // Join Socket.io room
    socket.emit('join-chat', chatId);

    // Listen for new messages
    socket.on('receive-message', (msg: any) => {
      if (msg.chatId === chatId) {
        setMessages(prev => {
          // Check if we already added it (we append our own messages instantly on send)
          if (prev.find(m => m.id === msg.id)) return prev;
          
          return [...prev, {
            ...msg,
            text: decryptMessage(msg.text, sharedKey)
          }];
        });
      }
    });

    return () => {
      socket.off('receive-message');
    };
  }, [chatId, sharedKey]);

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        alert('Only images and videos are supported.');
        return;
      }

      let finalFile: File | Blob = file;

      if (isImage) {
        try {
          const options = {
            maxSizeMB: 1, // slightly larger for chat photos
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          finalFile = await imageCompression(file, options);
        } catch (error) {
          console.error("Compression error:", error);
        }
      }

      setMediaFile(finalFile as File);
      setMediaType(isVideo ? 'video' : 'image');

      const reader = new FileReader();
      reader.onload = (event) => setMediaPreview(event.target?.result as string);
      reader.readAsDataURL(finalFile);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
  };

  const uploadMedia = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.url;
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

      const encryptedText = messageText ? encryptMessage(messageText, sharedKey) : '';

      const payload = {
        senderId: username,
        text: encryptedText,
        mediaUrl: uploadedMediaUrl,
        mediaType: uploadedMediaType,
      };

      // 1. Save to DB
      const res = await api.post(`/messages/${chatId}`, payload);
      const savedMessage = res.data;

      // 2. Append to local state immediately
      setMessages(prev => [...prev, {
        ...savedMessage,
        text: messageText // decrypt for ourselves
      }]);

      // 3. Emit via Socket.io
      socket.emit('send-message', {
        ...savedMessage,
        chatId
      });

    } catch (e) {
      console.error('Failed to send message', e);
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
      setUploadProgress(false);
    }
  };

  return (
    <div className="main-layout chat-layout">
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
                {msg.text && <p>{msg.text}</p>}
                <span className="message-time">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

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

      {uploadProgress && (
        <div className="upload-progress-bar">
          <div className="upload-progress-inner" />
          <span>Uploading original quality…</span>
        </div>
      )}

      <div className="chat-input-area glass-panel">
        <form onSubmit={handleSend} className="chat-form">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            onChange={handleMediaSelect}
            style={{ display: 'none' }}
          />

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
            placeholder={mediaFile ? 'Add a caption…' : 'Type a message…'}
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
