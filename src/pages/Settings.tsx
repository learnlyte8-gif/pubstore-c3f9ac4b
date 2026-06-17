import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Globe, Moon, Sun, Monitor, DollarSign, Languages, Smartphone, Palette, ChevronRight, Sparkles, Check, MessageCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { INTERESTS } from "@/data/interests";
import { useMyInterests } from "@/hooks/useInterests";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [currency, setCurrency] = useState("USD");
  const [language, setLanguage] = useState("English");
  const { interests, save: saveInterests, userId } = useMyInterests();
  const [testingWa, setTestingWa] = useState(false);

  const sendTestWhatsApp = async () => {
    setTestingWa(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-whatsapp");
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Couldn't send test");
      } else {
        toast.success("Test WhatsApp sent — check your phone");
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send test");
    } finally {
      setTestingWa(false);
    }
  };

  const toggleInterest = async (item: string) => {
    if (!userId) {
      toast.error("Sign in to update your interests");
      return;
    }
    const has = interests.includes(item);
    if (!has && interests.length >= 8) {
      toast.error("Maximum 8 interests");
      return;
    }
    const next = has ? interests.filter((x) => x !== item) : [...interests, item];
    await saveInterests(next);
    toast.success(has ? "Removed from interests" : "Added to interests");
  };



  return (
    <div className="">
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

        <Section title="Personalization">
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Sparkles className="w-4.5 h-4.5" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Your interests</p>
                <p className="text-[11px] text-muted-foreground">Drives your home & categories feed · {interests.length}/8 selected</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((item) => {
                const active = interests.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => toggleInterest(item)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-pop"
                        : "bg-muted/40 border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {active && <Check className="w-3 h-3" strokeWidth={3} />}
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Notifications">
          <Link to="/settings/notifications" className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Bell className="w-4.5 h-4.5" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Notification preferences</p>
              <p className="text-[11px] text-muted-foreground">In-app, push, and email — choose what reaches you</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center"><MessageCircle className="w-4.5 h-4.5" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Test WhatsApp</p>
              <p className="text-[11px] text-muted-foreground">Send a test message to the phone on your profile</p>
            </div>
            <Button size="sm" onClick={sendTestWhatsApp} disabled={testingWa}>
              {testingWa ? "Sending…" : "Send test"}
            </Button>
          </div>
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
