import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Copy, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface VietQRDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    email?: string;
}

export function VietQRDialog({ open, onOpenChange, userId, email }: VietQRDialogProps) {
    const [isSuccess, setIsSuccess] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    // SePay Config (Dynamic)
    const BANK_ID = "BIDV";
    const ACCOUNT_NO = "96247190376";
    const AMOUNT = 150000;
    const MEMO = email || (userId ? `EF${userId.replace(/-/g, "")}` : "EF");

    // Dynamic QR structure: https://qr.sepay.vn/img?acc=SO_TAI_KHOAN&bank=NGAN_HANG&amount=SO_TIEN&des=NOI_DUNG&template=compact
    const qrUrl = `https://qr.sepay.vn/img?acc=${ACCOUNT_NO}&bank=${BANK_ID}&amount=${AMOUNT}&des=${encodeURIComponent(MEMO)}&template=compact`;

    useEffect(() => {
        if (!open || !userId) return;

        setIsSuccess(false);
        setIsChecking(true);

        const fetchInitialCredits = async () => {
            const { data } = await supabase
                .from("profiles")
                .select("credit_balance")
                .eq("id", userId)
                .single();
            return data?.credit_balance || 0;
        };

        let initialCredits = 0;
        fetchInitialCredits().then(c => initialCredits = c);

        // 🚀 POLLING FALLBACK (Every 3s)
        const intervalId = setInterval(async () => {
            const { data } = await supabase
                .from("profiles")
                .select("credit_balance")
                .eq("id", userId)
                .single();

            if (data && data.credit_balance > initialCredits && initialCredits > 0) {
                // Optimization: Only trigger if we have a valid initial balance > 0 check to avoid race conditions 
                // actually initialCredits might be 0 for new users. 
                // Let's just check if data.credit_balance > initialCredits
            }

            if (data && data.credit_balance > initialCredits) {
                setIsSuccess(true);
                setIsChecking(false);
                toast({
                    title: "Thanh toán thành công!",
                    description: "Credits đã được cộng vào tài khoản của bạn.",
                });
                clearInterval(intervalId); // Stop polling

                // Auto close
                setTimeout(() => {
                    onOpenChange(false);
                }, 3000);
            }
        }, 3000);

        // 🚀 SUPABASE REALTIME LISTENER
        const channel = supabase
            .channel(`public:profiles:id=eq.${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    if (payload.new.credit_balance > payload.old.credit_balance) {
                        setIsSuccess(true);
                        setIsChecking(false);
                        toast({
                            title: "Thanh toán thành công!",
                            description: "200,000 credits đã được cộng vào tài khoản của bạn.",
                        });
                        clearInterval(intervalId); // Stop polling

                        setTimeout(() => {
                            onOpenChange(false);
                        }, 3000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, [open, userId]);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Đã sao chép",
            description: `${label} đã được lưu vào bộ nhớ tạm.`,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] bg-card border-border overflow-hidden font-['Be_Vietnam_Pro'] px-0 pt-0">
                <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary animate-pulse" />

                <div className="px-6 pt-6 text-center">
                    {isSuccess ? (
                        <div className="py-12 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                            </div>
                            <DialogTitle className="text-2xl font-bold text-foreground mb-2">Giao dịch thành công!</DialogTitle>
                            <p className="text-muted-foreground"> Credits đã được cộng vào tài khoản.</p>
                        </div>
                    ) : (
                        <>
                            <DialogHeader className="mb-6">
                                <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
                                    Thanh toán VietQR
                                </DialogTitle>
                                <DialogDescription className="text-center">
                                    Quét mã QR dưới đây để hoàn tất thanh toán (Xử lý tự động 30s-60s)
                                </DialogDescription>
                            </DialogHeader>

                            <div className="relative group mx-auto mb-8 w-64 h-64 bg-white p-3 rounded-2xl shadow-xl border border-border/50">
                                <img
                                    src={qrUrl}
                                    alt="VietQR"
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none">
                                    <QrCode className="w-8 h-8 text-black/20" />
                                </div>
                            </div>

                            <div className="space-y-4 text-left bg-secondary/30 p-5 rounded-2xl border border-border/50 mb-6">
                                <div className="flex justify-between items-center group cursor-pointer" onClick={() => copyToClipboard(ACCOUNT_NO, "Số tài khoản")}>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Số tài khoản</p>
                                        <p className="font-bold text-foreground tracking-tight">{ACCOUNT_NO}</p>
                                    </div>
                                    <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>

                                <div className="flex justify-between items-center group cursor-pointer" onClick={() => copyToClipboard(MEMO, "Nội dung")}>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nội dung chuyển khoản</p>
                                        <p className="font-bold text-primary tracking-tight">{MEMO}</p>
                                    </div>
                                    <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>

                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Số tiền</p>
                                        <p className="font-bold text-foreground tracking-tight">{AMOUNT.toLocaleString()} VNĐ</p>
                                    </div>
                                    <div className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                                        <p className="text-[10px] font-bold text-primary italic">+200K Credits</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-3 py-4 text-muted-foreground animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm font-medium">Đang chờ hệ thống xác nhận...</span>
                            </div>

                            <div className="pt-2 pb-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold opacity-50">
                                <ShieldCheck className="w-3 h-3" />
                                Giao dịch an toàn qua SePay.vn
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
