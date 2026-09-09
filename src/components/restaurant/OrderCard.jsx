import { useState } from "react";
import React from 'react';
import { Clock, CheckCircle2, MapPin } from 'lucide-react';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function minutesAgo(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / 60000);
}

export default function OrderCard({ order, onComplete, hidePrices }) {


  const [completing, setCompleting] = useState(false);

  // ÇÖKMEYİ ÖNLEYEN ZIRH: Eğer order nesnesi veya items dizisi yoksa kart boş döner
  if (!order || !order.items || !Array.isArray(order.items)) {
    return null;
  }

  const mins = minutesAgo(order.created_date);
  const isUrgent = mins >= 10;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      if (onComplete) {
        await onComplete(order.id);
      }
    } catch (e) {
      setCompleting(false);
    }
  };

  return (
    <div className={`bg-card text-card-foreground rounded-3xl border-2 shadow-sm overflow-hidden flex flex-col transition-all ${isUrgent ? 'border-destructive/80 shadow-destructive/10' : 'border-amber-400/80 shadow-amber-400/10'}`}>
      
      {/* Card Header */}
      <div className={`px-5 py-3.5 flex items-center justify-between border-b border-border/40 ${isUrgent ? 'bg-destructive/10 text-destructive-foreground' : 'bg-amber-500/10 text-amber-900 dark:text-amber-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${isUrgent ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'}`}>
            <MapPin className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold leading-tight">Masa</p>
            <p className="font-black text-xl leading-tight">{order.tableNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium bg-card/60 px-3 py-1.5 rounded-xl border border-border/50">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-bold">{formatTime(order.created_date)}</span>
          <span className={`text-xs font-black ml-1 px-1.5 py-0.5 rounded-md ${isUrgent ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
            {mins} dk
          </span>
        </div>
      </div>

      {/* Items Listesi */}
      <div className="px-5 py-4 flex-1">
        <div className="space-y-2.5">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center shadow-sm">
                  {item.quantity}
                </span>
                <div>
                  <p className="font-bold text-foreground text-sm leading-snug">{item.name}</p>
                  {item.variationLabel && (
                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">{item.variationLabel}</p>
                  )}
                </div>
              </div>
              
              {!hidePrices && item.totalPrice !== undefined && (
                <span className="whitespace-nowrap text-xs font-bold text-muted-foreground self-center">
                  {(item.totalPrice ?? 0).toLocaleString("tr-TR")} TL
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Tamamlama Butonu */}
      <div className="p-4 bg-secondary/30 border-t border-border/60">
        <Button
          onClick={handleComplete}
          disabled={completing}
          size="lg"
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-2xl shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
        >
          <CheckCircle2 className="w-5 h-5" />
          {completing ? 'İşaretleniyor...' : 'Tamamlandı Olarak İşaretle'}
        </Button>
      </div>
    </div>
  );
}