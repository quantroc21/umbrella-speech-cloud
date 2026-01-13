import { Textarea } from "@/components/ui/textarea";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function TextInput({ value, onChange, maxLength = 5000 }: TextInputProps) {
  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing here or paste any text you want to turn into lifelike speech..."
        className="min-h-[180px] resize-none bg-card border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-base leading-relaxed"
        maxLength={maxLength}
      />
      <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
        {value.length.toLocaleString()} / {maxLength.toLocaleString()}
      </div>
    </div>
  );
}
