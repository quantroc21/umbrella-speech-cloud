import { useState, useEffect } from "react";
import { Sparkles, Upload } from "lucide-react";
import { Header } from "@/components/Header";
import { VoiceSelector } from "@/components/VoiceSelector";
import { TextInput } from "@/components/TextInput";
import { EmotionSelector } from "@/components/EmotionSelector";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AdvancedSettings } from "@/components/AdvancedSettings";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AddVoiceDialog } from "@/components/AddVoiceDialog";

const API_BASE = window.location.origin;

const Index = () => {
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



  const fetchVoices = () => {
    fetch(`${API_BASE}/v1/references/list`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.reference_ids) {
          const loadedVoices = data.reference_ids.map((id: string) => ({
            id,
            name: id,
            description: "Saved Voice"
          }));

          // Combine presets with loaded voices, avoiding duplicates
          setVoices(prev => {
            const combined = [...PRESET_VOICES];
            loadedVoices.forEach((v: any) => {
              if (!combined.find(p => p.id === v.id)) {
                combined.push(v);
              }
            });
            return combined;
          });
        }
      })
      .catch(err => {
        console.warn("Local backend unreachable, using presets only:", err);
      });
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

    setIsGenerating(true);

    try {
      // Append emotion tag if selected
      const finalText = selectedEmotion ? `[${selectedEmotion}] ${text}` : text;

      // Serverless (RunPod) Request Structure - REMOVED KEY FOR GITHUB PUSH PROTECTION
      // TODO: Move this to a secure .env file or User Settings UI
      const key = "";

      const response = await fetch(`${API_BASE}/api/serverless`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          input: {
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
            pause_amount: advancedSettings.sentencePause,
            speed: advancedSettings.speechSpeed,
          }
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();

      // RunPod returns { status: "COMPLETED", output: { audio_base64: "...", ... } }
      if (data.status === "COMPLETED" && data.output && data.output.audio_base64) {
        const binaryString = window.atob(data.output.audio_base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes.buffer], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } else {
        console.error("RunPod Error:", data);
        throw new Error("Invalid response from serverless endpoint (Check console)");
      }

      toast({
        title: "Speech Generated",
        description: "Your audio is ready to play! (Serverless)",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Generation Error",
        description: "Failed to generate speech. Check console for details.",
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
      <Header />

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

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg glow-primary transition-all"
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

export default Index;
