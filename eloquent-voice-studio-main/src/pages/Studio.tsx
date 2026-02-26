import { useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { Header } from "@/components/Header";
import { VoiceSelector } from "@/components/VoiceSelector";
import { TextInput } from "@/components/TextInput";
import { EmotionSelector } from "@/components/EmotionSelector";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AdvancedSettings } from "@/components/AdvancedSettings";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MIN_CHARACTERS = 500;

const Index = () => {
  const [selectedVoice, setSelectedVoice] = useState("1");
  const [text, setText] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  
  const [advancedSettings, setAdvancedSettings] = useState({
    sentencePause: 0,
    speechSpeed: 1,
    iterativeLength: 150,
    maxTokens: 0,
    topP: 0.8,
    temperature: 0.8,
    repetitionPenalty: 1.1,
    seed: 0,
    useMemoryCache: true,
  });

  const isTextValid = text.trim().length >= MIN_CHARACTERS;

  const handleGenerate = async () => {
    if (!isTextValid) {
      toast({
        title: "Chưa đủ ký tự",
        description: `Cần tối thiểu ${MIN_CHARACTERS} ký tự để bắt đầu tạo.`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    // Simulate generation - replace with your actual API call
    setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "Tạo giọng nói thành công",
        description: "Audio của bạn đã sẵn sàng!",
      });
      // Here you would set the actual audio URL from your TTS API
    }, 3000);
  };

  const handleAddVoice = () => {
    toast({
      title: "Clone giọng nói (Beta)",
      description: "Tải lên mẫu âm thanh 10-30 giây để clone giọng nói.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Voice Selection */}
          <section className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Giọng đọc</label>
            <VoiceSelector
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              onAddVoice={handleAddVoice}
            />
          </section>

          {/* Reference Audio Upload */}
          <section>
            <button className="w-full p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group">
              <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                <Upload className="w-8 h-8" />
                <span className="text-sm font-medium">Tải lên mẫu âm thanh (10-30s)</span>
                <span className="text-xs">Clone giọng nói tốt nhất với file 10-30 giây</span>
              </div>
            </button>
          </section>

          {/* Text Input */}
          <section className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Văn bản</label>
            <TextInput value={text} onChange={setText} minLength={MIN_CHARACTERS} />
          </section>

          {/* Emotion Selector */}
          <section className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Phong cách cảm xúc</label>
            <EmotionSelector
              selectedEmotion={selectedEmotion}
              onEmotionChange={setSelectedEmotion}
            />
          </section>

          {/* Generate Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isTextValid}
                    className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg glow-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                        Đang tạo...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Tạo giọng nói ngay
                      </>
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              {!isTextValid && text.length > 0 && (
                <TooltipContent>
                  <p>Cần tối thiểu {MIN_CHARACTERS} ký tự để bắt đầu tạo.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Audio Player */}
          <AudioPlayer audioUrl={audioUrl} isGenerating={isGenerating} />

          {/* Advanced Settings */}
          <AdvancedSettings
            settings={advancedSettings}
            onSettingsChange={setAdvancedSettings}
          />

          {/* Footer Note */}
          <p className="text-xs text-center text-muted-foreground pt-4">
            Vui lòng tuân thủ pháp luật địa phương khi sử dụng công nghệ clone giọng nói.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
