import { useState, useEffect } from "react";
import { Sparkles, Upload, Loader2, AlertCircle, Volume2, Play, Pause, Plus, Coins } from "lucide-react";
import Navigation from "@/components/Navigation";
import { TextInput } from "@/components/TextInput";
import { EmotionSelector } from "@/components/EmotionSelector";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AdvancedSettings } from "@/components/AdvancedSettings";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AddVoiceDialog } from "@/components/AddVoiceDialog";
import { supabase } from "@/lib/supabase";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const API_BASE = window.location.origin;

// v15.1: Production Threshold
const MIN_CHAR_THRESHOLD = 0;

const StudioPage = () => {
  // Enhanced Preset Voices to match v3 UI requirements and R2 Library
  const PRESET_VOICES = [
    { id: "Adame", name: "Adame", description: "Deep, Narrator", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/adame.mp3" },
    { id: "Addison 2.0", name: "Addison", description: "Engaging, Storyteller", accent: "American", flag: "🇺🇸", gender: "Female", audioUrl: "/voices/addison.mp3" },
    { id: "Arabella", name: "Arabella", description: "Soft, Elegant", accent: "British", flag: "🇬🇧", gender: "Female", audioUrl: "/voices/arabella.mp3" },
    { id: "Brian", name: "Brian", description: "Standard Text-to-Speech", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/brian.mp3" },
    { id: "Brittney", name: "Brittney", description: "Youthful, Energetic", accent: "American", flag: "🇺🇸", gender: "Female", audioUrl: "/voices/brittney.mp3" },
    { id: "Clyde", name: "Clyde", description: "Distinctive Voice", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/clyde.mp3" },
    { id: "Donal Trump", name: "Donald Trump", description: "Deep, Authoritative", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/trump.mp3" },
    { id: "Dr. von", name: "Dr. Von", description: "Scientific, Precise", accent: "German/US", flag: "🇩🇪", gender: "Male", audioUrl: "/voices/dr_von.mp3" },
    { id: "Eline", name: "Eline", description: "Warm, Friendly", accent: "European", flag: "🇪🇺", gender: "Female", audioUrl: "/voices/eline.mp3" },
    { id: "Grimblewood thornwhisker", name: "Grimblewood", description: "Fantasy, Narrator", accent: "British", flag: "🇬🇧", gender: "Male", audioUrl: "/voices/grimblewood.mp3" },
    { id: "Heather rey", name: "Heather", description: "Professional, Clear", accent: "American", flag: "🇺🇸", gender: "Female", audioUrl: "/voices/heather.mp3" },
    { id: "Hope", name: "Hope", description: "Optimistic, Bright", accent: "American", flag: "🇺🇸", gender: "Female", audioUrl: "/voices/hope.mp3" },
    { id: "Jane", name: "Jane", description: "Calm, Soothing", accent: "American", flag: "🇺🇸", gender: "Female", audioUrl: "/voices/jane.mp3" },
    { id: "Jessica", name: "Jessica", description: "Soft, Clear", accent: "American", flag: "🇺🇸", gender: "Female", audioUrl: "/voices/jessica.mp3" },
    { id: "Mark 2.0", name: "Mark 2.0", description: "Enhanced Clarity", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/mark.mp3" },
    { id: "Mark", name: "Mark", description: "High quality speech", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/mark.mp3" },
    { id: "Peter Griffin", name: "Peter Griffin", description: "Animated, Funny", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/peter_griffin.mp3" },
    { id: "Pro narrator", name: "Pro Narrator", description: "Broadcast Quality", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/pro_narrator.mp3" },
    { id: "Smith", name: "Smith", description: "Mature, Trustworthy", accent: "American", flag: "🇺🇸", gender: "Male", audioUrl: "/voices/smith.mp3" },
  ];

  const [voices, setVoices] = useState(PRESET_VOICES);
  const [selectedVoice, setSelectedVoice] = useState("Adame");
  const [text, setText] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [isAddVoiceOpen, setIsAddVoiceOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Audio Preview State
  const [playingVoicePreview, setPlayingVoicePreview] = useState<string | null>(null);
  const [currentPreviewAudio, setCurrentPreviewAudio] = useState<HTMLAudioElement | null>(null);

  const [advancedSettings, setAdvancedSettings] = useState({
    sentencePause: 0,
    speechSpeed: 1,
    iterativeLength: 200,
    maxTokens: 768,
    topP: 0.7,
    temperature: 0.7,
    repetitionPenalty: 1.2,
    seed: 0,
    useMemoryCache: false,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    fetchVoices();
    return () => subscription.unsubscribe();
  }, []);

  const fetchVoices = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      let customVoices: any[] = [];

      if (session) {
        const response = await fetch(`${API_BASE}/api/voices`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          customVoices = data.map((v: any) => ({
            id: v.r2_uuid_path, // Passes full R2 path to backend for inference
            name: v.name,
            description: "Custom Voice Clone",
            accent: "Custom",
            flag: "👤",
            gender: "Custom",
            audioUrl: null // No preview URL for now, logic handles null gracefully
          }));
        }
      }

      setVoices([...PRESET_VOICES, ...customVoices]);

    } catch (error) {
      console.error("Failed to load custom voices:", error);
      setVoices(PRESET_VOICES);
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to generate audio.",
        variant: "destructive",
      });
      return;
    }

    if (!text.trim()) {
      toast({
        title: "No text entered",
        description: "Please enter some text to generate speech.",
        variant: "destructive",
      });
      return;
    }

    if (text.length < MIN_CHAR_THRESHOLD) {
      toast({
        title: "Text Too Short",
        description: `Minimum ${MIN_CHAR_THRESHOLD} characters required.`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setAudioUrl(undefined);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired. Please sign in again.");

      const payload = {
        text: selectedEmotion ? `[${selectedEmotion}] ${text}` : text,
        voice_id: selectedVoice,
        top_p: advancedSettings.topP,
        repetition_penalty: advancedSettings.repetitionPenalty,
        temperature: advancedSettings.temperature
      };

      const response = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 402) {
        throw new Error("Insufficient Credits. Please top up your account.");
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Generation failed");
      }

      const initialJob = await response.json();
      let jobId = initialJob.id;

      if (!jobId) {
        throw new Error("Invalid response from server (No Job ID)");
      }

      // POLLING LOOP
      toast({
        title: "Processing",
        description: "Your request is in queue...",
      });

      let status = initialJob.status;
      let finalAudioUrl = null;

      while (status !== "COMPLETED" && status !== "FAILED" && status !== "CANCELLED") {
        await new Promise(r => setTimeout(r, 2000)); // Poll every 2s

        const statusRes = await fetch(`${API_BASE}/api/status/${jobId}`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });

        if (!statusRes.ok) {
          throw new Error("Failed to check job status");
        }

        const jobData = await statusRes.json();
        console.log("Job Update:", jobData);
        status = jobData.status;

        if (status === "COMPLETED") {
          const output = jobData.output;

          if (output?.audio_base64) {
            finalAudioUrl = `data:audio/wav;base64,${output.audio_base64}`;
          } else if (output?.output?.audio_base64) {
            finalAudioUrl = `data:audio/wav;base64,${output.output.audio_base64}`;
          } else {
            finalAudioUrl = output?.audio_url ||
              output?.output?.audio_url ||
              (typeof output === 'string' ? output : null);
          }
        } else if (status === "FAILED") {
          throw new Error(jobData.error || "Generation failed on worker");
        }
      }

      if (finalAudioUrl) {
        setAudioUrl(finalAudioUrl);
        toast({
          title: "Success",
          description: "Your audio is ready!",
        });
      } else {
        throw new Error("Generation completed but no audio URL was returned.");
      }

    } catch (error: any) {
      console.error("Generation Error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddVoice = () => {
    setIsAddVoiceOpen(true);
  };

  const handleVoicePreviewToggle = (voiceId: string) => {
    // 1. Stop processing if clicking the same voice to pause
    if (playingVoicePreview === voiceId) {
      currentPreviewAudio?.pause();
      setPlayingVoicePreview(null);
      return;
    }

    // 2. Stop any currently playing audio
    if (currentPreviewAudio) {
      currentPreviewAudio.pause();
    }

    // 3. Find the new voice and play it
    const voice = voices.find(v => v.id === voiceId);
    if (voice && voice.audioUrl) {
      const audio = new Audio(voice.audioUrl);

      audio.onended = () => {
        setPlayingVoicePreview(null);
      };

      audio.onerror = () => {
        toast({
          title: "Preview Unavailable",
          description: `Audio sample for ${voice.name} is missing.`,
          variant: "destructive",
        });
        setPlayingVoicePreview(null);
      };

      audio.play().catch(err => console.error("Audio playback error:", err));

      setCurrentPreviewAudio(audio);
      setPlayingVoicePreview(voiceId);
    } else {
      toast({
        title: "No Preview",
        description: "This voice does not have a preview sample.",
        variant: "destructive",
      });
    }
  };

  const selectedVoiceData = voices.find(v => v.id === selectedVoice);
  const isTextValid = text.length >= MIN_CHAR_THRESHOLD;

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)]">
          {/* Left Column - Script Input Canvas (70%) */}
          <div className="flex-1 lg:w-[70%] flex flex-col border-r border-border">
            {/* Header with voice info */}
            <div className="p-4 lg:p-5 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {selectedVoiceData?.name} {selectedVoiceData?.flag}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedVoiceData?.gender} · {selectedVoiceData?.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Script Canvas - Flex Column Layout */}
            <div className="flex-1 p-6 flex flex-col overflow-y-auto">
              {!user && (
                <Alert className="mb-6 border-primary/30 bg-primary/5 shrink-0">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertTitle>Sign in to start creating</AlertTitle>
                  <AlertDescription>
                    Authenticated users get 5,000 free credits to explore VoiceCraft Pro.
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col min-h-0">


                {/* 2. Text Input (Expanded Workspace) & Emotion Selector */}
                <div className="flex-1 flex flex-col gap-4 mt-6 min-h-[300px]">
                  <TextInput
                    value={text}
                    onChange={setText}
                    className="flex-1 h-full shadow-sm"
                  />

                  <div className="shrink-0">
                    <EmotionSelector
                      selectedEmotion={selectedEmotion}
                      onEmotionChange={setSelectedEmotion}
                    />
                  </div>
                </div>

                {/* 3. Audio Playback Section (Bottom Floating) */}
                <div className="mt-6 pt-4 pb-2 shrink-0">
                  <AudioPlayer audioUrl={audioUrl} isGenerating={isGenerating} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Voice Library Sidebar (30%) */}
          <div className="flex flex-col lg:w-[30%] bg-card h-full border-t lg:border-t-0">
            {/* Sidebar Header */}
            <div className="p-4 lg:p-5 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-foreground">Premium Voice Library</h2>
                <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary hover:bg-primary/10" onClick={handleAddVoice}>
                  <Plus className="w-4 h-4" />
                  Add Voice
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                High-quality voices ready for any project.
              </p>
            </div>

            {/* Voice Grid - Top 50% */}
            <ScrollArea className="h-1/2 border-b border-border">
              <div className="p-6">
                <div className="grid grid-cols-1 gap-3">
                  {voices.map((voice) => (
                    <div
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-200 ${selectedVoice === voice.id
                        ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                        : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{voice.flag}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">{voice.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${selectedVoice === voice.id
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                                }`}>
                                {voice.accent}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {voice.gender} · {voice.description}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVoicePreviewToggle(voice.id);
                          }}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${playingVoicePreview === voice.id
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                            : "bg-secondary text-muted-foreground hover:bg-primary/20 hover:text-primary"
                            }`}
                        >
                          {playingVoicePreview === voice.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>

            {/* Advanced Settings - Bottom 50% */}
            <div className="h-1/2 flex flex-col bg-secondary/10">
              <div className="p-4 border-b border-border bg-card">
                <h3 className="font-semibold text-sm text-foreground">Advanced Settings</h3>
              </div>
              <ScrollArea className="flex-1 p-6">
                <AdvancedSettings
                  settings={advancedSettings}
                  onSettingsChange={setAdvancedSettings}
                />
              </ScrollArea>
            </div>

            {/* Generate Button & Footer */}
            <div className="p-4 lg:p-5 border-t border-border space-y-4">
              {/* Generate Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button
                      size="lg"
                      className="w-full py-6 text-lg font-semibold glow-primary"
                      disabled={!isTextValid || isGenerating || !user}
                      onClick={handleGenerate}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" />
                          Generate Audio
                        </>
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!isTextValid && (
                  <TooltipContent>
                    <p>Enter text to generate audio.</p>
                  </TooltipContent>
                )}
              </Tooltip>

              {/* Footer */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>🐘</span>
                <span>Powered by VoiceCraft Pro</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddVoiceDialog
        open={isAddVoiceOpen}
        onOpenChange={setIsAddVoiceOpen}
        onSuccess={fetchVoices}
        apiBase={API_BASE}
      />
    </>
  );
};

export default StudioPage;
