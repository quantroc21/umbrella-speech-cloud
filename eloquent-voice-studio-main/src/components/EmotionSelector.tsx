import { cn } from "@/lib/utils";
import { Sparkles, Wind, Frown, Laugh, Briefcase } from "lucide-react";

interface Emotion {
  id: string;
  label: string;
  icon: React.ReactNode;
  tag: string;
}

const emotions: Emotion[] = [
  { id: "excited", label: "Excited", icon: <Sparkles className="w-4 h-4" />, tag: "[excited]" },
  { id: "whisper", label: "Whisper", icon: <Wind className="w-4 h-4" />, tag: "[whispering]" },
  { id: "sad", label: "Sad", icon: <Frown className="w-4 h-4" />, tag: "[sad]" },
  { id: "laugh", label: "Laugh", icon: <Laugh className="w-4 h-4" />, tag: "[laughing]" },
  { id: "serious", label: "Serious", icon: <Briefcase className="w-4 h-4" />, tag: "[serious]" },
];

interface EmotionSelectorProps {
  selectedEmotion: string | null;
  onEmotionChange: (emotionId: string | null) => void;
}

export function EmotionSelector({ selectedEmotion, onEmotionChange }: EmotionSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {emotions.map((emotion) => (
        <button
          key={emotion.id}
          onClick={() => onEmotionChange(selectedEmotion === emotion.id ? null : emotion.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
            selectedEmotion === emotion.id
              ? "bg-primary text-primary-foreground shadow-lg glow-primary"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {emotion.icon}
          {emotion.label}
        </button>
      ))}
    </div>
  );
}
