"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import WaveSurfer from "wavesurfer.js";

interface RecordingPlayerProps {
  url?: string;
  duration?: number;
}

export function RecordingPlayer({ url }: RecordingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!containerRef.current || !url) return;

    let ws: WaveSurfer;

    const initWaveSurfer = async () => {
      try {
        ws = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: "#E4E7DF",
          progressColor: "#1B4332",
          cursorColor: "#1B4332",
          cursorWidth: 1,
          barWidth: 3,
          barGap: 2,
          barRadius: 2,
          height: 64,
          normalize: true,
          backend: "WebAudio",
        });

        ws.load(url);

        ws.on("ready", () => {
          setIsLoaded(true);
          setDuration(ws.getDuration());
          setError(null);
        });

        ws.on("audioprocess", () => {
          setCurrentTime(ws.getCurrentTime());
        });

        ws.on("play", () => setIsPlaying(true));
        ws.on("pause", () => setIsPlaying(false));
        ws.on("finish", () => {
          setIsPlaying(false);
          setCurrentTime(0);
        });

        ws.on("error", (err) => {
          console.error("WaveSurfer error:", err);
          setError("Failed to load audio");
        });

        wavesurferRef.current = ws;
      } catch (err) {
        console.error("Failed to initialize WaveSurfer:", err);
        setError("Audio player initialization failed");
      }
    };

    initWaveSurfer();

    return () => {
      if (ws) {
        ws.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [url]);

  const togglePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isLoaded) return;
    ws.playPause();
  }, [isLoaded]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    const ws = wavesurferRef.current;
    if (ws) {
      ws.setPlaybackRate(newSpeed);
      setSpeed(newSpeed);
    }
    setShowSpeedMenu(false);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const ws = wavesurferRef.current;
    if (!ws || !isLoaded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    ws.seekTo(pct);
  }, [isLoaded]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-lg bg-[#FFFFFF] border border-[#E4E7DF] p-4">
      {/* WaveSurfer waveform container */}
      <div
        ref={containerRef}
        className="h-16 mb-3 cursor-pointer"
        onClick={handleSeek}
      />

      {/* Error state */}
      {error && !isLoaded && (
        <p className="text-[11px] text-[#E11D48] text-center mb-2">{error}</p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={!url || !isLoaded}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0",
            url && isLoaded
              ? "bg-[#1B4332] hover:brightness-110 text-white"
              : "bg-[#F1F3EE] text-[#5C6B62] cursor-not-allowed"
          )}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Time */}
        <div className="flex items-center gap-2 text-[12px] font-mono text-[#5C6B62] shrink-0">
          <span>{formatTime(currentTime)}</span>
          <span className="text-[#8A948C]">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Progress bar */}
        <div
          className="flex-1 h-1 rounded-full bg-[#E4E7DF] cursor-pointer relative overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#1B4332] rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Speed toggle */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="px-2 py-1 rounded text-[11px] font-mono bg-[#F1F3EE] text-[#5C6B62] hover:text-[#1E2B24] border border-[#E4E7DF] transition-colors"
          >
            {speed}x
          </button>
          {showSpeedMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSpeedMenu(false)} />
              <div className="absolute bottom-full mb-1 right-0 bg-[#FFFFFF] border border-[#E4E7DF] rounded-lg overflow-hidden z-20">
                {[0.5, 1, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={cn(
                      "block w-full px-4 py-1.5 text-[12px] font-mono text-left hover:bg-[#F1F3EE] transition-colors",
                      speed === s ? "text-[#1B4332]" : "text-[#5C6B62]"
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Volume icon */}
        <Volume2 className="w-4 h-4 text-[#5C6B62] shrink-0" />
      </div>

      {!url && (
        <p className="text-[11px] text-[#5C6B62] text-center mt-2">
          No recording available
        </p>
      )}
    </div>
  );
}
