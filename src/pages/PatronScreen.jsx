import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getMenuItems, migrateMenuToSupabase } from "@/lib/menuData";
import { CATEGORIES } from "@/lib/menu"; 
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Database, Search, Plus, Trash2, LayoutDashboard, Utensils, BookOpen } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Gece 05:00 Mantığı (Kıbrıs / Yerel Saate Göre)
const getBusinessDate = (dateInput) => {
  const d = new Date(dateInput || new Date());
  d.setHours(d.getHours() - 5);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CATEGORY_OPTIONS = [];
CATEGORIES.forEach(c => {
  if (c.subCategories) c.subCategories.forEach(sub => CATEGORY_OPTIONS.push({ id: sub.dbId, label: `${c.label} > ${sub.label}` }));
  else if (c.dbId) CATEGORY_OPTIONS.push({ id: c.dbId, label: c.label });
});

export default function PatronScreen() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("reports"); 
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const defaultItem = { id: null, name: "", category: CATEGORY_OPTIONS[0]?.id || "", price: "", stock: "", sort_order: 0, isSoldOut: false, isSeasonalPriceOnRequest: false, hasVariations: false, variations: [] };
  const [currentItem, setCurrentItem] = useState(defaultItem);

  const [eodReports, setEodReports] = useState([]);
  const [debtsList, setDebtsList] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const loadMenuData = async () => {
    setLoading(true);
    const data = await getMenuItems();
    setItems((data || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    setLoading(false);
  };

  const loadReportsData = async () => {
    setLoadingReports(true);
    try {
      const { data: allOrders, error } = await supabase.from('orders').select('*').neq('status', 'cancelled');
      if (error) throw error;

      // 1. CARİ HESAPLAR
      const debtMap = {};
      allOrders.filter(o => o.paymentStatus === 'debt').forEach(o => {
        const name = o.customerName || 'Bilinmeyen';
        const unpaid = o.totalAmount - (o.paid_amount || 0);
        if (unpaid > 0) {
          if (!debtMap[name]) debtMap[name] = { name, totalDebt: 0, orderCount: 0 };
          debtMap[name].totalDebt += unpaid;
          debtMap[name].orderCount += 1;
        }
      });
      setDebtsList(Object.values(debtMap).sort((a,b) => b.totalDebt - a.totalDebt));

      // 2. GEÇMİŞ GÜN SONLARI (Z Raporu Arşivi)
      const { data: savedReports } = await supabase.from('eod_reports').select('*').order('business_date', { ascending: false });
      const combinedReports = [...(savedReports || [])];

      // 3. BUGÜNÜN CANLI SATIŞLARI (Kasiyer Z raporu almasa bile anlık takip için)
      const todayBusinessDate = getBusinessDate(new Date());
      const todayLiveOrders = allOrders.filter(o => o.paymentStatus && getBusinessDate(o.paidAt || o.created_date) === todayBusinessDate);
      
      const todayLiveRevenue = todayLiveOrders.reduce((s, o) => {
        if(o.paymentStatus === 'paid') return s + o.totalAmount;
        if(o.paymentStatus === 'debt') return s + (Number(o.paid_amount) || 0);
        return s;
      }, 0);

      const todayIndex = combinedReports.findIndex(r => r.business_date === todayBusinessDate);
      
      // Eğer Kasiyer bugün Z Raporu almışsa kilitliyi güncelle, almamışsa Canlı rozetiyle en başa koy!
      if (todayIndex >= 0) {
        combinedReports[todayIndex].total_revenue = todayLiveRevenue;
        combinedReports[todayIndex].orderCount = todayLiveOrders.length;
      } else if (todayLiveRevenue > 0) {
        combinedReports.unshift({
          business_date: todayBusinessDate,
          total_revenue: todayLiveRevenue,
          orderCount: todayLiveOrders.length,
          isLive: true
        });
      }

      setEodReports(combinedReports);

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === "menu") loadMenuData();
    else loadReportsData();
  }, [activeTab]);

  const openAddModal = () => { setModalMode("add"); setCurrentItem(defaultItem); setIsModalOpen(true); };
  const openEditModal = (item) => { setModalMode("edit"); setCurrentItem({...item, stock: item.stock ?? "", sort_order: item.sort_order || 0}); setIsModalOpen(true); };
  const handleAddVariation = () => setCurrentItem(p => ({ ...p, hasVariations: true, variations: [...(p.variations || []), { label: "", price: 0 }] }));
  const handleVariationChange = (index, field, value) => { const newVars = [...currentItem.variations]; newVars[index][field] = field === 'price' ? Number(value) : value; setCurrentItem(p => ({ ...p, variations: newVars })); };
  const handleRemoveVariation = (index) => { const newVars = currentItem.variations.filter((_, i) => i !== index); setCurrentItem(p => ({ ...p, variations: newVars, hasVariations: newVars.length > 0 })); };

  const handleSave = async () => {
    if (!currentItem.name.trim() || !currentItem.category) return toast({ variant: "destructive", title: "Eksik", description: "İsim ve kategori girin." });
    try {
      const payload = { ...currentItem, price: Number(currentItem.price)||0, sort_order: Number(currentItem.sort_order)||0, stock: currentItem.stock ? parseInt(currentItem.stock) : null };
      delete payload.id;
      let dbError = null;

      if (modalMode === "add") {
        const { error } = await supabase.from('menu_items').insert([{ id: `item-${Date.now()}`, ...payload }]);
        dbError = error;
      } else {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', currentItem.id);
        dbError = error;
      }

      if (dbError && dbError.message.includes("type")) {
        const fallback = { ...payload, variations: JSON.stringify(currentItem.variations) };
        if (modalMode === "add") await supabase.from('menu_items').insert([{ id: `item-${Date.now()}`, ...fallback }]);
        else await supabase.from('menu_items').update(fallback).eq('id', currentItem.id);
      }

      toast({ title: "Başarılı", description: "Ürün kaydedildi." });
      setIsModalOpen(false); loadMenuData();
    } catch (e) { toast({ variant: "destructive", title: "Hata", description: "Kaydedilemedi." }); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" silinecek. Emin misiniz?`)) return;
    await supabase.from('menu_items').delete().eq('id', id);
    loadMenuData();
  };

  const handleMigrate = async () => {
    if (!window.confirm("CSV aktarımı başlasın mı?")) return;
    setMigrating(true); const result = await migrateMenuToSupabase(); setMigrating(false);
    if (result.success) { toast({ title: "Aktarıldı" }); loadMenuData(); }
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.category?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <AppLayout>
      <div className="flex h-full flex-col p-4 md:p-6 mx-auto max-w-6xl w-full overflow-hidden">
        
        <div className="flex-none flex gap-2 mb-4 overflow-x-auto pb-3 scrollbar-none border-b border-border">
          <Button variant={activeTab === "reports" ? "default" : "outline"} onClick={() => setActiveTab("reports")} className="rounded-xl h-12 flex-shrink-0 whitespace-nowrap">
            <LayoutDashboard className="mr-2 w-4 h-4" /> Otomatik Gün Sonu
          </Button>
          <Button variant={activeTab === "debts" ? "default" : "outline"} onClick={() => setActiveTab("debts")} className="rounded-xl h-12 flex-shrink-0 whitespace-nowrap">
            <BookOpen className="mr-2 w-4 h-4" /> Veresiye Defteri
          </Button>
          <Button variant={activeTab === "menu" ? "default" : "outline"} onClick={() => setActiveTab("menu")} className="rounded-xl h-12 flex-shrink-0 whitespace-nowrap">
            <Utensils className="mr-2 w-4 h-4" /> Menü Yönetimi
          </Button>
        </div>

        {activeTab === "menu" && (
          <div className="flex-1 flex flex-col min-h-0 animate-in fade-in">
            <div className="flex-none flex flex-col md:flex-row justify-between gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Ürün ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-11 rounded-xl" />
              </div>
              <div className="flex gap-2">
                <Button onClick={openAddModal} className="h-11 rounded-xl"><Plus className="mr-2 h-4 w-4" /> Yeni Ürün</Button>
                <Button onClick={handleMigrate} disabled={migrating} variant="outline" className="h-11 rounded-xl bg-amber-500/10 text-amber-600 border-amber-500/30">
                  {migrating ? <Loader2 className="animate-spin w-4 h-4" /> : <Database className="mr-2 h-4 w-4" />} CSV Aktar
                </Button>
              </div>
            </div>

            <div className="flex-1 bg-card border border-border rounded-xl flex flex-col shadow-sm min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                {loading ? ( <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-muted-foreground" /></div> ) 
                : filteredItems.map(item => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 p-4 border-b border-border items-center hover:bg-muted/20">
                    <div className="col-span-12 md:col-span-5">
                      <p className="font-bold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_OPTIONS.find(c => c.id === item.category)?.label}</p>
                    </div>
                    <div className="col-span-6 md:col-span-3 font-bold text-primary">
                      {item.isSeasonalPriceOnRequest ? "Sorunuz" : item.hasVariations ? "Seçenekli" : `${item.price} TL`}
                    </div>
                    <div className="col-span-6 md:col-span-4 flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditModal(item)}>Düzenle</Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(item.id, item.name)}><Trash2 className="w-4 h-4"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="flex-1 overflow-y-auto animate-in fade-in space-y-4 pb-10 pr-2 scrollbar-thin">
            <h2 className="text-xl font-bold">Gün Sonu Ciro Raporları</h2>
            <p className="text-sm text-muted-foreground mb-4">Mühürlenmiş Z raporları geçmişe dönük burada saklanır.</p>
            {loadingReports ? <Loader2 className="animate-spin text-primary" /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {eodReports.length === 0 ? <p className="text-muted-foreground">Kayıtlı rapor yok.</p> :
                  eodReports.map((r, idx) => (
                  <div key={idx} className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    
                    {/* AKILLI ROZET (Z RAPORU MU CANLI MI?) */}
                    {r.isLive ? (
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-bl-xl shadow-sm animate-pulse">
                        Canlı Satış
                      </div>
                    ) : (
                      <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-bl-xl shadow-sm">
                        Kilitli (Z Raporu)
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground font-bold">{new Date(r.business_date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="text-3xl font-black text-primary mt-2">{(r.total_revenue || 0).toLocaleString('tr-TR')} TL</p>
                    <p className="text-xs text-muted-foreground mt-2">{r.orderCount || 'Belirtilmedi'} masaya hizmet verildi.</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "debts" && (
          <div className="flex-1 overflow-y-auto animate-in fade-in space-y-4 pb-10 pr-2 scrollbar-thin">
            <h2 className="text-xl font-bold">Veresiye ve Cari Defteri</h2>
            <p className="text-sm text-muted-foreground mb-4">Müşterilerin ödenmemiş toplam borç listesi.</p>
            {loadingReports ? <Loader2 className="animate-spin text-primary" /> : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                {debtsList.length === 0 ? <p className="p-6 text-center text-muted-foreground">Aktif borçlu müşteri bulunmuyor.</p> :
                  debtsList.map((d, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 hover:bg-muted/10">
                    <div>
                      <p className="font-bold text-lg">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.orderCount} farklı adisyondan kalan borç.</p>
                    </div>
                    <span className="text-xl font-black text-amber-500">{d.totalDebt.toLocaleString('tr-TR')} TL</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modalMode === "add" ? "Yeni Ürün" : "Düzenle"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <Label>Ürün Adı</Label>
            <Input value={currentItem.name} onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Kategori</Label><select value={currentItem.category} onChange={(e) => setCurrentItem({ ...currentItem, category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="" disabled>Seçin</option>{CATEGORY_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
              <div><Label>Fiyat (TL)</Label><Input type="number" value={currentItem.price} disabled={currentItem.hasVariations || currentItem.isSeasonalPriceOnRequest} onChange={(e) => setCurrentItem({ ...currentItem, price: e.target.value })} /></div>
            </div>
            
            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={currentItem.isSoldOut} onChange={(e)=>setCurrentItem({...currentItem, isSoldOut: e.target.checked})}/> Tükendi</label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={currentItem.isSeasonalPriceOnRequest} onChange={(e)=>setCurrentItem({...currentItem, isSeasonalPriceOnRequest: e.target.checked, price: e.target.checked ? 0 : currentItem.price})}/> Fiyat Sorunuz</label>
            </div>

            <Label className="mt-2 text-primary font-bold">Seçenekler</Label>
            {currentItem.variations.map((v, i) => (
              <div key={i} className="flex gap-2"><Input value={v.label} onChange={(e)=>handleVariationChange(i,'label',e.target.value)} placeholder="1.5 Porsiyon" /><Input type="number" value={v.price} onChange={(e)=>handleVariationChange(i,'price',e.target.value)} placeholder="Fiyat" className="w-24"/><Button variant="ghost" onClick={()=>handleRemoveVariation(i)}><Trash2 className="w-4 h-4 text-red-500"/></Button></div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddVariation}>+ Seçenek Ekle</Button>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setIsModalOpen(false)}>İptal</Button><Button onClick={handleSave}>Kaydet</Button></div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}