import { Play, Pause, SkipBack, SkipForward, Volume2, Download, Share2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audioUrl?: string;
  isGenerating?: boolean;
}

export function AudioPlayer({ audioUrl, isGenerating }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
    if (audioRef.current) {
      audioRef.current.playbackRate = rates[nextIndex];
    }
  };

  // Generate waveform bars
  const waveformBars = Array.from({ length: 60 }, (_, i) => {
    const height = Math.random() * 100;
    const isActive = duration > 0 && (i / 60) * duration <= currentTime;
    return { height, isActive };
  });

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Waveform Visualization */}
      <div className="relative h-20 flex items-center justify-center gap-[2px] px-4">
        {isGenerating ? (
          <div className="flex items-center gap-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full waveform-bar"
                style={{
                  height: `${20 + Math.random() * 40}px`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>
        ) : (
          waveformBars.map((bar, i) => (
            <div
              key={i}
              className={cn(
                "w-1 rounded-full transition-all duration-150",
                bar.isActive ? "bg-primary" : "bg-muted"
              )}
              style={{ height: `${Math.max(8, bar.height * 0.6)}px` }}
            />
          ))
        )}
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-sm text-muted-foreground px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Progress Slider */}
      <Slider
        value={[currentTime]}
        max={duration || 100}
        step={0.1}
        onValueChange={handleSeek}
        className="cursor-pointer"
      />

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Volume2 className="w-5 h-5" />
          </Button>
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={(v) => setVolume(v[0])}
            className="w-24"
          />
          <button
            onClick={cyclePlaybackRate}
            className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary rounded"
          >
            {playbackRate}x
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button
            onClick={togglePlay}
            size="icon"
            className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg glow-primary"
            disabled={!audioUrl && !isGenerating}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Download className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
