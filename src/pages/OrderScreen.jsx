import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import CartBar from "@/components/CartBar";
import VariationModal from "@/components/VariationModal";
import { CATEGORIES, KITCHEN_STAGES, isItemSoldOut, getCheckedStages } from "@/lib/menu";
import { getMenuItems } from "@/lib/menuData";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// --- GÖZLÜK GEREKTirmeyen GÖRSEL RENK KODLAMASI ---
// Ürün ismine göre sol tarafa renkli şerit ekler (Garsonlar renklerden tanır)
const getItemColorAccent = (itemName) => {
  const name = (itemName || "").toLowerCase();
  
  if (name.includes("su") || name.includes("kola") || name.includes("fanta") || name.includes("sprite") || name.includes("ayran") || name.includes("şalgam") || name.includes("meyve suyu") || name.includes("bira") || name.includes("şarap") || name.includes("rakı")) {
    return "border-l-4 border-l-blue-500 bg-blue-500/[0.03]"; // İçecekler Mavi
  }
  if (name.includes("balık") || name.includes("balik") || name.includes("levrek") || name.includes("çipura") || name.includes("kalamar") || name.includes("karides")) {
    return "border-l-4 border-l-cyan-500 bg-cyan-500/[0.03]"; // Balıklar Turkuaz
  }
  if (name.includes("kebap") || name.includes("et") || name.includes("tavuk") || name.includes("pirzola") || name.includes("köfte")) {
    return "border-l-4 border-l-red-500 bg-red-500/[0.03]"; // Etler Kırmızı
  }
  if (name.includes("meze") || name.includes("salata") || name.includes("humus") || name.includes("ezme") || name.includes("peynir")) {
    return "border-l-4 border-l-emerald-500 bg-emerald-500/[0.03]"; // Mezeler Yeşil
  }
  return "border-l-4 border-l-primary/40"; // Diğerleri standart
};

const detectMenuType = (cartItems) => {
  const fixMenu = (cartItems || []).find((item) => item.name && item.name.includes("Fix Menü"));
  if (!fixMenu) return "individual";
  const name = fixMenu.name.toLowerCase();
  if (name.includes("kebab")) return "kebab_set";
  if (name.includes("pirzola")) return "lamb_set";
  if (name.includes("et")) return "meat_set";
  if (name.includes("tavuk")) return "chicken_set";
  if (name.includes("meze")) return "fixed_meze";
  return "fixed_fish";
};

