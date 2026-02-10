import { Button } from "@/components/ui/button";
import { Play, Pause, User } from "lucide-react";

interface Voice {
    id: string;
    name: string;
    description: string;
}

interface VoiceCardProps {
    voice: Voice;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onPreview?: (id: string) => void;
    isPlaying?: boolean;
}

export const VoiceCard = ({ voice, isSelected, onSelect, onPreview, isPlaying }: VoiceCardProps) => {
    return (
        <div
            onClick={() => onSelect(voice.id)}
            className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:bg-white/5 ${isSelected
                    ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]"
                    : "bg-card/30 border-white/5 hover:border-white/20"
                }`}
        >
            <div className="flex items-center gap-4">
                {/* Avatar Placeholder */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isSelected ? "bg-indigo-500 text-white" : "bg-secondary text-muted-foreground"
                    }`}>
                    <User className="w-6 h-6" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm truncate ${isSelected ? "text-indigo-400" : "text-foreground"}`}>
                        {voice.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                        {voice.description}
                    </p>
                </div>

                {/* Play Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? "text-indigo-400 hover:text-indigo-300" : "text-muted-foreground"
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onPreview?.(voice.id);
                    }}
                >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
            </div>

            {/* Active Indicator */}
            {isSelected && (
                <div className="absolute right-4 top-4 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]" />
            )}
        </div>
    );
};
