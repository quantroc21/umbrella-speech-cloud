import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X, Mic2, CreditCard, Clock, UserPlus } from "lucide-react";

const navLinks = [
  { href: "/", label: "Trang chủ", icon: null },
  { href: "/studio", label: "Studio", icon: Mic2 },
  { href: "/pricing", label: "Bảng giá", icon: CreditCard },
];

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/" && location.pathname === "/") return true;
    if (href !== "/" && location.pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🐘</span>
            <span className="font-bold text-xl text-foreground">ElephantFat</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href}>
                <Button
                  variant={isActive(link.href) ? "secondary" : "ghost"}
                  className={`${
                    isActive(link.href) 
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
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" className="text-muted-foreground">
              Đăng nhập
            </Button>
            <Button className="glow-effect">
              <UserPlus className="mr-2 h-4 w-4" />
              Đăng ký
            </Button>
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
                        className={`w-full justify-start ${
                          isActive(link.href) 
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
                  <Button variant="outline" className="w-full">
                    Đăng nhập
                  </Button>
                  <Button className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Đăng ký miễn phí
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
