import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, socket } from '../../config/api';
import CryptoJS from 'crypto-js';
import { ArrowLeft, Send, Shield, Paperclip, X, Loader2, Reply, Check, CheckCheck, Phone, PhoneOff, PhoneCall } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import './Main.css';

type Message = {
  id: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  replyTo?: string | null;
  status?: 'sent' | 'delivered' | 'read';
  reactions?: Record<string, string>;
  createdAt: any;
};

const getSharedKey = (user1: string, user2: string) => {
  const sorted = [user1, user2].sort();
  return `secret_key_${sorted[0]}_${sorted[1]}`;
};

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
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
  const [partnerOnline, setPartnerOnline] = useState<boolean>(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [replyToMsgId, setReplyToMsgId] = useState<string | null>(null);
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);

  // WebRTC State
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ caller: string; offer: any } | null>(null);
  const [inCall, setInCall] = useState(false);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  const sharedKey = getSharedKey(username || '', partnerUsername || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<any>(null);

  const handlePressStart = (msgId: string) => {
    pressTimer.current = setTimeout(() => {
      setContextMenuMsgId(msgId);
    }, 450); // 450ms long press
  };

  const handlePressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!partnerUsername) return;
    const fetchPartner = async () => {
      try {
        const res = await api.get(`/auth/user/${partnerUsername}`);
        setPartnerPic(res.data.profilePicUrl || null);
        setPartnerOnline(res.data.isOnline);
        setPartnerLastSeen(res.data.lastSeen);
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
      
      // Mark read when opening chat
      if (msgs.length > 0) {
        socket.emit('mark-read', { chatId, readerId: username });
      }
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
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, {
            ...msg,
            text: decryptMessage(msg.text, sharedKey)
          }];
        });
        
        if (msg.senderId !== username) {
          socket.emit('mark-read', { chatId, readerId: username });
        }
      }
    });

    // Listen for delivered receipts
    socket.on('messages-delivered', ({ chatId: deliveredChatId, readerId }) => {
      if (deliveredChatId === chatId && readerId !== username) {
        setMessages(prev => prev.map(m => 
          m.senderId === username && m.status === 'sent' ? { ...m, status: 'delivered' } : m
        ));
      }
    });

    // Listen for read receipts
    socket.on('messages-read', ({ chatId: readChatId, readerId }) => {
      if (readChatId === chatId && readerId !== username) {
        setMessages(prev => prev.map(m => 
          m.senderId === username && m.status !== 'read' ? { ...m, status: 'read' } : m
        ));
      }
    });

    // Listen for reactions
    socket.on('message-reaction-updated', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, reactions } : m
      ));
    });

    // Listen for status changes
    socket.on('user-status-changed', ({ username: changedUser, isOnline, lastSeen }) => {
      if (changedUser === partnerUsername) {
        setPartnerOnline(isOnline);
        setPartnerLastSeen(lastSeen);
      }
    });

    // --- WebRTC Listeners ---
    socket.on('call-made', async (data) => {
      setIncomingCall({ caller: data.caller, offer: data.offer });
    });

    socket.on('answer-made', async (data) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setInCall(true);
        setIsCalling(false);
      }
    });

    socket.on('ice-candidate-received', async (candidate) => {
      if (peerConnection.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    });

    socket.on('call-ended', () => {
      endCall(false); // end call without emitting since it's already ended by remote
    });
    // ------------------------

    return () => {
      socket.off('receive-message');
      socket.off('messages-delivered');
      socket.off('messages-read');
      socket.off('message-reaction-updated');
      socket.off('user-status-changed');
      socket.off('call-made');
      socket.off('answer-made');
      socket.off('ice-candidate-received');
      socket.off('call-ended');
    };
  }, [chatId, sharedKey, partnerUsername]);

  const initWebRTC = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;
      if (localAudioRef.current) localAudioRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { candidate: event.candidate, chatId });
        }
      };

      return pc;
    } catch (err) {
      console.error('Failed to get local audio', err);
      alert('Microphone access is required for voice calls.');
      return null;
    }
  };

  const startCall = async () => {
    setIsCalling(true);
    const pc = await initWebRTC();
    if (!pc) { setIsCalling(false); return; }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('call-user', { offer, chatId, caller: username });
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const pc = await initWebRTC();
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('make-answer', { answer, chatId });
    setIncomingCall(null);
    setInCall(true);
  };

  const declineCall = () => {
    socket.emit('end-call', chatId);
    setIncomingCall(null);
  };

  const endCall = (emitEnd = true) => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    if (emitEnd) socket.emit('end-call', chatId);
    setInCall(false);
    setIsCalling(false);
    setIncomingCall(null);
  };

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


      
      setReplyToMsgId(null);

      // 1. Immediately append to local state (Optimistic)
      const tempId = Date.now().toString();
      const localMsg: Message = {
        id: tempId,
        senderId: username || '',
        text: messageText,
        mediaUrl: uploadedMediaUrl,
        mediaType: uploadedMediaType,
        replyTo: replyToMsgId,
        status: 'sent',
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, localMsg]);

      // 2. Fire and forget via socket (Zero Latency)
      socket.emit('send-message', {
        chatId,
        senderId: username,
        text: encryptedText,
        mediaUrl: uploadedMediaUrl,
        mediaType: uploadedMediaType,
        replyTo: replyToMsgId
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
      {/* Hidden Audio Elements for WebRTC */}
      <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* Incoming Call Modal */}
      {incomingCall && !inCall && (
        <div className="call-overlay">
          <div className="call-modal glass-panel glowing-border">
            <div className="caller-avatar">
              <PhoneCall size={32} color="#10b981" />
            </div>
            <h3>{incomingCall.caller} is calling...</h3>
            <div className="call-actions">
              <button className="icon-button accept-btn" onClick={acceptCall}><Phone size={24} /></button>
              <button className="icon-button decline-btn" onClick={declineCall}><PhoneOff size={24} /></button>
            </div>
          </div>
        </div>
      )}

      {/* In-Call / Calling Overlay */}
      {(isCalling || inCall) && (
        <div className="active-call-bar glass-panel">
          <div className="call-status">
            <Phone size={16} className={inCall ? "pulse-icon" : "pulse-icon-slow"} color={inCall ? "#10b981" : "#06b6d4"} />
            <span>{inCall ? `In call with ${partnerUsername}` : `Calling ${partnerUsername}...`}</span>
          </div>
          <button className="icon-button decline-btn small" onClick={() => endCall(true)}>
            <PhoneOff size={16} />
          </button>
        </div>
      )}

      <div className="chat-header glass-panel">
        <button className="icon-button back-btn" onClick={() => navigate('/inbox')} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="chat-partner-info">
          <div 
            className="avatar small-avatar" 
            onClick={() => partnerPic && setLightboxUrl(partnerPic)}
            style={{ cursor: partnerPic ? 'pointer' : 'default' }}
          >
            {partnerPic ? (
              <img src={partnerPic} alt={partnerUsername} />
            ) : (
              <div className="avatar-placeholder">{partnerUsername?.charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="header-text">
            <h2>{partnerUsername}</h2>
            {partnerOnline ? (
              <div className="status-badge online">
                <span className="dot"></span> Online
              </div>
            ) : partnerLastSeen ? (
              <div className="status-badge offline">
                last seen at {new Date(partnerLastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            ) : (
              <div className="encryption-badge">
                <Shield size={10} className="shield-icon" />
                <span>AES-256 Encrypted</span>
              </div>
            )}
          </div>
        </div>
        {!inCall && !isCalling && (
          <button className="icon-button call-btn" onClick={startCall} aria-label="Voice Call">
            <Phone size={20} />
          </button>
        )}
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
          
          let repliedMsg: Message | undefined;
          let repliedText = '';
          if (msg.replyTo) {
            repliedMsg = messages.find(m => m.id === msg.replyTo);
            if (repliedMsg) {
              repliedText = repliedMsg.text || 'Media message';
              if (repliedText.length > 50) repliedText = repliedText.substring(0, 50) + '...';
            }
          }

          return (
            <div key={msg.id} className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}>
              <div 
                className={`message-bubble ${isMine ? 'my-bubble' : 'their-bubble'}`}
                onContextMenu={(e) => e.preventDefault()}
                onMouseDown={() => handlePressStart(msg.id)}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onMouseMove={handlePressEnd}
                onTouchStart={() => handlePressStart(msg.id)}
                onTouchEnd={handlePressEnd}
                onTouchMove={handlePressEnd}
              >
                
                {contextMenuMsgId === msg.id && (
                  <div className="context-menu-overlay" onClick={(e) => { e.stopPropagation(); setContextMenuMsgId(null); }}>
                    <div className={`context-menu ${isMine ? 'context-right' : 'context-left'}`} onClick={e => e.stopPropagation()}>
                      <div className="reaction-picker">
                        {['👍', '❤️', '😂', '😲', '😢', '🙏'].map(emoji => (
                          <button key={emoji} className="reaction-btn" onClick={() => {
                            socket.emit('add-reaction', { messageId: msg.id, chatId, username, emoji });
                            setContextMenuMsgId(null);
                          }}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="context-divider"></div>
                      <button className="context-action-btn" onClick={() => {
                        setReplyToMsgId(msg.id);
                        setContextMenuMsgId(null);
                      }}>
                        <Reply size={16} style={{ marginRight: 8 }} /> Reply
                      </button>
                    </div>
                  </div>
                )}

                {repliedMsg && (
                  <div className="replied-message-box" onClick={() => {
                    const el = document.getElementById(`msg-${repliedMsg!.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}>
                    <div className="replied-sender">{repliedMsg.senderId === username ? 'You' : repliedMsg.senderId}</div>
                    <div className="replied-text">{repliedText}</div>
                  </div>
                )}
                
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
                
                {(msg.reactions && Object.keys(msg.reactions).length > 0) && (
                  <div className={`reactions-container ${isMine ? 'reactions-mine' : 'reactions-theirs'}`}>
                    {Object.entries(msg.reactions).map(([usr, emj]) => (
                      <span key={usr} className="reaction-pill">{emj}</span>
                    ))}
                  </div>
                )}
                
                <div className="message-footer" id={`msg-${msg.id}`}>
                  <span className="message-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  
                  {isMine && (
                    <span className="read-receipt">
                      {msg.status === 'read' ? <CheckCheck size={14} color="#34B7F1" /> : 
                       msg.status === 'delivered' ? <CheckCheck size={14} color="rgba(255,255,255,0.7)" /> : 
                       <Check size={14} color="rgba(255,255,255,0.5)" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {replyToMsgId && (
        <div className="reply-preview-bar glass-panel">
          <div className="reply-preview-content">
            <span className="reply-preview-label">
              Replying to {messages.find(m => m.id === replyToMsgId)?.senderId === username ? 'yourself' : messages.find(m => m.id === replyToMsgId)?.senderId}
            </span>
            <span className="reply-preview-text">
              {messages.find(m => m.id === replyToMsgId)?.text || 'Media'}
            </span>
          </div>
          <button className="icon-button" onClick={() => setReplyToMsgId(null)}>
            <X size={18} />
          </button>
        </div>
      )}

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
