import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Globe, Moon, Sun, Monitor, DollarSign, Languages, Volume2, Smartphone, Palette, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  const [sound, setSound] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [priceDrops, setPriceDrops] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [language, setLanguage] = useState("English");

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Settings</h1>
      </header>

      <div className="px-4 py-4 space-y-4">
        <Section title="Appearance">
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Palette className="w-4.5 h-4.5" /></span>
              <p className="text-sm font-semibold flex-1">Theme</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "light", label: "Light", icon: Sun },
                { v: "dark", label: "Dark", icon: Moon },
                { v: "system", label: "System", icon: Monitor },
              ].map((o) => (
                <button key={o.v} onClick={() => setTheme(o.v)} className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition ${theme === o.v ? "border-primary bg-primary/5" : "border-border bg-muted/40"}`}>
                  <o.icon className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Notifications">
          <Toggle icon={Bell} label="Push notifications" v={push} on={setPush} />
          <Toggle icon={Smartphone} label="Email updates" v={email} on={setEmail} />
          <Toggle icon={Volume2} label="Sound & vibration" v={sound} on={setSound} />
          <Toggle icon={Bell} label="Order status alerts" v={orderAlerts} on={setOrderAlerts} />
          <Toggle icon={DollarSign} label="Price drops on wishlist" v={priceDrops} on={setPriceDrops} />
          <Toggle icon={Bell} label="Marketing emails" v={marketing} on={setMarketing} />
        </Section>

        <Section title="Region">
          <Picker icon={Languages} label="Language" value={language} options={["English", "Français", "Español", "中文", "العربية", "Kiswahili"]} onChange={setLanguage} />
          <Picker icon={DollarSign} label="Currency" value={currency} options={["USD", "EUR", "GBP", "KES", "CNY"]} onChange={setCurrency} />
          <Row icon={Globe} label="Country" value="Kenya" />
        </Section>

        <Section title="About">
          <Row icon={Smartphone} label="App version" value="1.0.0" />
          <Link to="#" className="block px-4 py-3.5 hover:bg-muted/40 text-sm font-semibold">Terms of service</Link>
          <Link to="#" className="block px-4 py-3.5 hover:bg-muted/40 text-sm font-semibold">Privacy policy</Link>
          <Link to="#" className="block px-4 py-3.5 hover:bg-muted/40 text-sm font-semibold">Open source licenses</Link>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</p>
      <div className="bg-card rounded-2xl border shadow-card divide-y overflow-hidden">{children}</div>
    </div>
  );
}

function Toggle({ icon: Icon, label, v, on }: { icon: any; label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></span>
      <p className="text-sm font-semibold flex-1">{label}</p>
      <Switch checked={v} onCheckedChange={on} />
    </div>
  );
}

function Picker({ icon: Icon, label, value, options, onChange }: { icon: any; label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></span>
      <p className="text-sm font-semibold flex-1">{label}</p>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-muted rounded-lg px-2 py-1.5 text-xs font-semibold border-0 outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></span>
      <p className="text-sm font-semibold flex-1">{label}</p>
      <p className="text-xs text-muted-foreground font-medium">{value}</p>
    </div>
  );
}
