import React, {useEffect, useRef, useState} from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Film,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {ExtractedFrame, Language} from '../types';
import {
  calculateFrameSharpness,
  formatVideoTimestamp,
} from '../utils/videoFrameExtractor';

interface IncidentMediaPlayerProps {
  videoUrl: string | null;
  videoSourceName: string;
  language: Language;
  onSnapCustomFrame: (frame: ExtractedFrame) => void;
  onRescanSharpestFrames?: () => void;
  isExtracting?: boolean;
  existingFramesCount: number;
}

export const IncidentMediaPlayer: React.FC<IncidentMediaPlayerProps> = ({
  videoUrl,
  videoSourceName,
  language,
  onSnapCustomFrame,
  onRescanSharpestFrames,
  isExtracting = false,
  existingFramesCount,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [lastSnappedToast, setLastSnappedToast] = useState<string | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [videoUrl]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const newTime = Number(e.target.value);
    v.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const stepFrame = (deltaSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(false);
    const target = Math.max(
      0,
      Math.min(v.duration || 10, v.currentTime + deltaSeconds)
    );
    v.currentTime = target;
    setCurrentTime(target);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) {
      v.requestFullscreen();
    }
  };

  const handleSnapCurrentFrame = () => {
    const v = videoRef.current;
    if (!v) return;

    const natW = v.videoWidth || 800;
    const natH = v.videoHeight || 450;

    // Score sharpness
    const scoreW = 240;
    const scoreH = Math.max(135, Math.round((natH / natW) * scoreW));
    const scoreCanvas = document.createElement('canvas');
    scoreCanvas.width = scoreW;
    scoreCanvas.height = scoreH;
    const scoreCtx = scoreCanvas.getContext('2d', {willReadFrequently: true});

    const outW = Math.min(960, natW);
    const outH = Math.round((natH / natW) * outW);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');

    if (!scoreCtx || !outCtx) return;

    scoreCtx.drawImage(v, 0, 0, scoreW, scoreH);
    const sharpnessScore = calculateFrameSharpness(
      scoreCtx.getImageData(0, 0, scoreW, scoreH)
    );

    outCtx.drawImage(v, 0, 0, outW, outH);
    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.88);
    const ts = Number(v.currentTime.toFixed(2));
    const formatted = formatVideoTimestamp(ts);

    const newFrame: ExtractedFrame = {
      id: `manual-snap-${Date.now()}`,
      frameNumber: existingFramesCount + 1,
      timestampSeconds: ts,
      timestampFormatted: formatted,
      sharpnessScore,
      dataUrl,
      selected: true,
      width: outW,
      height: outH,
    };

    onSnapCustomFrame(newFrame);
    setLastSnappedToast(
      language === 'id'
        ? `Frame pada ${formatted} (Skor: ${sharpnessScore}) ditambahkan!`
        : `Snapped frame at ${formatted} (Sharpness: ${sharpnessScore})!`
    );
    setTimeout(() => setLastSnappedToast(null), 3000);
  };

  if (!videoUrl) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-white overflow-hidden shadow-md">
      {/* Top Media Player Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-bold truncate">
            {language === 'id'
              ? 'Pemutar Media Video Bukti (Lokal)'
              : 'Forensic Video Media Player (On-Device)'}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-[11px] font-mono-tabular text-slate-400 truncate max-w-[200px]">
            {videoSourceName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular">
          <span className="text-cyan-300 font-bold">
            {formatVideoTimestamp(currentTime)}
          </span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400">
            {formatVideoTimestamp(duration || 0)}
          </span>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative bg-black aspect-video w-full flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          muted={isMuted}
          playsInline
          onClick={togglePlay}
          onTimeUpdate={() =>
            setCurrentTime(videoRef.current?.currentTime || 0)
          }
          onLoadedMetadata={() =>
            setDuration(videoRef.current?.duration || 0)
          }
          onEnded={() => setIsPlaying(false)}
          className="w-full h-full object-contain cursor-pointer"
        />

        {lastSnappedToast && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-emerald-600/95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">
            {lastSnappedToast}
          </div>
        )}
      </div>

      {/* Scrubber & Controls */}
      <div className="p-3.5 bg-slate-900 space-y-3">
        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            aria-label="Video timeline scrubber"
            min={0}
            max={duration > 0 ? duration : 10}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Transport & Frame-Step Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>{language === 'id' ? 'Jeda' : 'Pause'}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>{language === 'id' ? 'Putar' : 'Play'}</span>
                </>
              )}
            </button>

            {/* Frame-by-frame step buttons (-0.1s / +0.1s) */}
            <button
              type="button"
              onClick={() => stepFrame(-0.1)}
              title="Step back 0.1s (1 frame)"
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-tabular font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>-0.1s</span>
            </button>

            <button
              type="button"
              onClick={() => stepFrame(0.1)}
              title="Step forward 0.1s (1 frame)"
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-tabular font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <span>+0.1s</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
              }}
              title="Restart clip"
              className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed & Audio/Fullscreen Controls */}
          <div className="flex items-center gap-1.5">
            {[0.25, 0.5, 1, 2].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleSpeedChange(rate)}
                className={`min-h-[36px] px-2 py-1 rounded-lg text-[11px] font-mono-tabular font-semibold cursor-pointer ${
                  playbackRate === rate
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}

            <button
              type="button"
              onClick={toggleMute}
              aria-label="Toggle Mute"
              className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              )}
            </button>

            <button
              type="button"
              onClick={handleFullscreen}
              aria-label="Fullscreen"
              className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Snap Current Frame & Re-scan Actions */}
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSnapCurrentFrame}
            className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>
              {language === 'id'
                ? 'Ambil Frame Saat Ini ke Bukti'
                : 'Snap Current Frame to Evidence Grid'}
            </span>
          </button>

          {onRescanSharpestFrames && (
            <button
              type="button"
              disabled={isExtracting}
              onClick={onRescanSharpestFrames}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {language === 'id'
                  ? 'Ekstrak Ulang 12 Frame Tertajam'
                  : 'Re-Scan 12 Sharpest Frames'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
