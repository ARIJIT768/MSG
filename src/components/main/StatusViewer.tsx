import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { UserStatuses } from './Inbox';

interface StatusViewerProps {
  userStatuses: UserStatuses;
  profilePicUrl?: string;
  onClose: () => void;
}

export default function StatusViewer({ userStatuses, profilePicUrl, onClose }: StatusViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const currentStatus = userStatuses.statuses[currentIndex];
  const DURATION = 5000; // 5 seconds per status

  useEffect(() => {
    let start = Date.now();
    let animationFrameId: number;
    let isPaused = false;

    const tick = () => {
      if (isPaused) return;
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
  }, [currentIndex, userStatuses.statuses.length, onClose]);

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
          <button className="icon-button" onClick={onClose}>
            <X size={24} color="#fff" />
          </button>
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

        {/* Navigation Tap Zones */}
        <div className="status-tap-zone prev" onClick={handlePrev} />
        <div className="status-tap-zone next" onClick={handleNext} />
      </div>
    </div>
  );
}
