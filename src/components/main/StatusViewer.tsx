import React, { useState, useEffect } from 'react';
import { X, Trash2, Eye } from 'lucide-react';
import type { UserStatuses } from './Inbox';
import { api, socket } from '../../config/api';

interface StatusViewerProps {
  userStatuses: UserStatuses;
  profilePicUrl?: string;
  username: string; // Used to determine if the viewer owns the status
  onClose: () => void;
}

export default function StatusViewer({ userStatuses, profilePicUrl, username, onClose }: StatusViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showViewersModal, setShowViewersModal] = useState(false);
  
  const currentStatus = userStatuses.statuses[currentIndex];
  const DURATION = 5000; // 5 seconds per status

  // Handle Marking as Viewed
  useEffect(() => {
    if (userStatuses.senderId !== username && !currentStatus.viewers.includes(username)) {
      api.post(`/status/${currentStatus.id}/view`, { username })
        .then(() => {
          socket.emit('status-viewed', { statusId: currentStatus.id, viewer: username });
        })
        .catch(err => console.error('Failed to mark status as viewed', err));
    }
  }, [currentStatus.id, userStatuses.senderId, username, currentStatus.viewers]);

  useEffect(() => {
    let start = Date.now();
    let animationFrameId: number;
    let isPaused = false;

    const tick = () => {
      if (isPaused || showViewersModal) return;
      const elapsed = Date.now() - start;
      const currentProgress = (elapsed / DURATION) * 100;
      
      if (currentProgress >= 100) {
        if (currentIndex < userStatuses.statuses.length - 1) {
          setCurrentIndex(prev => prev + 1);
          start = Date.now();
          setProgress(0);
          animationFrameId = requestAnimationFrame(tick);
        } else {
          onClose();
        }
      } else {
        setProgress(currentProgress);
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [currentIndex, userStatuses.statuses.length, onClose, showViewersModal]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < userStatuses.statuses.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this status?')) return;
    
    try {
      await api.delete(`/status/${currentStatus.id}?senderId=${username}`);
      socket.emit('delete-status', currentStatus.id);
      
      // Navigate to next or close
      if (userStatuses.statuses.length === 1) {
        onClose();
      } else {
        // Just close for simplicity, as the list state gets tricky here
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete status', err);
      alert('Failed to delete status');
    }
  };

  return (
    <div className="status-viewer-overlay">
      <div className="status-viewer-container">
        
        {/* Progress Bars */}
        <div className="status-progress-container">
          {userStatuses.statuses.map((s, i) => (
            <div key={s.id} className="status-progress-bg">
              <div 
                className="status-progress-fill" 
                style={{ 
                  width: i < currentIndex ? '100%' : (i === currentIndex ? `${progress}%` : '0%') 
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="status-header">
          <div className="status-user-info">
            <div className="avatar small-avatar">
              {profilePicUrl ? (
                <img src={profilePicUrl} alt={userStatuses.senderId} />
              ) : (
                <div className="avatar-placeholder">{userStatuses.senderId.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div>
              <span className="status-username">{userStatuses.senderId}</span>
              <span className="status-time">
                {new Date(currentStatus.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {userStatuses.senderId === username && (
              <button className="icon-button" onClick={handleDelete} title="Delete Status">
                <Trash2 size={24} color="#ef4444" />
              </button>
            )}
            <button className="icon-button" onClick={onClose} title="Close">
              <X size={24} color="#fff" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="status-content">
          {currentStatus.mediaType === 'image' && (
            <img src={currentStatus.mediaUrl} alt="Status" className="status-media" />
          )}
          {currentStatus.mediaType === 'video' && (
            <video src={currentStatus.mediaUrl} autoPlay loop muted playsInline className="status-media" />
          )}
          {currentStatus.mediaType === 'text' && (
            <div className="status-text">{currentStatus.caption}</div>
          )}
        </div>

        {/* Caption */}
        {currentStatus.caption && currentStatus.mediaType !== 'text' && (
          <div className="status-caption">
            {currentStatus.caption}
          </div>
        )}

        {/* Viewers Eye Icon (Owner Only) */}
        {userStatuses.senderId === username && (
          <div className="status-viewers-btn" onClick={(e) => {
            e.stopPropagation();
            setShowViewersModal(true);
          }}>
            <Eye size={20} />
            <span>{currentStatus.viewers.length}</span>
          </div>
        )}

        {/* Navigation Tap Zones */}
        {!showViewersModal && (
          <>
            <div className="status-tap-zone prev" onClick={handlePrev} />
            <div className="status-tap-zone next" onClick={handleNext} />
          </>
        )}
        
        {/* Viewers Modal */}
        {showViewersModal && (
          <div className="viewers-modal-overlay" onClick={() => setShowViewersModal(false)}>
            <div className="viewers-modal-content glass-panel" onClick={e => e.stopPropagation()}>
              <div className="drawer-header" style={{ padding: '16px' }}>
                <h3>Viewed by {currentStatus.viewers.length}</h3>
                <button className="icon-button" onClick={() => setShowViewersModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="viewers-list">
                {currentStatus.viewers.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No views yet</p>
                ) : (
                  currentStatus.viewers.map(viewer => (
                    <div key={viewer} className="viewer-item">
                      <div className="avatar small-avatar">
                        <div className="avatar-placeholder">{viewer.charAt(0).toUpperCase()}</div>
                      </div>
                      <span>{viewer}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
