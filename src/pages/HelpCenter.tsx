import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, MessageCircle, Mail, Phone, BookOpen, ShoppingBag, CreditCard, Truck, RotateCcw, Shield, Sparkles, ChevronDown } from "lucide-react";

const topics = [
  { icon: ShoppingBag, label: "Orders" },
  { icon: Truck, label: "Shipping" },
  { icon: RotateCcw, label: "Returns" },
  { icon: CreditCard, label: "Payments" },
  { icon: Shield, label: "Trade Assurance" },
  { icon: BookOpen, label: "Selling" },
];

const faqs = [
  { q: "How do I track my order?", a: "Go to Account → All orders. Each order has live tracking with carrier updates." },
  { q: "What is Trade Assurance?", a: "Pubstore protects your payment until the goods arrive matching the description." },
  { q: "Can I cancel an order?", a: "Yes, within 1 hour of placing it before the supplier processes shipping." },
  { q: "How do I become a supplier?", a: "Account → Become a supplier. Verification takes ~24 hours." },
  { q: "How does live shopping work?", a: "Tap any LIVE badge to join a supplier stream and buy pinned products in real time." },
];

export default function HelpCenter() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Help center</h1>
      </header>

      <div className="px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search help articles..." className="w-full h-12 rounded-2xl border bg-card pl-10 pr-4 text-sm shadow-card" />
        </div>

        <Link to="/messages" className="mt-4 block bg-gradient-to-br from-primary to-primary/60 text-primary-foreground rounded-2xl p-4 shadow-elevated">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-background/20 backdrop-blur flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
            <div className="flex-1">
              <p className="font-bold">Ask Tapson AI</p>
              <p className="text-xs opacity-90">Get instant answers 24/7</p>
            </div>
          </div>
        </Link>

        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-5 mb-2">Browse topics</p>
        <div className="grid grid-cols-3 gap-2">
          {topics.map((t) => (
            <button key={t.label} className="bg-card border rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-card">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><t.icon className="w-4.5 h-4.5" /></span>
              <span className="text-[11px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-6 mb-2">Popular questions</p>
        <div className="bg-card rounded-2xl border shadow-card divide-y overflow-hidden">
          {faqs.map((f) => (
            <button key={f.q} onClick={() => setOpen(open === f.q ? null : f.q)} className="w-full text-left px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{f.q}</p>
                <ChevronDown className={`w-4 h-4 transition ${open === f.q ? "rotate-180" : ""}`} />
              </div>
              {open === f.q && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{f.a}</p>}
            </button>
          ))}
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-6 mb-2">Contact us</p>
        <div className="bg-card rounded-2xl border shadow-card divide-y overflow-hidden">
          {[
            { icon: MessageCircle, label: "Live chat", hint: "Avg reply 2 min" },
            { icon: Mail, label: "Email support", hint: "help@pubstore.com" },
            { icon: Phone, label: "Phone", hint: "+1 800 PUBSTORE" },
          ].map((c) => (
            <button key={c.label} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><c.icon className="w-4.5 h-4.5" /></span>
              <div className="flex-1 text-left"><p className="text-sm font-semibold">{c.label}</p><p className="text-[11px] text-muted-foreground">{c.hint}</p></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
