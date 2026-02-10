import { ChevronDown, Plus, Volume2 } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Voice {
  id: string;
  name: string;
  description: string;
}

const defaultVoices: Voice[] = [
  { id: "1", name: "Sarah", description: "Warm, conversational" },
  { id: "2", name: "Marcus", description: "Deep, authoritative" },
  { id: "3", name: "Emma", description: "Bright, energetic" },
  { id: "4", name: "James", description: "Calm, professional" },
];

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  onAddVoice: () => void;
}

export function VoiceSelector({ selectedVoice, onVoiceChange, onAddVoice }: VoiceSelectorProps) {
  const selectedVoiceData = defaultVoices.find(v => v.id === selectedVoice);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10">
        <Volume2 className="w-4 h-4 text-primary" />
      </div>
      
      <Select value={selectedVoice} onValueChange={onVoiceChange}>
        <SelectTrigger className="w-[200px] bg-card border-border hover:bg-secondary/50 transition-colors">
          <SelectValue>
            <div className="flex flex-col items-start">
              <span className="font-medium">{selectedVoiceData?.name}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {defaultVoices.map((voice) => (
            <SelectItem 
              key={voice.id} 
              value={voice.id}
              className="cursor-pointer hover:bg-secondary/50"
            >
              <div className="flex flex-col">
                <span className="font-medium">{voice.name}</span>
                <span className="text-xs text-muted-foreground">{voice.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button 
        variant="outline" 
        size="sm"
        onClick={onAddVoice}
        className="gap-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
      >
        <Plus className="w-4 h-4" />
        Add Voice
      </Button>
    </div>
  );
}
