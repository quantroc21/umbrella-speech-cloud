import { ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SettingSliderProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

function SettingSlider({ label, description, value, onChange, min, max, step, defaultValue }: SettingSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-foreground">{label}</label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono bg-secondary px-2 py-1 rounded text-foreground min-w-[50px] text-center">
            {value}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onChange(defaultValue)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-8">{min}</span>
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => onChange(v[0])}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right">{max}</span>
      </div>
    </div>
  );
}

interface AdvancedSettingsProps {
  settings: {
    sentencePause: number;
    speechSpeed: number;
    iterativeLength: number;
    maxTokens: number;
    topP: number;
    temperature: number;
    repetitionPenalty: number;
    seed: number;
    useMemoryCache: boolean;
  };
  onSettingsChange: (settings: AdvancedSettingsProps["settings"]) => void;
}

export function AdvancedSettings({ settings, onSettingsChange }: AdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v10M1 12h6m6 0h10" />
              </svg>
            </div>
            <span className="font-medium text-foreground">Advanced Voice Settings</span>
          </div>
          <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 p-6 bg-card rounded-xl border border-border space-y-6">
          {/* Row 1: Sentence Pause & Speech Speed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingSlider
              label="Sentence Pause (Breathing)"
              description="Insert silence between sentences"
              value={settings.sentencePause}
              onChange={(v) => updateSetting("sentencePause", v)}
              min={0}
              max={2}
              step={0.1}
              defaultValue={0}
            />
            <SettingSlider
              label="Speech Speed"
              value={settings.speechSpeed}
              onChange={(v) => updateSetting("speechSpeed", v)}
              min={0.5}
              max={2}
              step={0.1}
              defaultValue={1}
            />
          </div>

          {/* Row 2: Iterative Length & Max Tokens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingSlider
              label="Iterative Length"
              description="Set 50 for natural pauses"
              value={settings.iterativeLength}
              onChange={(v) => updateSetting("iterativeLength", v)}
              min={50}
              max={400}
              step={10}
              defaultValue={150}
            />
            <SettingSlider
              label="Max Tokens"
              description="0 = Auto"
              value={settings.maxTokens}
              onChange={(v) => updateSetting("maxTokens", v)}
              min={0}
              max={2048}
              step={64}
              defaultValue={0}
            />
          </div>

          {/* Row 3: Top-P & Temperature */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingSlider
              label="Top-P (Creativity)"
              value={settings.topP}
              onChange={(v) => updateSetting("topP", v)}
              min={0.7}
              max={0.95}
              step={0.01}
              defaultValue={0.8}
            />
            <SettingSlider
              label="Temperature"
              value={settings.temperature}
              onChange={(v) => updateSetting("temperature", v)}
              min={0.7}
              max={1}
              step={0.01}
              defaultValue={0.8}
            />
          </div>

          {/* Row 4: Repetition Penalty & Seed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingSlider
              label="Repetition Penalty"
              value={settings.repetitionPenalty}
              onChange={(v) => updateSetting("repetitionPenalty", v)}
              min={1}
              max={1.2}
              step={0.01}
              defaultValue={1.1}
            />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Seed</label>
                <input
                  type="number"
                  value={settings.seed}
                  onChange={(e) => updateSetting("seed", parseInt(e.target.value) || 0)}
                  className="w-24 text-sm font-mono bg-secondary px-3 py-1.5 rounded border-none text-foreground text-center focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">0 = Random seed each time</p>
            </div>
          </div>

          {/* Memory Cache Toggle */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <label className="text-sm font-medium text-foreground">Use Memory Cache</label>
              <p className="text-xs text-muted-foreground">Cache voice models for faster generation</p>
            </div>
            <Switch
              checked={settings.useMemoryCache}
              onCheckedChange={(v) => updateSetting("useMemoryCache", v)}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
