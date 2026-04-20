import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, TrendingUp, Eye, ShoppingBag, DollarSign, Star, Megaphone, Truck, Package, Settings, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCTS as products } from "@/data/products";

const titles: Record<string, { title: string; sub: string }> = {
  products: { title: "My products", sub: "Manage your catalog" },
  orders: { title: "Store orders", sub: "Fulfill and track" },
  shipping: { title: "Shipping & logistics", sub: "Templates and carriers" },
  promote: { title: "Promotions", sub: "Coupons, deals, ads" },
  analytics: { title: "Analytics", sub: "Traffic, conversion, revenue" },
  reviews: { title: "Customer reviews", sub: "What buyers are saying" },
  profile: { title: "Store profile", sub: "Banner, logo, about" },
  settings: { title: "Store settings", sub: "Payouts, taxes, hours" },
  "products/new": { title: "Add new product", sub: "List something new" },
};

export default function StoreSection() {
  const { section = "products", sub } = useParams();
  const key = sub ? `${section}/${sub}` : section;
  const meta = titles[key] || { title: "Store", sub: "" };

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/store" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base leading-tight truncate">{meta.title}</h1>
          <p className="text-[11px] text-muted-foreground truncate">{meta.sub}</p>
        </div>
      </header>

      {key === "products" && <ProductsView />}
      {key === "products/new" && <NewProductView />}
      {key === "orders" && <OrdersView />}
      {key === "analytics" && <AnalyticsView />}
      {key === "promote" && <PromoteView />}
      {key === "reviews" && <ReviewsView />}
      {key === "shipping" && <ShippingView />}
      {key === "profile" && <ProfileView />}
      {key === "settings" && <SettingsView />}
    </div>
  );
}

