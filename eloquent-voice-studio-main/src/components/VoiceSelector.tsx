import { Volume2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Voice {
  id: string;
  name: string;
  description: string;
  accent: string;
}

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
}

export function VoiceSelector({ voices, selectedVoice, onVoiceChange }: VoiceSelectorProps) {
  // Group voices by accent
  const groupedVoices = voices.reduce((acc, voice) => {
    if (!acc[voice.accent]) acc[voice.accent] = [];
    acc[voice.accent].push(voice);
    return acc;
  }, {} as Record<string, Voice[]>);

  const selectedVoiceData = voices.find(v => v.id === selectedVoice);

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 shrink-0">
        <Volume2 className="w-4 h-4 text-primary" />
      </div>

      <div className="flex-1">
        <Select value={selectedVoice} onValueChange={onVoiceChange}>
          <SelectTrigger className="w-full h-12 bg-card border-border hover:bg-secondary/50 transition-colors text-lg">
            <SelectValue>
              <span className="font-semibold">{selectedVoiceData?.name || "Select a voice"}</span>
              <span className="ml-2 text-muted-foreground text-sm font-normal">
                {selectedVoiceData?.description}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {Object.entries(groupedVoices).map(([accent, accentVoices]) => (
              <SelectGroup key={accent}>
                <SelectLabel className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-muted-foreground py-2 sticky top-0">
                  {accent} Voices
                </SelectLabel>
                {accentVoices.map((voice) => (
                  <SelectItem
                    key={voice.id}
                    value={voice.id}
                    className="cursor-pointer py-3"
                  >
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-medium text-base">{voice.name}</span>
                      <span className="text-xs text-muted-foreground">{voice.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
