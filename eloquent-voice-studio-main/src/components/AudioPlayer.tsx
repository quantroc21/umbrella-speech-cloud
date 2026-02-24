import { Play, Pause, SkipBack, SkipForward, Volume2, Download, Share2, Scissors, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Client } from "@gradio/client";

interface AudioPlayerProps {
  audioUrl?: string;
  isGenerating?: boolean;
  onAudioProcessed?: (url: string) => void;
}

export function AudioPlayer({ audioUrl, isGenerating, onAudioProcessed }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const handleDownload = async () => {
    if (!audioUrl) return;

    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `elephantfat-voice-${Date.now()}.wav`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = `elephantfat-voice-${Date.now()}.wav`;
      link.click();
    }
  };

  const handleShare = async () => {
    if (!audioUrl) return;
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const file = new File([blob], "voice-gen.wav", { type: "audio/wav" });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'ElephantFat AI Voice',
          text: 'Check out this AI voice generation from ElephantFat',
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const handleRemoveSilence = async () => {
    if (!audioUrl || !onAudioProcessed) return;

    setIsProcessing(true);
    toast({
      title: "Removing Silence...",
      description: "Processing audio with ElephantFat AI.",
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Convert audioUrl to Blob
      let audioBlob: Blob;
      if (audioUrl.startsWith('data:')) {
        const parts = audioUrl.split(',');
        const byteString = atob(parts[1]);
        const mimeString = parts[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        audioBlob = new Blob([ab], { type: mimeString });
      } else {
        const response = await fetch(audioUrl);
        audioBlob = await response.blob();
      }

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.wav");
      formData.append("threshold", "-35");
      formData.append("duration", "0.3");

      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/audio/cut-silence'
        : '/api/audio/cut-silence';

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        // Handle error: might be JSON or plain text
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errData.detail || errorMsg;
        } catch {
          const text = await response.text();
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("audio/")) {
        // Backend returned the processed audio file directly
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        onAudioProcessed(blobUrl);
        toast({
          title: "Success!",
          description: "Silence removed successfully.",
        });
      } else {
        // Backend returned JSON (e.g. no silence found)
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        toast({
          title: "Info",
          description: result.warning || result.message || "No significant silence found.",
        });
      }

    } catch (error: any) {
      console.error("Silence removal failed:", error);
      toast({
        title: "Warning",
        description: error.message || "Silence removal failed, using original file.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

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

      <div className="flex justify-between text-sm text-muted-foreground px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <Slider
        value={[currentTime]}
        max={duration || 100}
        step={0.1}
        onValueChange={handleSeek}
        className="cursor-pointer"
      />

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
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleRemoveSilence}
            title="Remove Silence"
            disabled={!audioUrl || isProcessing}
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scissors className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleDownload}
            disabled={!audioUrl}
          >
            <Download className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleShare}
            disabled={!audioUrl}
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
