import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChefHat, ArrowLeft, CheckCircle2, FlaskConical } from 'lucide-react';
import OrderCard from '@/components/restaurant/OrderCard';

export default function KitchenView() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const data = await base44.entities.Order.filter({ status: 'pending' }, 'created_date');
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 4000);
    const unsubscribe = base44.entities.Order.subscribe((event) => {
      loadOrders();
    });
    return () => {
      clearInterval(interval);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadOrders]);

  const handleComplete = async (orderId) => {
    await base44.entities.Order.update(orderId, { status: 'completed', completedAt: new Date().toISOString() });
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-navy text-white sticky top-0 z-20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-ocean/20 flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-ocean" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Mutfak Görünümü</h1>
              <p className="text-slate-400 text-xs">Canlı sipariş takibi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-accent/20 px-4 py-2 rounded-full">
              <FlaskConical className="w-4 h-4 text-accent" />
              <span className="font-bold text-accent text-lg leading-none">{orders.length}</span>
              <span className="text-slate-300 text-sm">aktif sipariş</span>
            </div>
          </div>
        </div>
      </header>

      {/* Orders grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-ocean rounded-full animate-spin mb-4" />
            <p>Siparişler yükleniyor...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-10 h-10 text-slate-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-slate-700 font-bold text-xl mb-1">Aktif sipariş yok</h3>
            <p className="text-slate-400">Yeni siparişler burada otomatik görünecek</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onComplete={handleComplete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}