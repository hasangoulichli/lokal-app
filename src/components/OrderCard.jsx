import { Clock, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuth } from "@/lib/AuthContext"; // Yetki kontrolü eklendi

function timeAgo(dateStr) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: tr });
  } catch {
    return "";
  }
}

export default function OrderCard({ order, onComplete, completing }) {
  // YETKİ KONTROLÜ - Garson mu girdi?
  const { user } = useAuth();
  const hidePrices = user?.role === 'garson';

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold">
            {order.tableNumber}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Masa</p>
            <p className="text-sm font-semibold">Sipariş</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {timeAgo(order.created_date)}
        </div>
      </div>

      <div className="flex-1 space-y-2 px-4 py-4">
        {order.items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-primary/15 px-1.5 text-xs font-bold text-primary">
                {item.quantity}×
              </span>
              <div>
                <p className="font-medium leading-tight">{item.name}</p>
                {item.variationLabel && (
                  <p className="text-xs text-muted-foreground">{item.variationLabel}</p>
                )}
              </div>
            </div>
            
            {/* ÜRÜN BAZLI FİYATI GİZLE */}
            {!hidePrices && (
              <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
                {item.totalPrice.toLocaleString("tr-TR")} TL
              </span>
            )}
            
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Toplam</p>
          {/* GENEL TOPLAM FİYATI GİZLE VEYA GÖSTER */}
          <p className="text-lg font-bold text-primary">
            {hidePrices ? "—" : `${order.totalAmount.toLocaleString("tr-TR")} TL`}
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => onComplete(order)}
          disabled={completing}
          className="bg-emerald-500 text-white hover:bg-emerald-500/90"
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          {completing ? "İşaretleniyor..." : "Tamamlandı"}
        </Button>
      </div>
    </div>
  );
}