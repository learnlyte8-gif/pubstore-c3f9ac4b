import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, Download, Trash2, Smartphone, Key, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Privacy() {
  const [twoFA, setTwoFA] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [adsPersonalization, setAdsPersonalization] = useState(true);
  const [activityTracking, setActivityTracking] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);

  return (
    <div className="">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Privacy & security</h1>
      </header>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground rounded-2xl p-4 shadow-elevated flex items-center gap-3">
          <Shield className="w-8 h-8" />
          <div className="flex-1">
            <p className="font-bold">Account protected</p>
            <p className="text-xs opacity-90">Last security check: today</p>
          </div>
        </div>

        <Section title="Security">
          <Toggle icon={Lock} label="Two-factor authentication" hint="Required at sign-in" v={twoFA} on={setTwoFA} />
          <Toggle icon={Smartphone} label="Biometric unlock" hint="Face ID / fingerprint" v={biometric} on={setBiometric} />
          <Action icon={Key} label="Change password" hint="Last changed 3 months ago" onClick={() => toast.info("Open password flow")} />
          <Action icon={Eye} label="Login activity" hint="View recent sessions" onClick={() => toast.info("4 active sessions")} />
        </Section>

        <Section title="Data & personalization">
          <Toggle icon={Eye} label="Personalized ads" hint="Based on your activity" v={adsPersonalization} on={setAdsPersonalization} />
          <Toggle icon={Smartphone} label="Activity tracking" hint="Improves recommendations" v={activityTracking} on={setActivityTracking} />
          <Toggle icon={Shield} label="Data sharing with partners" hint="Off by default" v={dataSharing} on={setDataSharing} />
        </Section>

        <Section title="Your data">
          <Action icon={Download} label="Download my data" hint="Get a copy of your info" onClick={() => toast.success("Export queued — we'll email you")} />
          <Action icon={Trash2} label="Delete my account" hint="Permanently remove account" danger onClick={() => toast.warning("This action requires confirmation")} />
        </Section>

        <div className="bg-muted rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">Pubstore complies with GDPR & CCPA. Read our <span className="text-primary font-bold">Privacy Policy</span> and <span className="text-primary font-bold">Terms of Service</span>.</p>
        </div>
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

function Toggle({ icon: Icon, label, hint, v, on }: { icon: any; label: string; hint?: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></span>
      <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{label}</p>{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>
      <Switch checked={v} onCheckedChange={on} />
    </div>
  );
}

function Action({ icon: Icon, label, hint, onClick, danger }: { icon: any; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 text-left">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><Icon className="w-4.5 h-4.5" /></span>
      <div className="flex-1 min-w-0"><p className={`text-sm font-semibold ${danger ? "text-destructive" : ""}`}>{label}</p>{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>
    </button>
  );
}
