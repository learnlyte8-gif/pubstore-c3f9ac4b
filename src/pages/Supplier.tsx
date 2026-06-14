import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ShieldCheck, Award, MessageCircle, Clock, Truck, Star, MapPin, Calendar, Package, FileText, Share2, Heart, Globe, ClipboardCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSupplier, useProducts } from "@/hooks/useCatalog";
import ProductCard from "@/components/marketplace/ProductCard";
import SupplierLocationMap from "@/components/SupplierLocationMap";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ShareToChatSheet from "@/components/chat/ShareToChatSheet";
import SupplierCertifications from "@/components/marketplace/SupplierCertifications";
import SupplierInspectionReports from "@/components/marketplace/SupplierInspectionReports";
import type { ChatAttachment } from "@/components/chat/AttachmentCard";
import CircleSpinner from "@/components/CircleSpinner";

export default function Supplier() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: supplier, isLoading } = useSupplier(id);
  const { data: products = [] } = useProducts({ supplierId: id });
  const [tab, setTab] = useState<"products" | "about" | "certs" | "inspections">("products");
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [supplierOwner, setSupplierOwner] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareKind, setShareKind] = useState<"supplier" | "catalog">("supplier");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      setUserId(user?.id ?? null);

      const [{ count }, ownerRes, followRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact", head: true }).eq("supplier_id", id),
        supabase.from("suppliers").select("owner_id").eq("id", id).maybeSingle(),
        user
          ? supabase.from("followers").select("id").eq("supplier_id", id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as { data: null }),
      ]);
      if (!alive) return;
      setFollowerCount(count ?? 0);
      setSupplierOwner(ownerRes.data?.owner_id ?? null);
      setFollowing(!!followRes.data);
    })();
    return () => { alive = false; };
  }, [id]);

  const toggleFollow = async () => {
    if (!id) return;
    if (!userId) {
      toast.message("Sign in to follow", { description: "Create a free account to follow stores." });
      navigate(`/auth?redirect=${encodeURIComponent(`/supplier/${id}`)}`);
      return;
    }
    if (following) {
      setFollowing(false);
      setFollowerCount((n) => Math.max(0, n - 1));
      await supabase.from("followers").delete().eq("supplier_id", id).eq("user_id", userId);
    } else {
      setFollowing(true);
      setFollowerCount((n) => n + 1);
      await supabase.from("followers").insert({ supplier_id: id, user_id: userId });
      if (supplierOwner && supplierOwner !== userId) {
        await supabase.from("notifications").insert({
          user_id: supplierOwner, type: "follower",
          title: "New follower", body: "Someone just followed your store.", link: `/supplier/${id}`,
        });
      }
    }
  };

  if (isLoading) return <p className="p-12 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>;

  if (!supplier) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Supplier not found.</p>
        <Link to="/home" className="text-primary text-sm font-semibold mt-2 inline-block">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="relative h-40 bg-muted overflow-hidden">
        <img src={supplier.banner} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center shadow-card">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-2">
            <button
              aria-label="Share supplier"
              onClick={() => { setShareKind("supplier"); setShareOpen(true); }}
              className="w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center shadow-card"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              aria-label="Share catalog"
              onClick={() => { setShareKind("catalog"); setShareOpen(true); }}
              className="h-9 px-3 rounded-full bg-ig-gradient text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-pop"
            >
              <Package className="w-3.5 h-3.5" /> Catalog
            </button>
            <button onClick={toggleFollow} aria-label={following ? "Unfollow" : "Follow"} className="w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center shadow-card">
              <Heart className={`w-4 h-4 ${following ? "fill-destructive text-destructive" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative">
        <div className="flex items-end gap-3">
          <img src={supplier.logo} alt={supplier.name} className="w-20 h-20 rounded-2xl object-cover border-4 border-background shadow-elevated bg-card" />
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap gap-1">
              {supplier.verified && <Badge icon={ShieldCheck} label="Verified" tone="primary" />}
              {supplier.gold && <Badge icon={Award} label="Gold" tone="gold" />}
              {supplier.tradeAssurance && <Badge icon={ShieldCheck} label="Trade Assured" tone="success" />}
            </div>
          </div>
        </div>

        <h1 className="text-lg font-bold mt-2 leading-tight">{supplier.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {supplier.country}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {supplier.yearsActive} yrs on PUBSTORE</span>
          <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-amber-500 text-amber-500" /><span className="font-medium text-foreground">{supplier.rating.toFixed(1)}</span></span>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {followerCount} follower{followerCount === 1 ? "" : "s"}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link to={`/messages?supplier=${supplier.id}`} className="h-10 rounded-full bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 shadow-pop">
            <MessageCircle className="w-4 h-4" /> Contact
          </Link>
          <Link to="/rfq" className="h-10 rounded-full bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-1.5 shadow-card">
            <FileText className="w-4 h-4" /> RFQ
          </Link>
          <button onClick={toggleFollow} className={`h-10 rounded-full font-semibold text-sm flex items-center justify-center gap-1.5 shadow-card ${following ? "bg-destructive/10 text-destructive" : "bg-card border border-border"}`}>
            <Heart className={`w-4 h-4 ${following ? "fill-destructive" : ""}`} /> {following ? "Following" : "Follow"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-card border border-border shadow-card p-3">
          <Stat icon={MessageCircle} value={`${supplier.responseRate}%`} label="Response" />
          <Stat icon={Clock} value={supplier.responseTime} label="Reply time" />
          <Stat icon={Truck} value={`${supplier.onTimeDelivery}%`} label="On-time" />
        </div>
      </div>

      <div className="mt-5 px-4 border-b border-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <TabBtn active={tab === "products"} onClick={() => setTab("products")}>Products ({products.length})</TabBtn>
          <TabBtn active={tab === "about"} onClick={() => setTab("about")}>About</TabBtn>
          <TabBtn active={tab === "certs"} onClick={() => setTab("certs")}>Certifications</TabBtn>
          <TabBtn active={tab === "inspections"} onClick={() => setTab("inspections")}>Inspections</TabBtn>
        </div>
      </div>

      {tab === "products" && (
        <div className="px-4 mt-4">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No products listed yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      )}

      {tab === "about" && (
        <div className="px-4 mt-4 space-y-3">
          <div className="rounded-2xl bg-card border border-border shadow-card p-4">
            <h3 className="text-sm font-bold mb-1.5 flex items-center gap-1.5"><Package className="w-4 h-4 text-primary" /> Company overview</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{supplier.about || "No company description yet."}</p>
          </div>
          {supplier.latitude != null && supplier.longitude != null && (
            <SupplierLocationMap
              lat={supplier.latitude}
              lng={supplier.longitude}
              address={supplier.locationAddress}
              name={supplier.name}
            />
          )}
          <div className="rounded-2xl bg-card border border-border shadow-card p-4">
            <h3 className="text-sm font-bold mb-2">Business details</h3>
            <ul className="text-xs space-y-2">
              <Row label="Country / Region" value={`${supplier.country} (${supplier.countryCode})`} />
              <Row label="Years active" value={`${supplier.yearsActive} years`} />
              <Row label="Response rate" value={`${supplier.responseRate}%`} />
              <Row label="Avg. reply time" value={supplier.responseTime} />
              <Row label="On-time delivery" value={`${supplier.onTimeDelivery}%`} />
              <Row label="Rating" value={`${supplier.rating.toFixed(1)} / 5`} />
              <Row label="Followers" value={`${followerCount}`} />
            </ul>
          </div>
          {supplier.exportCountries && supplier.exportCountries.length > 0 && (
            <div className="rounded-2xl bg-card border border-border shadow-card p-4">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5"><Globe className="w-4 h-4 text-primary" /> Export countries</h3>
              <div className="flex flex-wrap gap-1.5">
                {supplier.exportCountries.map((c) => (
                  <span key={c} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "certs" && supplier && (
        <div className="px-4 mt-4">
          <SupplierCertifications
            supplierId={supplier.id}
            canManage={!!userId && !!supplierOwner && userId === supplierOwner}
          />
        </div>
      )}

      {tab === "inspections" && supplier && (
        <div className="px-4 mt-4">
          <SupplierInspectionReports
            supplierId={supplier.id}
            canManage={!!userId && !!supplierOwner && userId === supplierOwner}
          />
        </div>
      )}

      {supplier && (
        <ShareToChatSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          attachment={
            shareKind === "supplier"
              ? ({
                  kind: "supplier",
                  id: supplier.id,
                  name: supplier.name,
                  logo: supplier.logo,
                  verified: supplier.verified,
                  tagline: supplier.country ?? undefined,
                } as ChatAttachment)
              : ({
                  kind: "catalog",
                  supplierId: supplier.id,
                  supplierName: supplier.name,
                  count: products.length,
                  items: products.slice(0, 4).map((p) => ({
                    id: p.id, title: p.title, image: p.image, price: p.price,
                  })),
                } as ChatAttachment)
          }
        />
      )}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof ShieldCheck; value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function Badge({ icon: Icon, label, tone }: { icon: typeof ShieldCheck; label: string; tone: "primary" | "gold" | "success" }) {
  const tones = {
    primary: "bg-primary/15 text-primary backdrop-blur",
    gold: "bg-amber-500/20 text-amber-700 dark:text-amber-300 backdrop-blur",
    success: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 backdrop-blur",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-soft ${tones[tone]}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 h-10 text-sm font-semibold border-b-2 transition ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </li>
  );
}
