import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface Settings {
    iterativeLength: number;
    maxTokens: number;
    topP: number;
    temperature: number;
    repetitionPenalty: number;
    seed: number;
    useMemoryCache: boolean;
}

interface AdvancedSettingsProps {
    settings: Settings;
    onSettingsChange: (settings: Settings) => void;
}

export function AdvancedSettings({ settings, onSettingsChange }: AdvancedSettingsProps) {
    const handleChange = (key: keyof Settings, value: number | boolean) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    return (
        <div className="space-y-6">
            {/* Iterative Length */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Label>Prompt Length</Label>
                        <Tooltip>
                            <TooltipTrigger>
                                <HelpCircle className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                                Controls how much context is used for generation. Higher values means more context (slower).
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{settings.iterativeLength}</span>
                </div>
                <Slider
                    value={[settings.iterativeLength]}
                    min={0}
                    max={500}
                    step={10}
                    onValueChange={([val]) => handleChange("iterativeLength", val)}
                />
            </div>

            {/* Max Tokens */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Label>Max New Tokens</Label>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{settings.maxTokens}</span>
                </div>
                <Slider
                    value={[settings.maxTokens]}
                    min={128}
                    max={2048}
                    step={64}
                    onValueChange={([val]) => handleChange("maxTokens", val)}
                />
            </div>

            {/* Top P */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label>Top P</Label>
                    <span className="text-xs font-mono text-muted-foreground">{settings.topP}</span>
                </div>
                <Slider
                    value={[settings.topP]}
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    onValueChange={([val]) => handleChange("topP", val)}
                />
            </div>

            {/* Temperature */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <span className="text-xs font-mono text-muted-foreground">{settings.temperature}</span>
                </div>
                <Slider
                    value={[settings.temperature]}
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    onValueChange={([val]) => handleChange("temperature", val)}
                />
            </div>

            {/* Repetition Penalty */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label>Repetition Penalty</Label>
                    <span className="text-xs font-mono text-muted-foreground">{settings.repetitionPenalty}</span>
                </div>
                <Slider
                    value={[settings.repetitionPenalty]}
                    min={1.0}
                    max={2.0}
                    step={0.05}
                    onValueChange={([val]) => handleChange("repetitionPenalty", val)}
                />
            </div>

            {/* Seed */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Label>Seed</Label>
                        <Tooltip>
                            <TooltipTrigger>
                                <HelpCircle className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                                Set to 0 for random generation.
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{settings.seed}</span>
                </div>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={settings.seed}
                        onChange={(e) => handleChange("seed", parseInt(e.target.value) || 0)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="memory-cache">Use Memory Cache</Label>
                <Switch
                    id="memory-cache"
                    checked={settings.useMemoryCache}
                    onCheckedChange={(val) => handleChange("useMemoryCache", val)}
                />
            </div>
        </div>
    );
}
