import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import './VoiceNotePlayer.css';

interface VoiceNotePlayerProps {
  src: string;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const seekTime = (Number(e.target.value) / 100) * duration;
    audio.currentTime = seekTime;
    setProgress(Number(e.target.value));
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="voice-note-container glass-panel">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <button className="vn-play-btn" onClick={togglePlayPause}>
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="vn-play-icon" />}
      </button>

      <div className="vn-scrubber-container">
        <input
          type="range"
          className="vn-scrubber"
          value={progress || 0}
          min="0"
          max="100"
          onChange={handleSeek}
          style={{ backgroundSize: `${progress}% 100%` }}
        />
        <div className="vn-time-info">
          <span className="vn-time">{formatTime(currentTime)}</span>
          {isLoaded && <span className="vn-time">{formatTime(duration)}</span>}
        </div>
      </div>
    </div>
  );
};
