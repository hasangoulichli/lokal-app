import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import AppLayout from "@/components/AppLayout";
import TableCard from "@/components/cashier/TableCard";
import CloseAccountDialog from "@/components/cashier/CloseAccountDialog";
import EndOfDayDialog from "@/components/cashier/EndOfDayDialog";
import { aggregateTables } from "@/lib/cashier";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, CalendarClock } from "lucide-react";

export default function CashierScreen() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // YETKİ KONTROLÜ: Kasa, Admin ve Patron işlem yapabilir!
  const canEdit = user?.role === 'kasa' || user?.role === 'admin' || user?.role === 'patron';

  const [orders, setOrders] = useState(null);
  const [search, setSearch] = useState("");
  const [closeTarget, setCloseTarget] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [endOfDay, setEndOfDay] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_date", { ascending: false });
        
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Siparişler yüklenirken hata oluştu:", err);
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const activeOrders = (orders || []).filter((o) => !o.paymentStatus);
  const tables = aggregateTables(activeOrders);
  const filtered = tables.filter((t) =>
    t.tableNumber.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleOpenCloseModal = (targetTable) => {
    if (!canEdit) {
      return toast({ variant: "destructive", title: "Yetkisiz İşlem", description: "Hesap kapatma işlemini sadece Yetkililer yapabilir." });
    }
    setCloseTarget(targetTable);
  };

  const handleOpenEndOfDay = () => {
    if (!canEdit) {
      return toast({ variant: "destructive", title: "Yetkisiz İşlem", description: "Gün sonu raporunu sadece Yetkililer alabilir." });
    }
    setEndOfDay(true);
  };

  const handleClose = async (mode, customerName, paidAmount) => {
    if (!canEdit) return;
    setProcessing(true);
    try {
      const paidAt = new Date().toISOString();
      const updatedIds = closeTarget.orderIds;
      
      if (mode === "paid" || mode === "debt") {
        const dbPaymentStatus = mode === "paid" ? "paid" : "debt";
        const totalTableAmount = closeTarget.totalAmount;

        // Full payment or full debt closure
        for (const id of updatedIds) {
           const specificOrder = orders.find(o => o.id === id);
           const amountToSave = mode === "paid" ? specificOrder.totalAmount : 0;
           await supabase.from("orders").update({
             paymentStatus: dbPaymentStatus, paidAt, paid_amount: amountToSave, ...(customerName ? { customerName } : {}),
           }).eq("id", id);
        }
      } else if (mode === "split" || mode === "partial") {
        // Smart POS partial payment: Insert a negative payment row to reduce balance but keep table active
        const paymentOrder = {
           id: Date.now().toString(),
           tableNumber: closeTarget.tableNumber,
           waiterName: "Kasa (Tahsilat)",
           status: "completed",
           paymentStatus: null, // Table remains open!
           currentStage: 8,
           items: [{
             name: `💳 ${mode === 'split' ? 'Alman Usulü (Bölüşük)' : 'Parçalı Ödeme'}`,
             quantity: 1,
             unitPrice: -Number(paidAmount),
             totalPrice: -Number(paidAmount),
             variationLabel: ""
           }],
           totalAmount: -Number(paidAmount),
           created_date: new Date().toISOString()
        };
        const { error } = await supabase.from("orders").insert([paymentOrder]);
        if (error) throw error;
      }

      await loadOrders();
      setCloseTarget(null);
      toast({ title: "İşlem Başarılı", description: mode === 'split' || mode === 'partial' ? "Kısmi tahsilat yapıldı, masa açık." : "Hesap kapatıldı." });
    } catch {
      toast({ variant: "destructive", title: "Hata", description: "İşlem gerçekleştirilemedi." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        <div className="border-b border-border bg-card/60 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Kasiyer Ekranı</h1>
              <p className="text-xs text-muted-foreground">Masa hesapları ve ödeme takibi</p>
            </div>
            <button
              onClick={handleOpenEndOfDay}
              className="select-none inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <CalendarClock className="h-4 w-4" /> Gün Sonu
            </button>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Masa numarası ara..."
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
            {orders === null ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-lg font-semibold">Aktif masa yok</p>
                <p className="text-sm text-muted-foreground">Tüm hesaplar kapatıldı.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((t) => (
                  <TableCard key={t.tableNumber} table={t} onClose={handleOpenCloseModal} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CloseAccountDialog
        table={closeTarget}
        processing={processing}
        onConfirm={handleClose}
        onClose={() => !processing && setCloseTarget(null)}
      />
      <EndOfDayDialog open={endOfDay} onClose={() => setEndOfDay(false)} />
    </AppLayout>
  );
}