function ProductsView() {
  const my = products.slice(0, 8);
  return (
    <div className="px-4 py-4 space-y-3">
      <Button asChild className="w-full h-11"><Link to="/store/products/new"><Plus className="w-4 h-4 mr-2" /> Add product</Link></Button>
      {my.map((p) => (
        <Link key={p.id} to={`/product/${p.id}`} className="bg-card border rounded-2xl shadow-card p-3 flex gap-3">
          <img src={p.image} alt={p.title} className="w-20 h-20 rounded-xl object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold line-clamp-2">{p.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">${p.price} · MOQ {p.moq}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> 1.2k</span>
              <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> 24</span>
              <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {p.rating}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function NewProductView() {
  return (
    <form onSubmit={(e) => { e.preventDefault(); }} className="px-4 py-4 space-y-4">
      <button type="button" className="w-full aspect-video rounded-2xl border-2 border-dashed bg-muted/40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <ImageIcon className="w-8 h-8" />
        <p className="text-sm font-bold">Upload photos & video</p>
        <p className="text-[11px]">JPG/PNG up to 10MB · MP4 up to 60s</p>
      </button>
      <input placeholder="Product title" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <textarea placeholder="Description" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Price" type="number" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
        <input placeholder="MOQ" type="number" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      </div>
      <input placeholder="Category" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <Button className="w-full h-12">Publish product</Button>
    </form>
  );
}

function OrdersView() {
  const tabs = ["Pending", "Shipped", "Delivered", "Refunds"];
  return (
    <div>
      <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b">
        {tabs.map((t, i) => <button key={t} className={`px-3 h-8 rounded-full text-xs font-bold whitespace-nowrap ${i === 0 ? "bg-foreground text-background" : "bg-muted"}`}>{t}</button>)}
      </div>
      <div className="px-4 py-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-2xl shadow-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">Order #PB{1000 + i}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">Pending</span>
            </div>
            <p className="text-sm font-semibold mt-2">2 items · $148.00</p>
            <p className="text-[11px] text-muted-foreground">Buyer: jane.d@example.com · 2h ago</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="flex-1">Mark shipped</Button>
              <Button size="sm" variant="outline" className="flex-1">Message</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsView() {
  const stats = [
    { icon: Eye, label: "Visitors", value: "2,418", trend: "+12%" },
    { icon: ShoppingBag, label: "Orders", value: "184", trend: "+8%" },
    { icon: DollarSign, label: "Revenue", value: "$12,840", trend: "+24%" },
    { icon: TrendingUp, label: "Conversion", value: "3.4%", trend: "+0.6%" },
  ];
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-2xl border shadow-card p-4">
            <s.icon className="w-4 h-4 text-primary" />
            <p className="text-xl font-bold mt-2">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className="text-[10px] font-bold text-emerald-600 mt-1">{s.trend} vs last week</p>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-2xl border shadow-card p-4">
        <p className="font-bold text-sm mb-3">Sales — last 7 days</p>
        <div className="flex items-end gap-1.5 h-32">
          {[40, 65, 50, 80, 95, 70, 100].map((h, i) => (
            <div key={i} className="flex-1 bg-gradient-to-t from-primary to-primary/40 rounded-t-lg" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PromoteView() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[
        { icon: Megaphone, title: "Sponsored listing", desc: "Boost product to top of search", cta: "Boost from $5/day" },
        { icon: DollarSign, title: "Coupons", desc: "Create discount codes for buyers", cta: "Create coupon" },
        { icon: TrendingUp, title: "Flash deal", desc: "Time-limited price drop on the home feed", cta: "Schedule deal" },
      ].map((c) => (
        <div key={c.title} className="bg-card rounded-2xl border shadow-card p-4">
          <div className="flex gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><c.icon className="w-5 h-5" /></span>
            <div className="flex-1"><p className="font-bold text-sm">{c.title}</p><p className="text-xs text-muted-foreground">{c.desc}</p></div>
          </div>
          <Button className="w-full mt-3 h-10">{c.cta}</Button>
        </div>
      ))}
    </div>
  );
}

function ReviewsView() {
  const reviews = [
    { user: "Maria K.", rating: 5, text: "Quality is excellent, packaging was perfect. Will reorder!", date: "2d ago" },
    { user: "Ahmed R.", rating: 4, text: "Good product, shipping took a bit longer than expected.", date: "5d ago" },
    { user: "Lisa W.", rating: 5, text: "Exactly as described. Supplier was very responsive.", date: "1w ago" },
  ];
  return (
    <div className="px-4 py-4 space-y-3">
      <div className="bg-card rounded-2xl border shadow-card p-4 flex items-center gap-4">
        <div className="text-center"><p className="text-3xl font-bold">4.9</p><p className="text-[10px] text-muted-foreground">312 reviews</p></div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((s, i) => (
            <div key={s} className="flex items-center gap-2"><span className="text-[10px] w-3">{s}</span><div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${[80, 14, 4, 1, 1][i]}%` }} /></div></div>
          ))}
        </div>
      </div>
      {reviews.map((r, i) => (
        <div key={i} className="bg-card border rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between"><p className="font-bold text-sm">{r.user}</p><p className="text-[11px] text-muted-foreground">{r.date}</p></div>
          <div className="flex gap-0.5 my-1.5">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className={`w-3 h-3 ${j < r.rating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />)}</div>
          <p className="text-xs text-muted-foreground leading-relaxed">{r.text}</p>
        </div>
      ))}
    </div>
  );
}

function ShippingView() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[
        { name: "Standard", time: "7-15 days", cost: "$4.99", carriers: "DHL, UPS" },
        { name: "Express", time: "3-5 days", cost: "$14.99", carriers: "FedEx" },
        { name: "Sea freight", time: "30-45 days", cost: "By weight", carriers: "Maersk" },
      ].map((s) => (
        <div key={s.name} className="bg-card rounded-2xl border shadow-card p-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Truck className="w-5 h-5" /></span>
            <div className="flex-1"><p className="font-bold text-sm">{s.name}</p><p className="text-[11px] text-muted-foreground">{s.time} · {s.carriers}</p></div>
            <p className="font-bold text-sm">{s.cost}</p>
          </div>
        </div>
      ))}
      <Button className="w-full h-11"><Plus className="w-4 h-4 mr-2" /> Add shipping template</Button>
    </div>
  );
}

function ProfileView() {
  return (
    <form className="px-4 py-4 space-y-4">
      <button type="button" className="w-full aspect-[3/1] rounded-2xl border-2 border-dashed bg-muted/40 flex items-center justify-center text-muted-foreground"><ImageIcon className="w-6 h-6 mr-2" /> Banner image</button>
      <button type="button" className="w-20 h-20 rounded-2xl border-2 border-dashed bg-muted/40 flex items-center justify-center text-muted-foreground"><ImageIcon className="w-5 h-5" /></button>
      <input placeholder="Store name" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <textarea placeholder="About your store" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />
      <input placeholder="Country" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <Button className="w-full h-12">Save changes</Button>
    </form>
  );
}

function SettingsView() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[
        { icon: DollarSign, label: "Payouts", hint: "Bank account, schedule" },
        { icon: Package, label: "Tax & invoicing", hint: "VAT, business ID" },
        { icon: Settings, label: "Store hours", hint: "Mon–Fri · 9am–6pm" },
        { icon: Megaphone, label: "Auto-reply messages", hint: "Welcome, away" },
      ].map((s) => (
        <div key={s.label} className="bg-card rounded-2xl border shadow-card p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><s.icon className="w-5 h-5" /></span>
          <div className="flex-1"><p className="font-bold text-sm">{s.label}</p><p className="text-[11px] text-muted-foreground">{s.hint}</p></div>
        </div>
      ))}
    </div>
  );
}