export default function OrderScreen() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const canEdit = user?.role === 'garson' || user?.role === 'kasa' || user?.role === 'admin' || user?.role === 'patron';
  const hidePrices = user?.role === 'garson'; 

  const [menu, setMenu] = useState(null);
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id);
  const [activeSubCat, setActiveSubCat] = useState(null);
  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [orderNote, setOrderNote] = useState(""); 
  const [variationItem, setVariationItem] = useState(null);
  const [sending, setSending] = useState(false);

  // ÖZEL ÜRÜN STATE'LERİ
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customItem, setCustomItem] = useState({ name: "", price: "" });

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const notifyUser = useCallback((title, body) => {
    toast({ title, description: body });
    try {
      const audio = new Audio('/notification.wav');
      audio.play().catch(e => console.log("Tarayıcı sesi engelledi:", e));
    } catch (error) {
      console.error("Ses çalma hatası:", error);
    }
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { 
          body: body || "Yeni sipariş güncellemesi",
          icon: "/favicon.ico"
        });
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch (e) {
        console.error("Kilit ekranı bildirimi gönderilemedi:", e);
      }
    }
  }, [toast]);

  const loadMenu = useCallback(async () => {
    try {
      const fetchedMenu = await getMenuItems();
      setMenu(fetchedMenu || []);
    } catch (e) {
      console.error("Menü yüklenirken hata oluştu:", e);
      setMenu([]);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    const prev = {};
    const checkOrderUpdates = async () => {
      try {
        const { data: orders, error } = await supabase.from("orders").select("*");
        if (error || !orders) return;

        orders.forEach((o) => {
          const checked = getCheckedStages(o);
          const isCompleted = o.status === "completed";
          const p = prev[o.id];

          if (!p) {
            prev[o.id] = { checked, completed: isCompleted };
            return;
          }

          const who = o.waiterName ? `${o.waiterName} - ` : "";
          
          checked.forEach((stage) => {
            if (!p.checked.has(stage)) {
              const stageInfo = KITCHEN_STAGES.find((s) => s.stage === stage);
              if (stageInfo) {
                notifyUser(
                  `${stageInfo.emoji} ${stageInfo.label} Hazır`,
                  `${who}Masa ${o.tableNumber} için ${stageInfo.label} mutfaktan çıktı!`
                );
              }
            }
          });

          if (isCompleted && !p.completed) {
            notifyUser(
              `✅ Servise Hazır`,
              `${who}Masa ${o.tableNumber} siparişinin tamamı hazırlandı!`
            );
          }

          prev[o.id] = { checked, completed: isCompleted };
        });
      } catch (e) {
        console.error("Bildirim kontrol hatası:", e);
      }
    };

    const interval = setInterval(checkOrderUpdates, 3000);
    return () => clearInterval(interval);
  }, [notifyUser]);

  const handleCategoryClick = (catId) => {
    setActiveCat(catId);
    const catObj = CATEGORIES.find(c => c.id === catId);
    if (catObj && catObj.subCategories && catObj.subCategories.length > 0) {
      setActiveSubCat(catObj.subCategories[0].id);
    } else {
      setActiveSubCat(null);
    }
  };

  const items = useMemo(() => {
    if (!menu) return [];
    
    const mainCat = CATEGORIES.find(c => c.id === activeCat);
    if (!mainCat) return [];

    let targetDbId = mainCat.dbId || mainCat.id;
    
    if (mainCat.subCategories && activeSubCat) {
      const sub = mainCat.subCategories.find(s => s.id === activeSubCat);
      if (sub) targetDbId = sub.dbId;
    } else if (mainCat.subCategories && mainCat.subCategories.length > 0) {
      targetDbId = mainCat.subCategories[0].dbId;
    }

    return menu
      .filter((m) => m.category?.trim() === targetDbId?.trim())
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)); 
  }, [menu, activeCat, activeSubCat]);

  const addToCart = (item, variation = null) => {
    const name = item.name;
    const variationLabel = variation ? variation.label : "";
    const unitPrice = variation ? variation.price : item.price;
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.name === name && c.variationLabel === variationLabel);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + 1,
          totalPrice: (next[idx].quantity + 1) * unitPrice,
        };
        return next;
      }
      return [...prev, { name, variationLabel, quantity: 1, unitPrice, totalPrice: unitPrice }];
    });
  };

  const submitCustomItem = () => {
    if (!customItem.name.trim()) return;
    addToCart({ name: `*ÖZEL* ${customItem.name.trim()}`, price: Number(customItem.price) || 0 });
    setIsCustomOpen(false);
    setCustomItem({ name: "", price: "" });
    toast({ title: "Özel Sipariş", description: "Sepetinize eklendi." });
  };

  const handleProductClick = (item) => {
    if (!canEdit) {
      return toast({ variant: "destructive", title: "Yetkisiz İşlem", description: "Sadece Garson veya Kasiyer sipariş girebilir." });
    }
    if (isItemSoldOut(item)) {
      toast({ variant: "destructive", title: "Tükendi", description: `${item.name} şu anda stokta değil.` });
      return;
    }
    if (item.isSeasonalPriceOnRequest) {
      toast({ title: "Fiyat sorunuz", description: `${item.name} — mevsimlik üründür, fiyat için mutfağa danışın.` });
      return;
    }
    if (item.hasVariations && item.variations?.length) {
      setVariationItem(item);
      return;
    }
    addToCart(item);
  };

  const handleVariationSelect = (variation) => {
    addToCart(variationItem, variation);
    setVariationItem(null);
  };

  const inc = (idx) => {
    if (!canEdit) return;
    setCart((p) => p.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1, totalPrice: (c.quantity + 1) * c.unitPrice } : c));
  };
  
  const dec = (idx) => {
    if (!canEdit) return;
    setCart((p) => p.map((c, i) => i === idx ? { ...c, quantity: c.quantity - 1, totalPrice: (c.quantity - 1) * c.unitPrice } : c).filter((c) => c.quantity > 0));
  };
  
  const remove = (idx) => {
    if (!canEdit) return;
    setCart((p) => p.filter((_, i) => i !== idx));
  };

  const handleTableChange = (val) => {
    if (!canEdit) return;
    setTableNumber(val);
  };

  const handleSend = async () => {
    if (!canEdit) return;
    if (!tableNumber.trim()) return;
    
    setSending(true);

    const backupCart = [...cart];
    const backupTable = tableNumber;
    const backupNote = orderNote;
    
    setCart([]);
    setTableNumber("");
    setOrderNote(""); 
    
    try {
      const newOrder = {
        id: Date.now().toString(),
        tableNumber: backupTable.trim(),
        menuType: detectMenuType(backupCart),
        waiterName: user?.name || "Bilinmeyen Garson",
        currentStage: 0,
        stageTimestamps: { 0: new Date().toISOString() },
        items: backupCart.map((c) => ({
          name: c.name,
          variationLabel: c.variationLabel || "",
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          totalPrice: c.totalPrice,
        })),
        totalAmount: backupCart.reduce((s, c) => s + c.totalPrice, 0),
        status: "pending",
        created_date: new Date().toISOString(),
        note: backupNote.trim() || null, 
      };

      const { error } = await supabase.from("orders").insert([newOrder]);
      if (error) throw error;

      toast({
        title: "Sipariş mutfağa gönderildi ✓",
        description: `Masa ${backupTable.trim()} — ${backupCart.reduce((s, c) => s + c.quantity, 0)} ürün.`,
      });
      
    } catch (e) {
      console.error("Sipariş Gönderme Hatası:", e);
      setCart(backupCart);
      setTableNumber(backupTable);
      setOrderNote(backupNote);
      
      toast({ 
        variant: "destructive", 
        title: "Gönderilemedi", 
        description: "İnternet bağlantınızı kontrol edip tekrar deneyin." 
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        
        <div className="border-b border-border bg-card/60">
          <div className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={cn(
                  "select-none whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  activeCat === cat.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {cat.short}
              </button>
            ))}
          </div>
          
          {CATEGORIES.find(c => c.id === activeCat)?.subCategories && (
            <div className="bg-secondary/20 border-t border-border px-4 py-2 flex gap-2 overflow-x-auto scrollbar-thin shadow-inner">
              {CATEGORIES.find(c => c.id === activeCat).subCategories.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubCat(sub.id)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeSubCat === sub.id 
                      ? "bg-background text-foreground shadow-sm border border-border" 
                      : "bg-transparent text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-5 pb-32">
            
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-muted-foreground">
                {activeSubCat 
                  ? CATEGORIES.find(c => c.id === activeCat)?.subCategories.find(s => s.id === activeSubCat)?.label 
                  : CATEGORIES.find(c => c.id === activeCat)?.label
                }
              </h2>
              <Button onClick={() => setIsCustomOpen(true)} variant="outline" size="sm" className="border-dashed border-2 border-primary text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4 mr-2" /> Özel Ürün
              </Button>
            </div>
            
            {menu === null ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => {
                  // GÜVENLİ VE RİSKSİZ RENK ŞERİDİ UYGULAMASI
                  const colorAccent = getItemColorAccent(item.name);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleProductClick(item)}
                      className={cn(
                        "group select-none flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all active:scale-[0.98]",
                        colorAccent,
                        isItemSoldOut(item)
                          ? "cursor-not-allowed border-red-500/30 opacity-50"
                          : "hover:border-primary hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                          <Plus className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[15px] font-medium leading-tight">{item.name}</p>
                          {item.hasVariations && (
                            <p className="text-xs text-primary">Seçenekli</p>
                          )}
                          {item.isSeasonalPriceOnRequest && (
                            <p className="text-xs text-amber-400">Fiyat sorunuz</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {isItemSoldOut(item) ? (
                          <span className="rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">
                            Tükendi
                          </span>
                        ) : item.isSeasonalPriceOnRequest ? (
                          <span className="text-sm font-semibold text-amber-400">—</span>
                        ) : hidePrices ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary">
                            <Plus className="h-4 w-4" />
                          </div>
                        ) : (
                          <span className="text-base font-bold text-primary">
                            {item.price?.toLocaleString("tr-TR")}
                            <span className="block text-xs font-normal text-muted-foreground">TL</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                    Bu kategoride ürün bulunamadı.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <CartBar
          cart={cart}
          tableNumber={tableNumber}
          onTableChange={handleTableChange}
          orderNote={orderNote}
          onNoteChange={setOrderNote}
          onInc={inc}
          onDec={dec}
          onRemove={remove}
          onSend={handleSend}
          sending={sending}
          hidePrices={hidePrices} 
        />
      </div>

      <VariationModal
        item={variationItem}
        onSelect={handleVariationSelect}
        onClose={() => setVariationItem(null)}
        hidePrices={hidePrices} 
      />

      {/* ÖZEL ÜRÜN MODALI */}
      <Dialog open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <DialogContent className="sm:max-w-sm bg-card">
          <DialogHeader><DialogTitle>Özel / Menü Dışı Ürün</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>İstek (Örn: 1.5 Full Karışık)</Label>
              <Input autoFocus placeholder="Ne getirelim?" value={customItem.name} onChange={(e) => setCustomItem({...customItem, name: e.target.value})} />
            </div>
            {!hidePrices && (
              <div className="space-y-2">
                <Label>Fiyat (TL)</Label>
                <Input type="number" placeholder="Örn: 650" value={customItem.price} onChange={(e) => setCustomItem({...customItem, price: e.target.value})} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCustomOpen(false)}>İptal</Button>
            <Button onClick={submitCustomItem}>Sepete Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}