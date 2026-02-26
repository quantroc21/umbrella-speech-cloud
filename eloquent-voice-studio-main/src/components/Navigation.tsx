import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Mic2, CreditCard, UserPlus, LogOut, Coins, Film, Sparkles } from "lucide-react";
import { AuthDialog } from "@/components/AuthDialog";
import { supabase } from "@/lib/supabase";

const navLinks = [
  { href: "/", label: "Home", icon: null },
  { href: "/studio", label: "Studio", icon: Mic2 },
  { href: "/broll", label: "B-roll", icon: Film },
  { href: "/ai-keywords", label: "AI Keywords", icon: Sparkles },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

interface NavigationProps {
  user?: any;
  credits?: number;
}

const Navigation = ({ user, credits = 0 }: NavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/" && location.pathname === "/") return true;
    if (href !== "/" && location.pathname.startsWith(href)) return true;
    return false;
  };

  const handleLogin = () => {
    setAuthView("login");
    setIsAuthOpen(true);
    setIsOpen(false);
  };

  const handleSignup = () => {
    setAuthView("signup");
    setIsAuthOpen(true);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-2xl">🐘</span>
              <span className="font-bold text-xl text-foreground">ElephantFat</span>
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">v3.1</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.href} to={link.href}>
                  <Button
                    variant={isActive(link.href) ? "secondary" : "ghost"}
                    className={`${isActive(link.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {link.icon && <link.icon className="mr-2 h-4 w-4" />}
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>


            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end mr-1">
                    <span className="text-xs font-semibold text-foreground/80">{user.email}</span>
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                      <Coins className="w-3 h-3" />
                      <span>{credits.toLocaleString()} Credits</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-foreground/80 hover:text-destructive transition-colors ml-2"
                    title="Sign out"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-6 h-6" strokeWidth={3.5} />
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="ghost" className="text-muted-foreground" onClick={handleLogin}>
                    Log in
                  </Button>
                  <Button className="glow-effect" onClick={handleSignup}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Sign up
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] bg-background border-border">
                <div className="flex flex-col gap-6 mt-8">
                  {/* Mobile Nav Links */}
                  <div className="flex flex-col gap-2">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={() => setIsOpen(false)}
                      >
                        <Button
                          variant={isActive(link.href) ? "secondary" : "ghost"}
                          className={`w-full justify-start ${isActive(link.href)
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground"
                            }`}
                        >
                          {link.icon && <link.icon className="mr-2 h-4 w-4" />}
                          {link.label}
                        </Button>
                      </Link>
                    ))}
                  </div>

                  {/* Mobile Auth */}
                  <div className="flex flex-col gap-2 pt-4 border-t border-border">
                    <Button variant="outline" className="w-full" onClick={handleLogin}>
                      Log in
                    </Button>
                    <Button className="w-full" onClick={handleSignup}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Sign up for free
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      <AuthDialog
        open={isAuthOpen}
        onOpenChange={setIsAuthOpen}
        defaultView={authView}
      />
    </>
  );
};

export default Navigation;
