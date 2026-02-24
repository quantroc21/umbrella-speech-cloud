import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import {
    Film,
    Search,
    Loader2,
    Download,
    Play,
    Pause,
    ExternalLink,
    VideoOff,
    Sparkles,
} from "lucide-react";

interface NormalizedVideo {
    id: string;
    source: "pixabay" | "coverr" | "pexels";
    url: string;
    image: string;
    thumbnail: string;
    duration: number;
    width: number;
    height: number;
    video_url: string;
    preview_url: string;
    download_url: string;
    user_name: string;
    user_url: string;
    tags: string;
}

const CACHE_TTL = 1800000; // 30 min in ms

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    pixabay: { label: "Pixabay", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    coverr: { label: "Coverr", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
    pexels: { label: "Pexels", color: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
};

const SOURCE_FILTERS = [
    { value: "all", label: "All Sources" },
    { value: "pixabay", label: "Pixabay" },
    { value: "coverr", label: "Coverr" },
    { value: "pexels", label: "Pexels" },
];

function extractKeywords(text: string): string {
    const stopWords = new Set([
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "need", "dare", "ought",
        "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
        "as", "into", "through", "during", "before", "after", "above", "below",
        "between", "out", "off", "over", "under", "again", "further", "then",
        "once", "here", "there", "when", "where", "why", "how", "all", "both",
        "each", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "so", "than", "too", "very", "just",
        "because", "but", "and", "or", "if", "while", "that", "this", "it",
        "its", "i", "me", "my", "we", "our", "you", "your", "he", "him",
        "his", "she", "her", "they", "them", "their", "what", "which", "who",
    ]);

    const cleaned = text
        .replace(/\[.*?\]/g, "")
        .replace(/[^a-zA-Z\s]/g, " ")
        .toLowerCase();

    const words = cleaned
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));

    return [...new Set(words)].slice(0, 5).join(" ");
}

function getCachedResult(key: string) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (Date.now() - cached.timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return cached.data;
    } catch {
        return null;
    }
}

function setCacheResult(key: string, data: any) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* full */ }
}

function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatResolution(w: number, h: number) {
    if (w >= 3840) return "4K";
    if (w >= 1920) return "1080p";
    if (w >= 1280) return "720p";
    if (w >= 960) return "540p";
    return `${w}×${h}`;
}

