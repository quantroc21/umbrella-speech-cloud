import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Check, ArrowRight, Zap, Volume2, Mic, Headphones, Globe, Shield, Clock, Sparkles } from "lucide-react";
import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { AnimatedSection } from "@/components/AnimatedSection";
import { SparklesText } from "@/components/magicui/SparklesText";

const featuredVoices = [
  { id: 1, name: "Donald Trump", description: "Male · Deep, Authoritative", accent: "American", flag: "🇺🇸", audioUrl: "/voices/trump.mp3" },
  { id: 2, name: "Brian", description: "Male · Standard Text-to-Speech", accent: "American", flag: "🇺🇸", audioUrl: "/voices/brian.mp3" },
  { id: 3, name: "Mark", description: "Male · High quality speech", accent: "American", flag: "🇺🇸", audioUrl: "/voices/mark.mp3" },
  { id: 4, name: "Adame", description: "Male · Deep, Narrator", accent: "American", flag: "🇺🇸", audioUrl: "/voices/adame.mp3" },
  { id: 5, name: "Clyde", description: "Male · Distinctive Voice", accent: "American", flag: "🇺🇸", audioUrl: "/voices/clyde.mp3" },
  { id: 6, name: "Jessica", description: "Female · Soft, Clear", accent: "American", flag: "🇺🇸", audioUrl: "/voices/jessica.mp3" },
];

const comparisonData = [
  { feature: "Chất lượng", elephantfat: "90-95%", elephantfatSub: "Hỗ trợ tốt US/UK/Global", elevenlabs: "Top-tier", elevenlabsSub: "Global", benefit: "Phù hợp Video/Podcast", elephantfatWin: false },
  { feature: "Giá tháng 1", elephantfat: "$6", elephantfatSub: "150.000 VNĐ", elevenlabs: "$11", elevenlabsSub: "275.000 VNĐ", benefit: "Tiết kiệm 45%", elephantfatWin: true },
  { feature: "Giá tháng 2+", elephantfat: "$6", elephantfatSub: "Vẫn 150.000 VNĐ", elevenlabs: "$22", elevenlabsSub: "Tự động gia hạn", benefit: "Tiết kiệm 73%", elephantfatWin: true },
  { feature: "Dung lượng", elephantfat: "200K", elephantfatSub: "Gấp đôi", elevenlabs: "100K", elevenlabsSub: "ký tự/gói", benefit: "x2 Characters", elephantfatWin: true },
  { feature: "Thanh toán", elephantfat: "VietQR", elephantfatSub: "Chuyển khoản nội địa", elevenlabs: "Thẻ quốc tế", elevenlabsSub: "Phí chuyển đổi", benefit: "0đ phí giao dịch", elephantfatWin: true },
];

const features = [
  { icon: Globe, title: "29+ Ngôn ngữ", description: "Hỗ trợ đa ngôn ngữ cho content global" },
  { icon: Shield, title: "Bảo mật tuyệt đối", description: "Script của bạn không bao giờ bị lưu trữ" },
  { icon: Clock, title: "Tạo voice trong 30s", description: "Render nhanh chóng, không chờ đợi" },
  { icon: Mic, title: "Studio chuyên nghiệp", description: "Chỉnh emotion, speed, pitch linh hoạt" },
  { icon: Headphones, title: "Preview trước khi tải", description: "Nghe thử miễn phí trước khi quyết định" },
  { icon: Sparkles, title: "Cập nhật voice mới", description: "Thêm giọng đọc mới hàng tuần" },
];

