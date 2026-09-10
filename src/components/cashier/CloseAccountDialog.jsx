import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertTriangle, Calculator, UserSearch, History, Check, Coins, SplitSquareHorizontal, Users } from "lucide-react";

export default function CloseAccountDialog({ table, processing, onConfirm, onClose }) {
  const { toast } = useToast();
  const [mode, setMode] = useState(null); 
  const [customerName, setCustomerName] = useState("");
  
  const [paidAmount, setPaidAmount] = useState("");
  const [givenAmount, setGivenAmount] = useState("");
  
  const [currency, setCurrency] = useState("TL"); 
  const [exchangeRate, setExchangeRate] = useState(""); 
  
  const [pastDebts, setPastDebts] = useState([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [closingOldDebt, setClosingOldDebt] = useState(null); 

  useEffect(() => {
    if (currency !== "TL") {
      const fetchRates = async () => {
        try {
          const today = new Date().toLocaleDateString();
          const cached = localStorage.getItem("app_currency_rates");
          let rates = null;
          
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.date === today) rates = parsed.rates;
          }

          if (!rates) {
            const res = await fetch("https://api.exchangerate-api.com/v4/latest/TRY");
            const data = await res.json();
            rates = {
              USD: (1 / data.rates.USD).toFixed(2),
              EUR: (1 / data.rates.EUR).toFixed(2),
              GBP: (1 / data.rates.GBP).toFixed(2)
            };
            localStorage.setItem("app_currency_rates", JSON.stringify({ date: today, rates }));
          }
          
          if (rates[currency]) setExchangeRate(rates[currency]);
        } catch (e) {
          console.error("Kur çekilemedi.");
        }
      };
      fetchRates();
    } else {
      setExchangeRate("");
    }
  }, [currency]);

  useEffect(() => {
    if (!table) {
      setMode(null); setCustomerName(""); setPaidAmount(""); setGivenAmount("");
      setCurrency("TL"); setExchangeRate(""); setPastDebts([]);
    }
  }, [table]);

  useEffect(() => {
    if (customerName.length > 2 && mode === 'debt') {
      const searchDebts = async () => {
        setSearchingCustomer(true);
        try {
          const { data, error } = await supabase
            .from("orders")
            .select("id, totalAmount, paid_amount, created_date")
            .ilike("customerName", `%${customerName.trim()}%`)
            .eq("paymentStatus", "debt")
            .order("created_date", { ascending: false });

          if (!error && data) setPastDebts(data);
        } catch (e) {} finally { setSearchingCustomer(false); }
      };
      const timeoutId = setTimeout(searchDebts, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPastDebts([]);
    }
  }, [customerName, mode]);

  const handlePayOldDebt = async (debtId, amount) => {
    setClosingOldDebt(debtId);
    try {
      const { error } = await supabase.from("orders")
        .update({ paymentStatus: "paid", paid_amount: amount, paidAt: new Date().toISOString() })
        .eq("id", debtId);
      if (error) throw error;
      toast({ title: "Başarılı", description: "Eski borç ödendi olarak işaretlendi." });
      setPastDebts(prev => prev.filter(d => d.id !== debtId));
    } catch (e) { toast({ variant: "destructive", title: "Hata", description: "Borç kapatılamadı." }); } 
    finally { setClosingOldDebt(null); }
  };

  if (!table) return null;

  const total = table.totalAmount;
  const numPaid = Number(paidAmount) || 0;
  const numGiven = Number(givenAmount) || 0;
  const numRate = Number(exchangeRate) || 1;

  let changeToGive = 0;
  let isInsufficient = false;

  if (currency === "TL") {
    changeToGive = numGiven - (mode === "split" || mode === "partial" ? numPaid : total);
    isInsufficient = numGiven > 0 && numGiven < (mode === "split" || mode === "partial" ? numPaid : total);
  } else {
    const givenInTL = numGiven * numRate;
    changeToGive = givenInTL - (mode === "split" || mode === "partial" ? numPaid : total);
    isInsufficient = numGiven > 0 && givenInTL < (mode === "split" || mode === "partial" ? numPaid : total);
  }

  const handleConfirm = () => {
    onConfirm(mode, customerName.trim(), numPaid);
  };

  const isFormValid = () => {
    if (mode === "paid") return true;
    if (mode === "debt") return customerName.trim().length > 0;
    if (mode === "split" || mode === "partial") return numPaid > 0 && numPaid <= total;
    return false;
  };

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle>Masa {table.tableNumber} — Hesap Yönetimi</DialogTitle>
          <DialogDescription>
            Kalan Bakiye: <span className="font-black text-primary text-xl">{total.toLocaleString("tr-TR")} TL</span>
          </DialogDescription>
        </DialogHeader>

        {!mode ? (
          <div className="grid grid-cols-2 gap-3 pt-4 animate-in fade-in zoom-in-95">
            <button onClick={() => { setMode("paid"); setPaidAmount(total.toString()); }} className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 transition-all hover:bg-emerald-500/20 active:scale-95 shadow-sm">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <span className="text-sm font-bold text-emerald-500">Tamamı Ödendi</span>
            </button>
            <button onClick={() => { setMode("split"); setPaidAmount(""); }} className="flex flex-col items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 transition-all hover:bg-indigo-500/20 active:scale-95 shadow-sm">
              <SplitSquareHorizontal className="h-8 w-8 text-indigo-500" />
              <span className="text-sm font-bold text-indigo-500">Alman Usulü (Böl)</span>
            </button>
            <button onClick={() => { setMode("partial"); setPaidAmount(""); }} className="flex flex-col items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 transition-all hover:bg-blue-500/20 active:scale-95 shadow-sm">
              <Coins className="h-8 w-8 text-blue-500" />
              <span className="text-sm font-bold text-blue-500">Parçalı Tutar Gir</span>
            </button>
            <button onClick={() => { setMode("debt"); setPaidAmount("0"); }} className="flex flex-col items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 transition-all hover:bg-amber-500/20 active:scale-95 shadow-sm">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <span className="text-sm font-bold text-amber-500">Veresiye (Borç)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6 pt-4 animate-in slide-in-from-right-4 duration-300">
            
            {/* ALMAN USULÜ (SPLIT CHECK) */}
            {mode === "split" && (
              <div className="space-y-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 shadow-sm">
                <Label className="text-indigo-600 font-bold flex items-center gap-2 uppercase tracking-wider text-xs">
                  <Users className="h-4 w-4" /> Hesabı Kişi Sayısına Böl
                </Label>
                <div className="grid grid-cols-5 gap-2">
                  {[2, 3, 4, 5, 6].map(n => (
                    <Button
                      key={n}
                      variant="outline"
                      onClick={() => setPaidAmount((total / n).toFixed(2))}
                      className="font-black text-lg border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/20 h-12 rounded-xl"
                    >
                      {n}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1.5 pt-2 border-t border-indigo-500/20 mt-2">
                  <Label className="text-xs font-bold text-muted-foreground">Kişi Başı Düşen / Ödenecek Tutar (TL)</Label>
                  <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="font-black text-2xl h-14 text-center border-indigo-500/50 rounded-xl" />
                </div>
                {numPaid > 0 && numPaid < total && (
                  <p className="text-xs text-indigo-600 font-bold text-center animate-pulse">
                    Bu ödemeden sonra masada {(total - numPaid).toLocaleString("tr-TR")} TL bakiye kalacak.
                  </p>
                )}
              </div>
            )}

            {/* PARÇALI ÖDEME */}
            {mode === "partial" && (
              <div className="space-y-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 shadow-sm">
                 <Label className="text-blue-600 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                    <Coins className="h-4 w-4" /> Özel Tutar Girin
                 </Label>
                 <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="Örn: 500" className="font-black text-2xl h-14 text-center border-blue-500/50 rounded-xl" />
                 {numPaid > 0 && numPaid < total && (
                  <p className="text-xs text-blue-600 font-bold text-center">
                    Kalan bakiye masada açık kalacaktır.
                  </p>
                )}
              </div>
            )}

            {/* VERESİYE İŞLEMLERİ */}
            {mode === "debt" && (
              <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 shadow-sm">
                <div className="space-y-1.5">
                  <Label className="text-amber-600 font-bold flex items-center gap-2 text-xs uppercase tracking-wider">
                    <UserSearch className="h-4 w-4" /> Müşteri Adı Soyadı
                  </Label>
                  <Input autoFocus value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Örn: Ahmet Yılmaz" className="border-amber-500/30 h-12 rounded-xl" />
                </div>

                {searchingCustomer ? (
                  <p className="text-xs text-muted-foreground animate-pulse">Eski borçlar aranıyor...</p>
                ) : pastDebts.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <History className="h-3 w-3" /> Bu Müşterinin Ödenmemiş Eski Borçları:
                    </Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {pastDebts.map(debt => {
                        const unpaid = debt.totalAmount - (debt.paid_amount || 0);
                        const isClosing = closingOldDebt === debt.id;
                        return (
                          <div key={debt.id} className="flex justify-between items-center text-sm p-3 rounded-xl bg-background/80 border border-border">
                            <div className="flex flex-col">
                              <span className="font-bold text-amber-500">{unpaid.toLocaleString("tr-TR")} TL</span>
                              <span className="text-muted-foreground text-[10px]">{new Date(debt.created_date).toLocaleDateString('tr-TR')}</span>
                            </div>
                            <Button size="sm" variant="outline" disabled={isClosing} onClick={() => handlePayOldDebt(debt.id, debt.totalAmount)} className="h-8 text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30 rounded-lg">
                              {isClosing ? "Kapatılıyor..." : <><Check className="mr-1 h-3 w-3"/> Kapat</>}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* DÖVİZLİ PARA ÜSTÜ HESAPLAYICI (Sadece Tamamı, Bölüşük ve Parçalı modlarda) */}
            {(mode === "paid" || mode === "split" || mode === "partial") && (
              <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-sm">
                <Label className="text-emerald-600 font-bold flex items-center gap-2 text-xs uppercase tracking-wider">
                  <Calculator className="h-4 w-4" /> Döviz / Para Üstü Hesaplayıcı
                </Label>
                
                <div className="grid grid-cols-4 gap-2">
                  {["TL", "GBP", "EUR", "USD"].map(c => (
                    <Button key={c} type="button" variant={currency === c ? "default" : "outline"} className={`rounded-xl ${currency === c ? "bg-emerald-500 hover:bg-emerald-600 font-bold" : "font-semibold text-muted-foreground"}`} onClick={() => setCurrency(c)}>
                      {c}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Verilen ({currency})</Label>
                    <Input type="number" value={givenAmount} onChange={(e) => setGivenAmount(e.target.value)} placeholder="Örn: 50" className="font-bold text-lg h-12 rounded-xl" />
                  </div>
                  
                  {currency !== "TL" && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Günlük Kur</Label>
                      <Input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} placeholder="..." className="font-bold h-12 text-amber-600 rounded-xl" />
                    </div>
                  )}
                </div>

                {numGiven > 0 && (
                  <div className={`p-4 rounded-xl border flex justify-between items-center ${isInsufficient ? 'bg-destructive/10 border-destructive/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                    <span className="text-sm font-bold text-foreground">{isInsufficient ? "Eksik Tutar:" : "Para Üstü:"}</span>
                    <div className="text-right">
                      <span className={`text-2xl font-black ${isInsufficient ? 'text-destructive' : 'text-emerald-500'}`}>
                        {Math.abs(changeToGive).toLocaleString("tr-TR", {maximumFractionDigits: 2})} TL
                      </span>
                      {currency !== "TL" && !isInsufficient && (
                        <p className="text-xs font-bold text-emerald-600/70">
                          (~{(changeToGive / numRate).toLocaleString("tr-TR", {maximumFractionDigits: 2})} {currency})
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BUTONLAR */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setMode(null)} disabled={processing}>Geri</Button>
              <Button className={`flex-1 rounded-xl h-12 font-bold shadow-lg active:scale-95 transition-all ${mode === "paid" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : mode === "debt" ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"}`} disabled={!isFormValid() || processing} onClick={handleConfirm}>
                {processing ? "İşleniyor..." : mode === "paid" ? "Hesabı Kapat" : mode === "debt" ? "Veresiyeye Yaz" : `Tahsil Et (${numPaid} TL)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}