import { useState } from "react";
import { Header } from "@/components/Header";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Copy, FileJson, Film } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnimatedSection } from "@/components/AnimatedSection";
import { supabase } from "@/lib/supabase";

// Schema interfaces matching the strict JSON requirement
interface KeywordSegment {
    segment_id: number;
    text: string;
    estimated_seconds: number;
    keywords: {
        subject: string;
        action: string;
        setting: string;
        mood_style: string;
        search_query: string;
    };
}

interface AIResponse {
    overall_theme: string;
    segments: KeywordSegment[];
}

export default function AIKeywordsPage() {
    const [script, setScript] = useState("");
    const [genre, setGenre] = useState("general");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<AIResponse | null>(null);

    const GENRE_OPTIONS = [
        { value: "general", label: "🎬 General Cinematic" },
        { value: "documentary", label: "🎥 Documentary" },
        { value: "youtube_faceless", label: "▶️ YouTube Faceless" },
        { value: "marketing", label: "📢 Marketing / Ad" },
        { value: "educational", label: "📚 Educational" },
    ];

    const MAX_CHARS = 5000;

    const handleAnalyze = async () => {
        if (!script.trim()) {
            toast({ title: "Script Required", description: "Please enter a TTS script to analyze.", variant: "destructive" });
            return;
        }

        setIsAnalyzing(true);
        setResult(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch("/api/ai-keywords", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ script, genre })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.error || "Failed to analyze script");
            }

            const parsed = await response.json();

            if (!parsed.segments || !Array.isArray(parsed.segments)) {
                throw new Error("Invalid format returned by AI.");
            }
            setResult(parsed);
            toast({ title: "Analysis Complete", description: `Generated ${parsed.segments.length} visual keywords.` });

        } catch (error: any) {
            console.error("AI Analysis Error:", error);
            toast({
                title: "Analysis Failed",
                description: error.message || "An unexpected error occurred.",
                variant: "destructive"
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: `${label} copied to clipboard.`, duration: 2000 });
    };

    const copyAllQueries = () => {
        if (!result) return;
        const allQueries = result.segments.map(s => s.keywords.search_query).join("\n");
        copyToClipboard(allQueries, "All search queries");
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <Navigation />

            <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
                <AnimatedSection animation="fade-up" className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-4 text-primary">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">AI Visual Keyword Agent</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Analyze your voiceover script to quickly generate perfect, highly-searchable B-roll visual keywords.
                    </p>
                </AnimatedSection>

                <div className="grid gap-6">
                    {/* Input Card */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <FileJson className="w-5 h-5 text-primary" />
                                Voiceover Script
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Genre Selector */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
                                    <Film className="w-4 h-4" />
                                    Video Genre:
                                </div>
                                <Select value={genre} onValueChange={setGenre}>
                                    <SelectTrigger className="w-[240px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GENRE_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Textarea
                                placeholder="Paste your English TTS script here (up to 5,000 characters)..."
                                className="min-h-[200px] bg-secondary/20 resize-y text-base p-4"
                                value={script}
                                onChange={(e) => {
                                    if (e.target.value.length <= MAX_CHARS) setScript(e.target.value);
                                }}
                                maxLength={MAX_CHARS}
                            />

                            {/* Char counter + Analyze Button */}
                            <div className="flex items-center justify-between gap-4">
                                <span className={`text-xs font-mono ${script.length > MAX_CHARS * 0.9 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    {script.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars
                                </span>
                                <Button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || !script.trim()}
                                    className="flex-1 max-w-md h-12 text-lg font-semibold"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                                            Analyzing Script...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5 mr-2" />
                                            Analyze Script
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Results Area */}
                    {result && (
                        <AnimatedSection animation="fade-in" className="space-y-6 mt-4">
                            <div className="flex items-center justify-between p-6 bg-primary/5 border border-primary/20 rounded-xl">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">Overall Theme</h3>
                                    <p className="text-lg text-foreground font-medium">{result.overall_theme}</p>
                                </div>
                                <Button onClick={copyAllQueries} variant="outline" className="shrink-0 gap-2 border-primary/30 hover:bg-primary/10">
                                    <Copy className="w-4 h-4" /> Copy All Queries
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {result.segments.map((segment) => (
                                    <Card key={segment.segment_id} className="overflow-hidden border-border transition-all hover:border-primary/30 hover:shadow-md group">
                                        <div className="grid md:grid-cols-[1fr_350px]">
                                            {/* Left: Original Script */}
                                            <div className="p-5 md:border-r border-border bg-secondary/10">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-1 rounded">
                                                        SEGMENT {segment.segment_id}
                                                    </span>
                                                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> ~{segment.estimated_seconds}s
                                                    </span>
                                                </div>
                                                <p className="text-foreground leading-relaxed italic text-sm border-l-2 border-primary/30 pl-3 py-1">
                                                    "{segment.text}"
                                                </p>
                                            </div>

                                            {/* Right: AI Visual Keywords */}
                                            <div className="p-5 space-y-4 bg-card flex flex-col justify-between">
                                                <div>
                                                    <div className="text-xs font-semibold text-primary mb-1.5 uppercase tracking-wide">Search Query</div>
                                                    <div className="flex items-stretch gap-2">
                                                        <div className="flex-1 bg-secondary/40 px-3 py-2 rounded border border-border text-sm font-mono break-words leading-tight flex items-center">
                                                            {segment.keywords.search_query}
                                                        </div>
                                                        <Button
                                                            variant="secondary"
                                                            size="icon"
                                                            className="shrink-0 h-auto self-stretch w-10 opacity-70 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => copyToClipboard(segment.keywords.search_query, `Query ${segment.segment_id}`)}
                                                            title="Copy search query"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </AnimatedSection>
                    )}
                </div>
            </main>
        </div>
    );
}

// Minimal Clock icon component inline to avoid extra imports if not available
function Clock(props: any) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
