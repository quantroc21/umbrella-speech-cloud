import { useState, useEffect } from "react";
import { Sparkles, Upload } from "lucide-react";
import { Header } from "@/components/Header";
import Navigation from "@/components/Navigation";
import { VoiceSelector } from "@/components/VoiceSelector";
import { TextInput } from "@/components/TextInput";
import { EmotionSelector } from "@/components/EmotionSelector";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AdvancedSettings } from "@/components/AdvancedSettings";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AddVoiceDialog } from "@/components/AddVoiceDialog";

const API_BASE = window.location.origin;

// v8 Module 3: Threshold Constant
const MIN_CHAR_THRESHOLD = 0;
// Set to false to force RunPod Cloud testing even on localhost
const IS_LOCAL = false;

const StudioPage = () => {
  const PRESET_VOICES = [
    { id: "Donal Trump", name: "Donald Trump", description: "Preset Voice" },
    { id: "Brian", name: "Brian", description: "Preset Voice" },
    { id: "Mark", name: "Mark", description: "Preset Voice" },
    { id: "Adame", name: "Adam", description: "Preset Voice" },
    { id: "andreas", name: "Andreas", description: "Preset Voice" },
    { id: "trump", name: "Trump (Alt)", description: "Preset Voice" },
  ];

  const [voices, setVoices] = useState<{ id: string, name: string, description: string }[]>(PRESET_VOICES);
  const [selectedVoice, setSelectedVoice] = useState("Donal Trump");
  const [text, setText] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [isAddVoiceOpen, setIsAddVoiceOpen] = useState(false);

  const [advancedSettings, setAdvancedSettings] = useState({
    sentencePause: 0,
    speechSpeed: 1,
    iterativeLength: 200,
    maxTokens: 768,
    topP: 0.8,
    temperature: 0.8,
    repetitionPenalty: 1.1,
    seed: 0,
    useMemoryCache: false,
  });



  const fetchVoices = async () => {
    try {
      const RUNPOD_API_KEY = import.meta.env.VITE_RUNPOD_API_KEY;
      console.log("Fetching cloud voices...");

      const response = await fetch(`${API_BASE}/api/runsync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RUNPOD_API_KEY}`
        },
        body: JSON.stringify({
          input: { task: "list_voices" }
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch cloud voices");

      const data = await response.json();
      // RunSync returns: { status: "COMPLETED", output: [ {id, name, ...}, ... ] }
      const cloudVoices = (data.output || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        description: "Cloud Voice"
      }));

      if (cloudVoices.length > 0) {
        setVoices(prev => {
          const combined = [...PRESET_VOICES];
          cloudVoices.forEach((cv: any) => {
            if (!combined.find(p => p.id === cv.id)) combined.push(cv);
          });
          return combined;
        });
      }
    } catch (err) {
      console.warn("Could not load cloud voices:", err);
      setVoices(PRESET_VOICES);
    }
  };

  useEffect(() => {
    fetchVoices();
  }, []);

  const handleGenerate = async () => {
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
        description: `Production requirement: Minimum ${MIN_CHAR_THRESHOLD} characters. (Current: ${text.length})`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const finalText = selectedEmotion ? `[${selectedEmotion}] ${text}` : text;
      const isStandardAPI = IS_LOCAL;

      if (isStandardAPI) {
        console.log("Using Standard API...");
        const response = await fetch(`${API_BASE}/v1/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: finalText,
            reference_id: selectedVoice,
            chunk_length: advancedSettings.iterativeLength,
            format: "wav",
            max_new_tokens: advancedSettings.maxTokens || 768,
            top_p: advancedSettings.topP,
            repetition_penalty: advancedSettings.repetitionPenalty,
            temperature: advancedSettings.temperature,
            seed: advancedSettings.seed || null,
            use_memory_cache: advancedSettings.useMemoryCache ? "on" : "off",
            streaming: false
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Generation failed: ${response.status} ${errText}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } else {
        const RUNPOD_API_KEY = import.meta.env.VITE_RUNPOD_API_KEY;
        console.log("Starting RunPod Cloud Generation (Async v14.0)...");

        const runResponse = await fetch(`${API_BASE}/api/serverless`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RUNPOD_API_KEY}`
          },
          body: JSON.stringify({
            input: {
              task: "tts",
              text: finalText,
              reference_id: selectedVoice,
              chunk_length: advancedSettings.iterativeLength,
              format: "wav",
              max_new_tokens: advancedSettings.maxTokens || 1024,
              top_p: advancedSettings.topP,
              repetition_penalty: advancedSettings.repetitionPenalty,
              temperature: advancedSettings.temperature,
              seed: advancedSettings.seed || null,
            }
          }),
        });

        if (!runResponse.ok) {
          const errText = await runResponse.text();
          throw new Error(`RunPod trigger failed: ${runResponse.status} ${errText}`);
        }

        const runData = await runResponse.json();
        const jobId = runData.id;
        console.log(`Job Created: ${jobId}. Polling...`);

        let completed = false;
        let finalOutput = null;
        let attempts = 0;
        const maxAttempts = 60; // 5 mins

        while (!completed && attempts < maxAttempts) {
          const statusRes = await fetch(`${API_BASE}/api/status/${jobId}`, {
            headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
          });

          if (!statusRes.ok) throw new Error(`Status check failed: ${statusRes.status}`);

          const statusData = await statusRes.json();
          console.log(`Job Status: ${statusData.status}`);

          if (statusData.status === "COMPLETED") {
            finalOutput = statusData.output;
            completed = true;
          } else if (statusData.status === "FAILED") {
            throw new Error(`Inference failed on worker: ${statusData.error}`);
          } else {
            await new Promise(r => setTimeout(r, 5000));
          }
          attempts++;
        }

        if (!completed) throw new Error("Generation timed out");

        if (finalOutput && finalOutput.audio_base64) {
          const binaryString = window.atob(finalOutput.audio_base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
          const blob = new Blob([bytes.buffer], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);

          toast({
            title: "Speech Generated",
            description: "Your audio is ready! (Cloud v14.0)",
          });
          return;
        } else {
          throw new Error("No audio data in response");
        }
      }

      toast({
        title: "Speech Generated",
        description: "Your audio is ready!",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Generation Error",
        description: error instanceof Error ? error.message : "Failed to generate speech",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddVoice = () => {
    setIsAddVoiceOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Voice Selection */}
          <section className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Voice</label>
            <VoiceSelector
              voices={voices}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              onAddVoice={handleAddVoice}
            />
          </section>

          {/* Reference Audio Upload */}
          <section>
            <button
              onClick={handleAddVoice}
              className="w-full p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                <Upload className="w-8 h-8" />
                <span className="text-sm font-medium">Upload Reference Audio</span>
                <span className="text-xs">10-30 seconds for best voice cloning results</span>
              </div>
            </button>
          </section>

          {/* Text Input */}
          <section className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Text</label>
            <TextInput value={text} onChange={setText} />
          </section>

          {/* Emotion Selector */}
          <section className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Emotion Style</label>
            <EmotionSelector
              selectedEmotion={selectedEmotion}
              onEmotionChange={setSelectedEmotion}
            />
          </section>

          {/* v8 Module 3: Character Counter */}
          <div className="flex justify-between items-center text-xs text-muted-foreground pb-1">
            <span>{Math.max(0, MIN_CHAR_THRESHOLD - text.length)} characters remaining to unlock</span>
            <span className={text.length < MIN_CHAR_THRESHOLD ? "text-destructive font-bold" : "text-green-500 font-bold"}>
              {text.length} / {MIN_CHAR_THRESHOLD}
            </span>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || text.length < MIN_CHAR_THRESHOLD}
            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg glow-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Speech
              </>
            )}
          </Button>

          {/* Audio Player */}
          <AudioPlayer audioUrl={audioUrl} isGenerating={isGenerating} />

          {/* Advanced Settings */}
          <AdvancedSettings
            settings={advancedSettings}
            onSettingsChange={setAdvancedSettings}
          />

          {/* Footer Note */}
          <p className="text-xs text-center text-muted-foreground pt-4">
            Please consider your local laws and regulations before using voice cloning technology.
          </p>
        </div>
      </main>

      <AddVoiceDialog
        open={isAddVoiceOpen}
        onOpenChange={setIsAddVoiceOpen}
        onSuccess={fetchVoices}
        apiBase={API_BASE}
      />
    </div>
  );
};

export default StudioPage;
