import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Check, X, Zap, CreditCard, QrCode, ArrowRight, Shield, Clock, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatedSection } from "@/components/AnimatedSection";

const comparisonData = [
  { 
    feature: "Chất lượng", 
    elephantfat: "90-95%", 
    elephantfatSub: "Hỗ trợ tốt US/UK/Global", 
    elevenlabs: "Top-tier", 
    elevenlabsSub: "Global", 
    elephantfatWin: false 
  },
  { 
    feature: "Giá tháng 1", 
    elephantfat: "$6", 
    elephantfatSub: "150.000 VNĐ", 
    elevenlabs: "$11", 
    elevenlabsSub: "275.000 VNĐ", 
    elephantfatWin: true 
  },
  { 
    feature: "Giá tháng 2+", 
    elephantfat: "$6", 
    elephantfatSub: "Vẫn 150.000 VNĐ", 
    elevenlabs: "$22", 
    elevenlabsSub: "Tự động gia hạn", 
    elephantfatWin: true 
  },
  { 
    feature: "Dung lượng", 
    elephantfat: "200K", 
    elephantfatSub: "ký tự (Gấp đôi)", 
    elevenlabs: "100K", 
    elevenlabsSub: "ký tự", 
    elephantfatWin: true 
  },
  { 
    feature: "Chi phí / 10K ký tự", 
    elephantfat: "7.500đ", 
    elephantfatSub: "$0.30", 
    elevenlabs: "55.000đ", 
    elevenlabsSub: "$2.20", 
    elephantfatWin: true 
  },
  { 
    feature: "Thanh toán", 
    elephantfat: "VietQR", 
    elephantfatSub: "Chuyển khoản nội địa", 
    elevenlabs: "Thẻ quốc tế", 
    elevenlabsSub: "Phí chuyển đổi", 
    elephantfatWin: true 
  },
];

const planFeatures = [
  { text: "200.000 ký tự (~30-35k từ)", highlight: true },
  { text: "Truy cập đầy đủ thư viện giọng đọc", highlight: false },
  { text: "Clone giọng nói (Beta)", highlight: false },
  { text: "Điều chỉnh cảm xúc giọng đọc", highlight: false },
  { text: "Xuất file MP3/WAV chất lượng cao", highlight: false },
  { text: "Hỗ trợ qua Zalo/Telegram", highlight: false },
  { text: "Không hết hạn - Dùng đến khi hết credit", highlight: true },
];

const guarantees = [
  { icon: Shield, title: "Bảo mật", desc: "Dữ liệu được mã hóa" },
  { icon: Clock, title: "Tức thì", desc: "Nhận credit trong 5 phút" },
  { icon: Zap, title: "Không lock-in", desc: "Không subscription trap" },
];

