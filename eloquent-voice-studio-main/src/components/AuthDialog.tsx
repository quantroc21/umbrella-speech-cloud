import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Loader2, LogIn, UserPlus, Mail, CheckCircle2 } from "lucide-react";

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultView?: "login" | "signup";
}

export function AuthDialog({ open, onOpenChange, defaultView = "login" }: AuthDialogProps) {
    const [isLogin, setIsLogin] = useState(defaultView === "login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);

    // Reset view when dialog opens/closes or defaultView changes
    React.useEffect(() => {
        if (open) {
            setIsLogin(defaultView === "login");
            setVerificationSent(false); // Reset verification state
            setEmail("");
            setPassword("");
        }
    }, [open, defaultView]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                toast({
                    title: "Welcome back!",
                    description: "You have successfully signed in.",
                });
                onOpenChange(false);
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin,
                    },
                });
                if (error) throw error;

                // 🔗 AFFILIATE TRACKING
                const refCode = localStorage.getItem("referral_code");
                if (refCode && data.user) {
                    try {
                        await supabase.from("referral_logs").insert({
                            referee_id: data.user.id,
                            referrer_code: refCode,
                            status: "registered"
                        });
                        console.log("✅ Referral Linked:", refCode);
                    } catch (refError) {
                        console.error("Referral Link Error:", refError);
                    }
                }

                setVerificationSent(true);
            }
        } catch (error: any) {
            toast({
                title: "Authentication Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] bg-card border-border">
                {verificationSent ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Mail className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <DialogTitle className="text-2xl font-bold">Check your inbox</DialogTitle>
                            <DialogDescription className="text-base max-w-[280px] mx-auto">
                                We've sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>
                            </DialogDescription>
                        </div>
                        <div className="bg-secondary/50 p-4 rounded-lg text-sm text-muted-foreground border border-border w-full">
                            <p>Click the link in the email to activate your account and sign in.</p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full mt-4"
                            onClick={() => {
                                setIsLogin(true);
                                setVerificationSent(false);
                            }}
                        >
                            Back to Sign In
                        </Button>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-center">
                                {isLogin ? "Sign In" : "Create Account"}
                            </DialogTitle>
                            <DialogDescription className="text-center">
                                {isLogin
                                    ? "Enter your credentials to access your studio"
                                    : "Join VoiceCraft to start creating professional AI voices"}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAuth} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-background border-border"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-background border-border"
                                />
                            </div>
                            <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isLogin ? (
                                    <LogIn className="w-4 h-4" />
                                ) : (
                                    <UserPlus className="w-4 h-4" />
                                )}
                                {isLogin ? "Sign In" : "Sign Up"}
                            </Button>
                        </form>
                        <div className="text-center text-sm">
                            <button
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-primary hover:underline font-medium"
                            >
                                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                            </button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
