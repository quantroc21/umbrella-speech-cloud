import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
    Film,
    Search,
    Loader2,
    Download,
    Play,
    Pause,
    ExternalLink,
    VideoOff,
} from "lucide-react";

interface BrollSearchProps {
    text: string;
    audioUrl?: string;
}

interface PexelsVideo {
    id: number;
    url: string;
    image: string;
    duration: number;
    user: { name: string; url: string };
    video_files: {
        id: number;
        quality: string;
        width: number;
        height: number;
        link: string;
        file_type: string;
    }[];
}

const CACHE_TTL = 3600000; // 1 hour in ms

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

    // Remove emotion tags and special characters
    const cleaned = text
        .replace(/\[.*?\]/g, "")
        .replace(/[^a-zA-Z\s]/g, " ")
        .toLowerCase();

    const words = cleaned
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));

    // Return first 4 unique keywords
    const unique = [...new Set(words)];
    return unique.slice(0, 4).join(" ");
}

function getCachedResult(query: string) {
    try {
        const key = `broll_${query.toLowerCase().trim()}`;
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

function setCacheResult(query: string, data: any) {
    try {
        const key = `broll_${query.toLowerCase().trim()}`;
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
        // localStorage full, ignore
    }
}

function getBestVideoFile(files: PexelsVideo["video_files"]) {
    // Prefer HD (720p-1080p), avoid huge 4K files
    const ranked = [...files]
        .filter((f) => f.file_type === "video/mp4")
        .sort((a, b) => {
            const aScore = a.width >= 720 && a.width <= 1920 ? 1 : 0;
            const bScore = b.width >= 720 && b.width <= 1920 ? 1 : 0;
            if (bScore !== aScore) return bScore - aScore;
            return b.width - a.width;
        });
    return ranked[0] || files[0];
}

function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BrollSearch({ text, audioUrl }: BrollSearchProps) {
    const [videos, setVideos] = useState<PexelsVideo[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [playingId, setPlayingId] = useState<number | null>(null);
    const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

    // Don't show until audio is generated
    if (!audioUrl) return null;

    const handleSearch = async () => {
        const keywords = extractKeywords(text);
        if (!keywords) {
            toast({
                title: "No keywords found",
                description: "Enter some text to search for matching B-roll videos.",
                variant: "destructive",
            });
            return;
        }

        setSearchQuery(keywords);
        setIsSearching(true);
        setHasSearched(true);

        // Check localStorage cache first
        const cached = getCachedResult(keywords);
        if (cached) {
            setVideos(cached.videos || []);
            setIsSearching(false);
            toast({
                title: "B-roll loaded",
                description: `${cached.videos?.length || 0} videos found (cached).`,
            });
            return;
        }

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const apiUrl =
                window.location.hostname === "localhost"
                    ? "http://localhost:8000/api/broll/search"
                    : "/api/broll/search";

            const params = new URLSearchParams({
                query: keywords,
                per_page: "12",
                page: "1",
            });

            const response = await fetch(`${apiUrl}?${params}`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            setVideos(result.videos || []);
            setCacheResult(keywords, result);

            toast({
                title: "B-roll found!",
                description: `${result.videos?.length || 0} royalty-free videos for "${keywords}"`,
            });
        } catch (error: any) {
            console.error("B-roll search error:", error);
            toast({
                title: "B-roll search failed",
                description: error.message || "Try again later.",
                variant: "destructive",
            });
        } finally {
            setIsSearching(false);
        }
    };

    const toggleVideoPlay = (videoId: number) => {
        const videoEl = videoRefs.current.get(videoId);
        if (!videoEl) return;

        if (playingId === videoId) {
            videoEl.pause();
            setPlayingId(null);
        } else {
            // Pause any currently playing
            if (playingId !== null) {
                const prev = videoRefs.current.get(playingId);
                prev?.pause();
            }
            videoEl.play().catch(() => { });
            setPlayingId(videoId);
        }
    };

    const handleDownload = (video: PexelsVideo) => {
        const best = getBestVideoFile(video.video_files);
        if (best) {
            window.open(best.link, "_blank");
        }
    };

    return (
        <Card className="mt-4 p-4 border-border bg-card/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">
                        Smart B-roll Search
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        Pexels
                    </span>
                </div>
            </div>

            <div className="space-y-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSearch}
                    disabled={isSearching || !text.trim()}
                    className="w-full border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-primary"
                >
                    {isSearching ? (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin mr-2" /> Searching...
                        </>
                    ) : (
                        <>
                            <Search className="w-3 h-3 mr-2" /> Find Matching B-roll
                        </>
                    )}
                </Button>

                {searchQuery && hasSearched && !isSearching && (
                    <p className="text-xs text-muted-foreground">
                        Keywords: <span className="font-mono text-primary">{searchQuery}</span>
                    </p>
                )}

                {/* Results Grid */}
                {videos.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {videos.map((video) => {
                            const bestFile = getBestVideoFile(video.video_files);
                            return (
                                <div
                                    key={video.id}
                                    className="group relative rounded-lg overflow-hidden border border-border bg-background hover:border-primary/40 transition-all"
                                >
                                    {/* Video Preview */}
                                    <div className="relative aspect-video bg-muted">
                                        <video
                                            ref={(el) => {
                                                if (el) videoRefs.current.set(video.id, el);
                                            }}
                                            src={bestFile?.link}
                                            poster={video.image}
                                            muted
                                            loop
                                            playsInline
                                            className="w-full h-full object-cover"
                                            onEnded={() => setPlayingId(null)}
                                        />

                                        {/* Play/Pause overlay */}
                                        <button
                                            onClick={() => toggleVideoPlay(video.id)}
                                            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            {playingId === video.id ? (
                                                <Pause className="w-8 h-8 text-white drop-shadow-lg" />
                                            ) : (
                                                <Play className="w-8 h-8 text-white drop-shadow-lg" />
                                            )}
                                        </button>

                                        {/* Duration badge */}
                                        <span className="absolute bottom-1 right-1 text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded">
                                            {formatDuration(video.duration)}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="p-2 flex items-center justify-between gap-1">
                                        <span className="text-[10px] text-muted-foreground truncate flex-1">
                                            by {video.user.name}
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleDownload(video)}
                                                className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </button>
                                            <a
                                                href={video.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                                title="View on Pexels"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Empty state */}
                {hasSearched && !isSearching && videos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <VideoOff className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">No B-roll found for "{searchQuery}"</p>
                        <p className="text-xs mt-1">Try different text or keywords.</p>
                    </div>
                )}

                {/* Attribution */}
                {videos.length > 0 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                        Videos provided by{" "}
                        <a
                            href="https://www.pexels.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            Pexels
                        </a>{" "}
                        · Free for commercial use
                    </p>
                )}
            </div>
        </Card>
    );
}