const Pricing = () => {
  const handlePayment = () => {
    alert("Tính năng thanh toán VietQR đang được phát triển. Vui lòng liên hệ Zalo để nạp credit.");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-20 md:py-28 relative">
          <div className="text-center max-w-3xl mx-auto">
            <AnimatedSection animation="fade-up" delay={0}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium tracking-wide">Giá cố định - Không subscription trap</span>
              </div>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-up" delay={100}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight leading-[1.1]">
                <span className="text-foreground">Bảng giá</span>
                <br />
                <span className="text-gradient">Đơn giản & Minh bạch</span>
              </h1>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-up" delay={200}>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Một gói duy nhất, giá cố định $6, không phí ẩn.
                <br className="hidden md:block" />
                Thanh toán nội địa, nhận credit ngay.
              </p>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Main Pricing Card */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <AnimatedSection animation="scale-in" delay={300} className="max-w-lg mx-auto">
            <Card className="bg-card border-primary/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary" />
              
              <CardHeader className="text-center pb-6 pt-8">
                <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-medium mb-6 mx-auto">
                  <Zap className="h-4 w-4" />
                  Phổ biến nhất
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold">Gói Editor Pro</CardTitle>
                <CardDescription className="text-base mt-2">Cho Editor chuyên nghiệp cày job Global</CardDescription>
              </CardHeader>
              
              <CardContent className="text-center px-8">
                <div className="mb-8">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl md:text-6xl font-bold text-gradient">150.000</span>
                    <span className="text-xl text-muted-foreground">VNĐ</span>
                  </div>
                  <p className="text-muted-foreground mt-2 text-lg">≈ $6 USD / gói</p>
                </div>
                
                <div className="bg-secondary/50 rounded-xl p-5 mb-8 border border-border">
                  <p className="text-2xl font-bold text-foreground">200.000 ký tự</p>
                  <p className="text-muted-foreground mt-1">Tương đương 30.000 - 35.000 từ</p>
                </div>
                
                <ul className="space-y-4 text-left mb-8">
                  {planFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                        feature.highlight ? 'bg-primary/20' : 'bg-secondary'
                      }`}>
                        <Check className={`h-3 w-3 ${feature.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <span className={`${feature.highlight ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter className="flex flex-col gap-4 px-8 pb-8">
                <Button 
                  size="lg" 
                  className="w-full text-lg h-14 font-medium"
                  onClick={handlePayment}
                >
                  <QrCode className="mr-2 h-5 w-5" />
                  Thanh toán VietQR
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Nhận credit ngay sau khi xác nhận thanh toán
                </p>
              </CardFooter>
            </Card>
          </AnimatedSection>

          {/* Trust Badges */}
          <AnimatedSection animation="fade-up" delay={500} className="max-w-lg mx-auto mt-8">
            <div className="grid grid-cols-3 gap-4">
              {guarantees.map((item, index) => (
                <div key={index} className="flex flex-col items-center text-center p-4 rounded-xl bg-secondary/30 border border-border">
                  <item.icon className="h-6 w-6 text-primary mb-2" />
                  <p className="font-medium text-foreground text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 md:py-28 bg-secondary/20">
        <div className="container mx-auto px-4">
          <AnimatedSection animation="fade-up" className="text-center mb-14">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">So sánh chi tiết</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              ElephantFat vs ElevenLabs
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              So sánh chi tiết để bạn đưa ra quyết định đúng đắn
            </p>
          </AnimatedSection>
          
          <AnimatedSection animation="scale-in" delay={200} className="max-w-3xl mx-auto">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-5 font-medium text-muted-foreground text-sm uppercase tracking-wide">Tiêu chí</th>
                    <th className="text-center p-5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">🐘</span>
                        <span className="font-bold text-primary">ElephantFat</span>
                        <span className="text-xs text-muted-foreground">(Fixed Plan)</span>
                      </div>
                    </th>
                    <th className="text-center p-5">
                      <div className="flex flex-col items-center gap-1">
                        <Volume2 className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold text-muted-foreground">ElevenLabs</span>
                        <span className="text-xs text-muted-foreground">(Creator Plan)</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, index) => (
                    <tr 
                      key={index} 
                      className={`border-b border-border/50 transition-colors ${
                        index === comparisonData.length - 1 ? 'bg-primary/5' : 'hover:bg-secondary/30'
                      }`}
                    >
                      <td className="p-5 text-foreground font-medium">{row.feature}</td>
                      <td className="p-5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-lg font-bold ${row.elephantfatWin ? "text-primary" : "text-foreground"}`}>
                            {row.elephantfat}
                          </span>
                          <span className="text-xs text-muted-foreground">{row.elephantfatSub}</span>
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-lg font-semibold text-muted-foreground">
                            {row.elevenlabs}
                          </span>
                          <span className="text-xs text-muted-foreground">{row.elevenlabsSub}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-center text-sm">
                <span className="text-muted-foreground">Kết luận:</span>{" "}
                <span className="text-foreground font-medium">
                  Tiết kiệm <span className="text-primary font-bold">86%</span> chi phí với chất lượng tương đương 90-95%
                </span>
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* VietQR Info Section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <AnimatedSection animation="fade-up" className="text-center mb-14">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Thanh toán</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Thanh toán qua VietQR
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Chuyển khoản nhanh chóng, hỗ trợ tất cả ngân hàng Việt Nam
            </p>
          </AnimatedSection>
          
          <AnimatedSection animation="scale-in" delay={200}>
            <Card className="max-w-2xl mx-auto bg-card border-border">
              <CardContent className="p-8 md:p-10">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mb-8">
                    <QrCode className="h-10 w-10 text-primary-foreground" />
                  </div>
                  
                  <div className="w-full bg-secondary/50 rounded-xl p-6 mb-8 border border-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Ngân hàng</p>
                        <p className="font-semibold text-foreground text-lg">Vietcombank / MB Bank</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Nội dung chuyển khoản</p>
                        <p className="font-semibold text-foreground text-lg font-mono">[Email] ELEPHANTFAT</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <p className="text-sm">
                      Credit sẽ được cộng vào tài khoản trong vòng <span className="text-foreground font-medium">5 phút</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-secondary/20">
        <div className="container mx-auto px-4 text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Chưa chắc chắn? <span className="text-gradient">Thử miễn phí!</span>
            </h2>
          </AnimatedSection>
          <AnimatedSection animation="fade-up" delay={100}>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Bắt đầu với 1.000 ký tự miễn phí. Không cần đăng ký thẻ.
            </p>
          </AnimatedSection>
          <AnimatedSection animation="fade-up" delay={200}>
            <Link to="/studio">
              <Button size="lg" className="text-base px-8 h-14 font-medium">
                Dùng thử ngay
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐘</span>
              <span className="font-bold text-foreground">ElephantFat</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 ElephantFat. Built for Vietnamese Editors.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;