const BrollPage = () => {
    const { user, creditBalance } = useProfile();
    const [searchParams] = useSearchParams();

    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [videos, setVideos] = useState<NormalizedVideo[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchedQuery, setSearchedQuery] = useState("");
    const [totalResults, setTotalResults] = useState(0);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

    const handleSearch = async () => {
        const keywords = query.trim() ? extractKeywords(query) || query.trim() : "";
        if (!keywords) {
            toast({ title: "Enter some text", description: "Type keywords or paste your voiceover script.", variant: "destructive" });
            return;
        }

        setSearchedQuery(keywords);
        setIsSearching(true);
        setHasSearched(true);
        setPlayingId(null);

        const cacheKey = `broll_${keywords}_${sourceFilter}`;
        const cached = getCachedResult(cacheKey);
        if (cached) {
            setVideos(cached.videos || []);
            setTotalResults(cached.total_results || 0);
            setIsSearching(false);
            toast({ title: "B-roll loaded", description: `${cached.videos?.length || 0} videos (cached)` });
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Please sign in to search B-roll.");

            const apiUrl = window.location.hostname === "localhost"
                ? "http://localhost:8000/api/broll/search"
                : "/api/broll/search";

            const params = new URLSearchParams({
                query: keywords,
                per_page: "24",
                page: "1",
                source: sourceFilter,
            });

            const response = await fetch(`${apiUrl}?${params}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);

            setVideos(result.videos || []);
            setTotalResults(result.total_results || 0);
            setCacheResult(cacheKey, result);

            const sourceCounts: Record<string, number> = {};
            (result.videos || []).forEach((v: NormalizedVideo) => {
                sourceCounts[v.source] = (sourceCounts[v.source] || 0) + 1;
            });
            const summary = Object.entries(sourceCounts).map(([k, v]) => `${v} ${k}`).join(", ");
            toast({ title: `${result.videos?.length || 0} B-roll clips found`, description: summary || `for "${keywords}"` });
        } catch (error: any) {
            console.error("B-roll search error:", error);
            toast({ title: "Search failed", description: error.message || "Try again later.", variant: "destructive" });
        } finally {
            setIsSearching(false);
        }
    };

    const toggleVideoPlay = (videoId: string) => {
        const videoEl = videoRefs.current.get(videoId);
        if (!videoEl) return;

        if (playingId === videoId) {
            videoEl.pause();
            setPlayingId(null);
        } else {
            if (playingId) videoRefs.current.get(playingId)?.pause();
            videoEl.play().catch(() => { });
            setPlayingId(videoId);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSearch();
    };

    return (
        <>
            <Navigation user={user} credits={creditBalance} />
            <div className="min-h-screen bg-background">
                <div className="container mx-auto px-4 py-8 max-w-7xl">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-3 mb-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center">
                                <Film className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left">
                                <h1 className="text-2xl font-bold text-foreground">B-roll Studio</h1>
                                <p className="text-xs text-muted-foreground">Cinematic stock footage from Pixabay · Coverr · Pexels</p>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <Card className="p-4 mb-6 border-border bg-card/60 backdrop-blur-sm">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Paste voiceover text or type keywords (e.g. 'cinematic sunset ocean', 'dramatic city night')..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                                />
                            </div>
                            <Button onClick={handleSearch} disabled={isSearching || !query.trim()} className="px-6 gap-2">
                                {isSearching ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</>
                                ) : (
                                    <><Sparkles className="w-4 h-4" /> Search B-roll</>
                                )}
                            </Button>
                        </div>

                        {/* Source Filter Tabs */}
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground mr-1">Source:</span>
                            {SOURCE_FILTERS.map((f) => (
                                <button
                                    key={f.value}
                                    onClick={() => setSourceFilter(f.value)}
                                    className={`text-xs px-3 py-1 rounded-full border transition-all ${sourceFilter === f.value
                                            ? "bg-primary/15 text-primary border-primary/40 font-medium"
                                            : "bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {searchedQuery && hasSearched && !isSearching && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
                                <span>Keywords:</span>
                                <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded">{searchedQuery}</span>
                                <span className="ml-auto">{totalResults} results found</span>
                            </div>
                        )}
                    </Card>

                    {/* Results Grid */}
                    {videos.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                            {videos.map((video) => (
                                <Card
                                    key={video.id}
                                    className="group overflow-hidden border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                                >
                                    {/* Video Preview */}
                                    <div className="relative aspect-video bg-muted cursor-pointer" onClick={() => toggleVideoPlay(video.id)}>
                                        <video
                                            ref={(el) => { if (el) videoRefs.current.set(video.id, el); }}
                                            src={video.preview_url || video.video_url}
                                            poster={video.image || video.thumbnail}
                                            muted
                                            loop
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200">
                                            <div className={`w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl transition-all duration-200 ${playingId === video.id ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"}`}>
                                                {playingId === video.id ? (
                                                    <Pause className="w-5 h-5 text-gray-800" />
                                                ) : (
                                                    <Play className="w-5 h-5 text-gray-800 ml-0.5" />
                                                )}
                                            </div>
                                        </div>
                                        {/* Badges */}
                                        <div className="absolute top-2 left-2 flex gap-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${SOURCE_LABELS[video.source]?.color || "bg-muted text-muted-foreground"}`}>
                                                {SOURCE_LABELS[video.source]?.label || video.source}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-2 right-2 flex gap-1.5">
                                            {video.width > 0 && (
                                                <span className="text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                    {formatResolution(video.width, video.height)}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                {formatDuration(video.duration)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Info + Actions */}
                                    <div className="p-3">
                                        {video.tags && (
                                            <p className="text-[10px] text-muted-foreground truncate mb-1.5">{video.tags}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground truncate mb-2">
                                            by <a href={video.user_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{video.user_name}</a>
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 text-xs h-8 gap-1.5 border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-primary"
                                                onClick={() => window.open(video.download_url || video.video_url, "_blank")}
                                            >
                                                <Download className="w-3 h-3" /> Download
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-primary" asChild>
                                                <a href={video.url} target="_blank" rel="noopener noreferrer" title="View source">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {hasSearched && !isSearching && videos.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <VideoOff className="w-12 h-12 mb-3 opacity-40" />
                            <p className="text-base font-medium">No B-roll found for "{searchedQuery}"</p>
                            <p className="text-sm mt-1">Try different keywords or switch the source filter.</p>
                        </div>
                    )}

                    {/* Initial state */}
                    {!hasSearched && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Film className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-base font-medium">Search for cinematic B-roll footage</p>
                            <p className="text-sm mt-1">Results are aggregated from Pixabay, Coverr, and Pexels — all royalty-free.</p>
                        </div>
                    )}

                    {/* Attribution */}
                    {videos.length > 0 && (
                        <p className="text-[11px] text-muted-foreground text-center py-4">
                            Videos from{" "}
                            <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Pixabay</a>
                            {" · "}
                            <a href="https://coverr.co" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">Coverr</a>
                            {" · "}
                            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Pexels</a>
                            {" — Free for commercial use"}
                        </p>
                    )}
                </div>
            </div>
        </>
    );
};

export default BrollPage;