const VoiceCard = ({ voice, index }: { voice: typeof featuredVoices[0]; index: number }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => { });
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <AnimatedSection animation="fade-up" delay={index * 80}>
      <div
        className="group relative bg-card border border-border rounded-xl p-6 hover:border-primary/40 hover:bg-card/80 transition-all duration-300 cursor-pointer"
        onClick={togglePlay}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{voice.flag}</span>
              <h4 className="font-semibold text-foreground text-lg">{voice.name}</h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {voice.accent}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{voice.description}</p>
          </div>
          <button
            className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isPlaying
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              }`}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
        </div>
        <audio ref={audioRef} src={voice.audioUrl} onEnded={() => setIsPlaying(false)} />
      </div>
    </AnimatedSection>
  );
};

const FeatureCard = ({ feature, index }: { feature: typeof features[0]; index: number }) => {
  const Icon = feature.icon;
  return (
    <AnimatedSection animation="fade-up" delay={index * 100}>
      <div className="group relative bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-all duration-300">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h4 className="font-semibold text-foreground text-lg mb-2">{feature.title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
      </div>
    </AnimatedSection>
  );
};

const Landing = () => {
  const [playingPlayer, setPlayingPlayer] = useState<'elephantfat' | 'elevenlabs' | null>(null);
  const elephantAudioRef = useRef<HTMLAudioElement>(null);
  const elevenAudioRef = useRef<HTMLAudioElement>(null);

  const handlePlayToggle = (player: 'elephantfat' | 'elevenlabs') => {
    // Stop other audios first
    if (player === 'elephantfat') {
      elevenAudioRef.current?.pause();
      if (playingPlayer === 'elephantfat') {
        elephantAudioRef.current?.pause();
        setPlayingPlayer(null);
      } else {
        elephantAudioRef.current?.play().catch(() => { });
        setPlayingPlayer('elephantfat');
      }
    } else {
      elephantAudioRef.current?.pause();
      if (playingPlayer === 'elevenlabs') {
        elevenAudioRef.current?.pause();
        setPlayingPlayer(null);
      } else {
        elevenAudioRef.current?.play().catch(() => { });
        setPlayingPlayer('elevenlabs');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Gradient Blur Backgrounds */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-30" />
        <div className="absolute top-1/4 -right-32 w-80 h-80 bg-primary/15 rounded-full blur-3xl opacity-25" />
        <div className="absolute bottom-1/3 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-20" />
      </div>

      {/* Hero Section - 2 Column */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 md:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Text */}
            <div className="text-center lg:text-left">
              <AnimatedSection animation="fade-up" delay={0}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm text-primary font-medium tracking-wide">From Editor, For Editor</span>
                </div>
              </AnimatedSection>

              <AnimatedSection animation="fade-up" delay={100}>
                <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 tracking-tight leading-[1.1]">
                  <span className="text-foreground">Premium AI Voiceover</span>
                  <br />
                  <span className="text-gradient">Fixed Price $6</span>
                </h1>
              </AnimatedSection>

              <AnimatedSection animation="fade-up" delay={200}>
                <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Chất lượng giọng đọc ElevenLabs, giá cố định cho Editor Việt Nam.
                  Không subscription trap. Không phí ẩn.
                </p>
              </AnimatedSection>

              <AnimatedSection animation="fade-up" delay={300}>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Link to="/studio">
                    <Button size="lg" className="text-base px-8 h-14 font-medium w-full sm:w-auto">
                      Bắt đầu miễn phí
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link to="/pricing">
                    <Button size="lg" variant="outline" className="text-base px-8 h-14 font-medium w-full sm:w-auto">
                      Xem bảng giá
                    </Button>
                  </Link>
                </div>
              </AnimatedSection>

              <AnimatedSection animation="fade-in" delay={500}>
                <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>200.000 ký tự / gói</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>29+ ngôn ngữ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Không hết hạn</span>
                  </div>
                </div>
              </AnimatedSection>
            </div>

            {/* Right Column - Voice Comparison Card */}
            <AnimatedSection animation="scale-in" delay={400}>
              <div className="relative">
                {/* Glow effect behind card */}
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-3xl scale-110 opacity-40" />

                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 border border-primary/20 rounded-full opacity-50" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 border border-primary/10 rounded-full opacity-30" />

                <Card className="relative bg-card/90 backdrop-blur-sm border-border overflow-hidden">
                  {/* Badge */}
                  <div className="absolute -top-1 -right-1 z-10">
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold px-4 py-2 rounded-bl-xl rounded-tr-xl shadow-lg">
                      95% Identical
                    </div>
                  </div>

                  <CardContent className="p-6 lg:p-8">
                    <div className="text-center mb-6">
                      <h3 className="font-bold text-foreground text-xl mb-1">Nghe và Tự Cảm Nhận</h3>
                      <p className="text-sm text-muted-foreground">So sánh chất lượng ElephantFat vs. ElevenLabs</p>
                    </div>

                    {/* Comparison Players */}
                    <div className="space-y-4">
                      {/* ElevenLabs Player */}
                      <div className={`relative rounded-xl border p-4 transition-all duration-300 ${playingPlayer === 'elevenlabs'
                        ? 'border-muted-foreground/40 bg-secondary/50'
                        : 'border-border bg-secondary/30 hover:border-border/80'
                        }`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Volume2 className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-muted-foreground text-sm">ElevenLabs</p>
                              <p className="text-xs text-muted-foreground/70">$22/tháng Plan</p>
                            </div>
                          </div>

                          {/* Waveform */}
                          <div className="flex-1 h-10 flex items-center justify-center gap-[2px]">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 bg-muted-foreground/40 rounded-full transition-all duration-300 ${playingPlayer === 'elevenlabs' ? 'waveform-bar' : ''
                                  }`}
                                style={{
                                  height: `${Math.random() * 60 + 20}%`,
                                  animationDelay: `${i * 50}ms`
                                }}
                              />
                            ))}
                          </div>

                          <button
                            onClick={() => handlePlayToggle('elevenlabs')}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${playingPlayer === 'elevenlabs'
                              ? 'bg-muted-foreground text-background shadow-md'
                              : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                              }`}
                          >
                            {playingPlayer === 'elevenlabs' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                          </button>
                          <audio
                            ref={elevenAudioRef}
                            src="/voices/comparison-elephantfat.mp3"
                            onEnded={() => setPlayingPlayer(null)}
                          />
                        </div>
                      </div>

                      {/* VS Divider */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs font-bold text-muted-foreground px-2">VS</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      {/* ElephantFat Player */}
                      <div className={`relative rounded-xl border p-4 transition-all duration-300 ${playingPlayer === 'elephantfat'
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                        : 'border-primary/30 bg-primary/5 hover:border-primary/50'
                        }`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                              <span className="text-lg">🐘</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-primary text-sm">ElephantFat</p>
                              <p className="text-xs text-primary/70">$6 Fixed Price</p>
                            </div>
                          </div>

                          {/* Waveform */}
                          <div className="flex-1 h-10 flex items-center justify-center gap-[2px]">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 bg-primary/50 rounded-full transition-all duration-300 ${playingPlayer === 'elephantfat' ? 'waveform-bar' : ''
                                  }`}
                                style={{
                                  height: `${Math.random() * 60 + 20}%`,
                                  animationDelay: `${i * 50}ms`
                                }}
                              />
                            ))}
                          </div>

                          <button
                            onClick={() => handlePlayToggle('elephantfat')}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${playingPlayer === 'elephantfat'
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                              : 'bg-primary/20 text-primary hover:bg-primary/30'
                              }`}
                          >
                            {playingPlayer === 'elephantfat' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                          </button>
                          <audio
                            ref={elephantAudioRef}
                            src="/voices/comparison-elevenlabs.wav"
                            onEnded={() => setPlayingPlayer(null)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Voice Info */}
                    <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🇺🇸</span>
                        <span>Sarah · Female</span>
                      </div>
                      <div className="w-px h-4 bg-border" />
                      <span>Same Script</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="py-20 md:py-28 relative">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <AnimatedSection animation="fade-up" className="text-center mb-14">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Tính năng</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
              Mọi thứ bạn cần để tạo voice chuyên nghiệp
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Từ đội ngũ Editor, thiết kế cho Editor
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 md:py-28 bg-secondary/20 relative">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <AnimatedSection animation="fade-up" className="text-center mb-14">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">So sánh chi phí</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
              ElephantFat vs ElevenLabs
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Tại sao hàng trăm Editor Việt Nam đã chuyển sang ElephantFat?
            </p>
          </AnimatedSection>

          <AnimatedSection animation="scale-in" delay={200}>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-6 font-medium text-muted-foreground text-sm uppercase tracking-wide w-1/4">Tiêu chí</th>
                      <th className="text-center p-6 w-1/4">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-2xl">🐘</span>
                          <span className="font-bold text-primary text-lg">ElephantFat</span>
                        </div>
                      </th>
                      <th className="text-center p-6 w-1/4">
                        <div className="flex flex-col items-center gap-2">
                          <Volume2 className="h-6 w-6 text-muted-foreground" />
                          <span className="font-semibold text-muted-foreground text-lg">ElevenLabs</span>
                        </div>
                      </th>
                      <th className="text-center p-6 w-1/4">
                        <div className="flex flex-col items-center gap-2">
                          <Sparkles className="h-6 w-6 text-primary" />
                          <span className="font-semibold text-primary text-lg">Lợi ích</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row, index) => (
                      <tr
                        key={index}
                        className={`border-b border-border/50 transition-colors ${index === comparisonData.length - 1 ? 'bg-primary/5' : 'hover:bg-secondary/30'
                          }`}
                      >
                        <td className="p-6 text-foreground font-semibold text-base">{row.feature}</td>
                        <td className="p-6 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xl font-bold ${row.elephantfatWin ? "text-primary" : "text-foreground"}`}>
                              {row.elephantfat}
                            </span>
                            <span className="text-sm text-muted-foreground">{row.elephantfatSub}</span>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xl font-semibold text-muted-foreground">
                              {row.elevenlabs}
                            </span>
                            <span className="text-sm text-muted-foreground">{row.elevenlabsSub}</span>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium ${row.elephantfatWin
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                            : 'bg-secondary text-muted-foreground'
                            }`}>
                            {row.benefit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-lg">
                <span className="text-muted-foreground">Kết luận:</span>{" "}
                <span className="text-foreground font-semibold">
                  Tiết kiệm <span className="text-primary font-bold text-xl">86%</span> chi phí với chất lượng tương đương
                </span>
              </p>
              <Link to="/pricing">
                <Button variant="outline" size="lg">
                  Xem chi tiết bảng giá
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Featured Voices */}
      <section className="py-20 md:py-28 relative">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <AnimatedSection animation="fade-up" className="text-center mb-14">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Voice Library</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight flex flex-wrap items-center justify-center gap-x-3">
              20+ Giọng đọc chuẩn từ{" "}
              <SparklesText
                text="ElevenLabs"
                className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary"
                colors={{ first: "#9E7AFF", second: "#FE8BBB" }}
              />
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Truy cập đầy đủ bộ sưu tập giọng đọc AI chuyên nghiệp, đa ngôn ngữ
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredVoices.map((voice, index) => (
              <VoiceCard key={voice.id} voice={voice} index={index} />
            ))}
          </div>

          <AnimatedSection animation="fade-up" delay={600} className="text-center mt-12">
            <Link to="/studio">
              <Button variant="outline" size="lg" className="h-12 px-8">
                Khám phá tất cả giọng đọc
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-20 md:py-28 relative">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
              Sẵn sàng nâng cấp workflow?
            </h2>
          </AnimatedSection>
          <AnimatedSection animation="fade-up" delay={100}>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Bắt đầu với 1.000 ký tự miễn phí. Không cần thẻ tín dụng.
            </p>
          </AnimatedSection>
          <AnimatedSection animation="fade-up" delay={200}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/studio">
                <Button size="lg" className="text-base px-10 h-14 font-medium w-full sm:w-auto">
                  Tạo giọng nói ngay
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="text-base px-10 h-14 font-medium w-full sm:w-auto">
                  Xem bảng giá
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🐘</span>
              <span className="font-bold text-xl text-foreground">ElephantFat</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Bảng giá</Link>
              <Link to="/studio" className="hover:text-foreground transition-colors">Studio</Link>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-lg">🇻🇳</span>
                <span>Proudly Made in Vietnam</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <span>© 2024 ElephantFat</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="mt-8 pt-8 border-t border-border">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <span className="text-sm text-muted-foreground">Thanh toán hỗ trợ:</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-lg">🏦</span>
                  <span className="text-sm font-medium text-foreground">VietQR</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-lg">💳</span>
                  <span className="text-sm font-medium text-foreground">Chuyển khoản nội địa</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-lg">🏧</span>
                  <span className="text-sm font-medium text-foreground">Vietcombank • Techcombank • MB Bank</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
