import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles, CloudRain, Smile, Frown, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const emotions = [
    { id: "excited", label: "Excited", icon: Sparkles },
    { id: "whisper", label: "Whisper", icon: CloudRain },
    { id: "sad", label: "Sad", icon: Frown },
    { id: "laugh", label: "Laugh", icon: Smile },
    { id: "serious", label: "Serious", icon: ShieldAlert },
];

interface EmotionSelectorProps {
    selectedEmotion: string | null;
    onEmotionChange: (emotion: string | null) => void;
}

export function EmotionSelector({ selectedEmotion, onEmotionChange }: EmotionSelectorProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {emotions.map((emotion) => {
                const Icon = emotion.icon;
                const isSelected = selectedEmotion === emotion.id;

                return (
                    <Tooltip key={emotion.id}>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => onEmotionChange(isSelected ? null : emotion.id)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border",
                                    isSelected
                                        ? "bg-primary/20 text-primary border-primary/30"
                                        : "bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                <Icon className={cn("w-3.5 h-3.5", isSelected && "text-primary")} />
                                {emotion.label}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Apply {emotion.label} tone</p>
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
}
