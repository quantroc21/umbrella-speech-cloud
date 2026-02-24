import { useState, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Scissors, Wand2, Play, Pause, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";

interface SilenceCutterProps {
    audioUrl: string | undefined;
    onAudioProcessed?: (newUrl: string) => void;
}

export function SilenceCutter({ audioUrl, onAudioProcessed }: SilenceCutterProps) {
    const [enabled, setEnabled] = useState(true);
    const [threshold, setThreshold] = useState([-40]);
    const [minDuration, setMinDuration] = useState([0.3]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cleanedAudioUrl, setCleanedAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
    const lastProcessedRef = useRef<string | null>(null);

    // Auto-process when audioUrl changes (but NOT for blob: URLs we created)
    useEffect(() => {
        if (
            enabled &&
            audioUrl &&
            !audioUrl.startsWith('data:') &&
            !audioUrl.startsWith('blob:') &&
            audioUrl !== lastProcessedRef.current
        ) {
            handleCutSilence();
        } else if (!audioUrl) {
            setCleanedAudioUrl(null);
            lastProcessedRef.current = null;
        }
    }, [audioUrl]);

    const handleCutSilence = async () => {
        if (!audioUrl) return;

        setIsProcessing(true);
        setCleanedAudioUrl(null);

        try {
            // 1. Get auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            // 2. Convert audioUrl to Blob (Handles data URLs and remote URLs)
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

            // 3. Prepare FormData with File
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.wav");
            formData.append("threshold", threshold[0].toString());
            formData.append("duration", minDuration[0].toString());

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
                console.log("Silence Cutter: received audio blob", blob.size, "bytes");

                // Mark this URL as processed to prevent re-triggering
                lastProcessedRef.current = audioUrl;
                setCleanedAudioUrl(blobUrl);

                // Do NOT auto-apply here — user clicks "Use Cleaned Audio" to apply
                toast({
                    title: "Silence removed!",
                    description: "Click 'Use Cleaned Audio' to apply the cleaned version.",
                });
            } else {
                // Backend returned JSON (e.g. no silence found, or error)
                const result = await response.json();
                console.log("Silence Cutter JSON:", result);

                if (result.error) {
                    throw new Error(result.error);
                }

                lastProcessedRef.current = audioUrl;
                if (result.warning || result.message) {
                    toast({
                        title: "Silence Cutter Info",
                        description: result.warning || result.message,
                    });
                }
            }

        } catch (error: any) {
            console.error("Silence Cutter Error:", error);
            toast({
                title: "Silence removal failed",
                description: error.message || "Using original file as fallback.",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const togglePlay = () => {
        if (!cleanedAudioUrl) return;

        if (isPlaying && audioElement) {
            audioElement.pause();
            setIsPlaying(false);
        } else {
            if (!audioElement || audioElement.src !== cleanedAudioUrl) {
                const audio = new Audio(cleanedAudioUrl);
                audio.onended = () => setIsPlaying(false);
                setAudioElement(audio);
                audio.play();
                setIsPlaying(true);
            } else {
                audioElement.play();
                setIsPlaying(true);
            }
        }
    };

    const handleUseCleaned = () => {
        if (cleanedAudioUrl && onAudioProcessed) {
            onAudioProcessed(cleanedAudioUrl);
            toast({
                title: "Audio Updated",
                description: "Replaced original with silence-removed version.",
            });
        }
    };

    if (!audioUrl) return null;

    return (
        <Card className="mt-4 p-4 border-border bg-card/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">Silence Cutter</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="auto-cut"
                        checked={enabled}
                        onCheckedChange={(c) => setEnabled(!!c)}
                        className="border-primary data-[state=checked]:bg-primary"
                    />
                    <Label htmlFor="auto-cut" className="text-xs font-medium cursor-pointer text-muted-foreground">Enable auto silence removal</Label>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label className="text-xs font-medium text-muted-foreground">Silence threshold</Label>
                            <span className="text-xs font-mono text-primary">{threshold[0]} dB</span>
                        </div>
                        <Slider
                            value={threshold}
                            min={-60}
                            max={-20}
                            step={1}
                            onValueChange={setThreshold}
                            className="py-1"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label className="text-xs font-medium text-muted-foreground">Min silence duration</Label>
                            <span className="text-xs font-mono text-primary">{minDuration[0]}s</span>
                        </div>
                        <Slider
                            value={minDuration}
                            min={0.1}
                            max={1.0}
                            step={0.1}
                            onValueChange={setMinDuration}
                            className="py-1"
                        />
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCutSilence}
                    disabled={isProcessing}
                    className="w-full border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-primary"
                >
                    {isProcessing ? (
                        <><Loader2 className="w-3 h-3 animate-spin mr-2" /> Processing...</>
                    ) : (
                        <><Wand2 className="w-3 h-3 mr-2" /> Apply Silence Cutter</>
                    )}
                </Button>

                {cleanedAudioUrl && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-3">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full bg-primary/20 hover:bg-primary/30 text-primary"
                                onClick={togglePlay}
                            >
                                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                            </Button>
                            <span className="text-xs font-semibold text-foreground">Preview Cleaned</span>
                        </div>
                        <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs font-semibold px-4 shadow-sm"
                            onClick={handleUseCleaned}
                        >
                            <RefreshCw className="w-3 h-3 mr-2" />
                            Use Cleaned Audio
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );
}
