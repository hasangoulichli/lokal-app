import { useLocation, Link } from "react-router-dom";
import { ChefHat, UtensilsCrossed, Calculator, User, Anchor, ShieldCheck, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // Eğer henüz user yüklenmediyse garson varsayıyoruz (güvenlik için en düşük yetki)
  const role = user?.role || "garson";

  // Her rol sadece kendi sayfasını görür. 
  // Profil sayfasını "herkes", Yönetim sayfasını sadece "admin" görebilir.
  // Her rol sadece kendi sayfasını görür. Patron her yeri görür!
  const ALL_TABS = [
    { to: "/", label: "Mutfak", icon: ChefHat, match: "/", roles: ["mutfak", "patron"] },
    { to: "/order", label: "Garson", icon: UtensilsCrossed, match: "/order", roles: ["garson", "patron"] },
    { to: "/cashier", label: "Kasiyer", icon: Calculator, match: "/cashier", roles: ["kasa", "patron"] },
    { to: "/patron", label: "Patron", icon: ShieldCheck, match: "/patron", roles: ["patron"] },
    { to: "/profile", label: "Profil", icon: User, match: "/profile", roles: ["garson", "mutfak", "kasa", "patron"] },
  ];

  // Kullanıcının rolüne göre sadece yetkisi olan sekmeleri filtrele
  const visibleTabs = ALL_TABS.filter(tab => tab.roles.includes(role));

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Masaüstü Üst Menü */}
      <header className="hidden select-none border-b border-white/10 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60 md:flex">
        <div className="flex h-16 w-full items-center justify-between px-4 pt-[env(safe-area-inset-top)] md:px-6">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Anchor className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Karaoğlanoğlu</p>
              <p className="text-sm font-semibold text-foreground">Lokali Sistemi</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1.5">
            {visibleTabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === tab.match
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            ))}

            {/* Masaüstü Çıkış Butonu */}
            <button
              onClick={() => logout(true)}
              className="ml-4 inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Çıkış</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Ana İçerik */}
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>

      {/* Mobil Alt Menü */}
      <nav className="select-none border-t border-white/10 bg-card/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="flex items-stretch justify-around">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-3 min-h-[64px] text-[11px] font-medium transition-all active:scale-95",
                location.pathname === tab.match ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </Link>
          ))}
          
          {/* Mobil Çıkış Butonu */}
          <button
            onClick={() => logout(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-3 min-h-[64px] text-[11px] font-medium text-red-500 transition-all active:scale-95"
          >
            <LogOut className="h-5 w-5" />
            Çıkış
          </button>
        </div>
      </nav>
    </div>
  );
}