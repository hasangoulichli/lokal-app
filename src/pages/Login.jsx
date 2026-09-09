import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Anchor, Delete, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [logoClicks, setLogoClicks] = useState(0);

  const handleLogoClick = () => {
    setLogoClicks((prev) => prev + 1);
  };

  const adminUnlocked = logoClicks >= 5;

  useEffect(() => {
    if (adminUnlocked) {
      setName("Patron");
      setPin("");
      setError("");
    }
  }, [adminUnlocked]);

  useEffect(() => {
    if (pin.length === 4) {
      handleLogin(pin);
    }

  }, [pin]);

  const handleLogin = (enteredPin) => {
    if (!name.trim()) {
      setError("Lütfen önce adınızı girin.");
      setPin("");
      return;
    }

    let role = null;
    let redirectPath = "/";

    if (enteredPin === "0000" && !adminUnlocked) {
      role = "garson";
      redirectPath = "/order";
    } else if (enteredPin === "1111" && !adminUnlocked) {
      role = "mutfak";
      redirectPath = "/";
    } else if (enteredPin === "7991" && !adminUnlocked) {
      role = "kasa";
      redirectPath = "/cashier";
    } else if (enteredPin === "1111" && adminUnlocked) {
      role = "patron";
      redirectPath = "/patron"; // DÜZELTİLDİ: Artık 404 vermeyecek, direkt /patron açılacak.
    }

    if (role) {
      login({ name: name.trim(), role: role });
      setTimeout(() => navigate(redirectPath, { replace: true }), 150);
    } else {
      setError("Hatalı Şifre");
      setTimeout(() => {
        setPin("");
        setError("");
      }, 800);
    }
  };

  const handlePadClick = (val) => {
    if (pin.length < 4) {
      setPin((prev) => prev + val);
      setError("");
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
        
        <div className="mb-6 flex flex-col items-center text-center">
          <div 
            onClick={handleLogoClick}
            className={cn(
              "mb-4 flex h-16 w-16 cursor-pointer items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95 select-none",
              adminUnlocked 
                ? "bg-amber-500 text-white shadow-amber-500/20" 
                : "bg-primary text-primary-foreground shadow-primary/20"
            )}
          >
            <Anchor className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Karaoğlanoğlu Lokali</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sisteme girmek için adınızı ve şifrenizi girin
          </p>
        </div>

        <div className="space-y-6">
          {adminUnlocked ? (
            <div className="flex flex-col gap-1.5 animate-in zoom-in duration-300">
              <Label className="text-amber-500 font-bold uppercase tracking-wider text-[10px] text-center">
                Yönetici Kilidi Açıldı
              </Label>
              <div className="flex h-12 w-full items-center justify-center rounded-xl bg-amber-500 text-lg font-black tracking-widest text-white shadow-lg shadow-amber-500/30">
                PATRON
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Ad Soyad</Label>
              <Input
                id="name"
                autoFocus
                autoComplete="off"
                placeholder="Örn: Barış"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                className="h-12 text-base bg-background"
              />
            </div>
          )}

          <div className="pt-2">
            <div className={cn("flex justify-center gap-4", error === "Hatalı Şifre" && "animate-shake")}>
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-4 w-4 rounded-full transition-all duration-300",
                    pin.length > i 
                      ? error 
                        ? "bg-red-500 scale-110 shadow-[0_0_10px_rgba(239,68,68,0.5)]" 
                        : adminUnlocked
                          ? "bg-amber-500 scale-110 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                          : "bg-primary scale-110 shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
            
            <div className="mt-4 flex h-5 items-center justify-center">
              {error && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                  <AlertCircle className="h-4 w-4" /> {error}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePadClick(num.toString())}
                className={cn(
                  "flex h-14 items-center justify-center rounded-2xl text-xl font-semibold text-foreground transition-colors sm:h-16 sm:text-2xl",
                  adminUnlocked 
                    ? "bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500 active:text-white"
                    : "bg-secondary hover:bg-secondary/80 active:bg-primary active:text-primary-foreground"
                )}
              >
                {num}
              </button>
            ))}
            <div className="flex items-center justify-center"></div>
            <button
              type="button"
              onClick={() => handlePadClick("0")}
              className={cn(
                "flex h-14 items-center justify-center rounded-2xl text-xl font-semibold text-foreground transition-colors sm:h-16 sm:text-2xl",
                adminUnlocked 
                  ? "bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500 active:text-white"
                  : "bg-secondary hover:bg-secondary/80 active:bg-primary active:text-primary-foreground"
              )}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground active:bg-destructive active:text-destructive-foreground sm:h-16"
            >
              <Delete className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}