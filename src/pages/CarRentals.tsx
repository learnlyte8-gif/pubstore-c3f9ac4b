import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Car, Key, Gauge, Users, Cog, ShieldCheck, MapPin, Calendar,
  Infinity as InfinityIcon, AlertTriangle, FileText, CircleDollarSign, Sparkles,
  Phone, MessageCircle, Fuel, Cigarette, PawPrint, Globe, Plane, Clock, Snowflake, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchCarRental, fetchCarRentals, CAR_RENTAL_CLASSES, type CarRental } from "@/data/newVerticals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";

export default function CarRentals() {
  const { id } = useParams();
  if (id) return <CarRentalDetail id={id} />;
  return <CarRentalList />;
}

/* ---------------- LIST ---------------- */
function CarRentalList() {
  const [klass, setKlass] = useState<string>("");
  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ["car-rentals", klass],
    queryFn: () => fetchCarRentals({ vehicle_class: klass || undefined, limit: 80 }),
  });

  return (
    <div className="pb-10">
      {/* Hero */}
      <header className="px-4 pt-4 pb-5 bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-500 text-white relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 12px, hsl(0 0% 100% / 1) 12px 14px)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Link to="/home" className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Key className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-tight">Car rentals</h1>
              <p className="text-[11px] opacity-90">Self-drive · Daily · Weekly · Cross-border</p>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Listings" value={String(rentals.length)} />
            <Stat label="Insurance" value="Included" />
            <Stat label="Avg pickup" value="Same day" />
          </div>
        </div>
      </header>

      {/* Class filter */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none px-4 py-2.5">
          <ChipBtn active={!klass} onClick={() => setKlass("")} label="All" />
          {CAR_RENTAL_CLASSES.map((c) => (
            <ChipBtn key={c.slug} active={klass === c.slug} onClick={() => setKlass(c.slug)} label={c.label} />
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 mt-4">
        {isLoading ? (
          <div className="text-center py-10 text-sm text-muted-foreground">Loading fleet…</div>
        ) : rentals.length === 0 ? (
          <EmptyState title="No vehicles yet" description="Be the first to list a car for rent on PUBSTORE." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rentals.map((r) => (
              <CarRentalCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl px-2 py-2 border border-white/20">
      <p className="text-[9px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-sm font-black leading-tight">{value}</p>
    </div>
  );
}

function ChipBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold border transition ${
        active ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function CarRentalCard({ r }: { r: CarRental }) {
  return (
    <Link to={`/car-rentals/${r.id}`} className="block bg-card border rounded-2xl shadow-card overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-[16/10] bg-muted">
        {r.cover && <img src={r.cover} alt={r.title} loading="lazy" className="w-full h-full object-cover" />}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-sm bg-background/90 backdrop-blur text-[9px] font-bold uppercase tracking-wider">
          {r.vehicle_class}
        </span>
        {r.verified && (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-sm bg-emerald-500 text-white text-[9px] font-bold uppercase inline-flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5" /> Verified
          </span>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
          <div className="bg-background/90 backdrop-blur px-2 py-1 rounded-md">
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">From</p>
            <p className="text-base font-black tabular-nums leading-none mt-0.5">
              ${r.price_per_day}<span className="text-[10px] text-muted-foreground">/day</span>
            </p>
          </div>
          {r.unlimited_km ? (
            <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-1 rounded-md inline-flex items-center gap-0.5">
              <InfinityIcon className="w-2.5 h-2.5" /> Unlimited KM
            </span>
          ) : (
            <span className="bg-background/90 backdrop-blur text-[9px] font-bold px-1.5 py-1 rounded-md inline-flex items-center gap-0.5">
              <Gauge className="w-2.5 h-2.5" /> {r.free_km_per_day}km/day
            </span>
          )}
        </div>
      </div>
      <div className="p-3">
        <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
          {r.year ?? ""} · {r.make ?? "—"} {r.model ?? ""}
        </p>
        <p className="font-bold text-sm leading-tight line-clamp-1">{r.title}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Cog className="w-3 h-3" />{r.transmission}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{r.seats}</span>
          <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{r.fuel}</span>
        </div>
        {r.city && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-1">
            <MapPin className="w-2.5 h-2.5" />
            {r.city}{r.country ? `, ${r.country}` : ""}
          </p>
        )}
      </div>
    </Link>
  );
}

/* ---------------- DETAIL ---------------- */
function CarRentalDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [bookOpen, setBookOpen] = useState(false);
  const { data: r, isLoading } = useQuery({
    queryKey: ["car-rental", id],
    queryFn: () => fetchCarRental(id),
  });

  if (isLoading) return <div className="p-10 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></div>;
  if (!r) return <EmptyState title="Vehicle not found" description="It may have been removed." />;

  const youngDriverThreshold = r.young_driver_age_threshold ?? 25;

  return (
    <div className="pb-28">
      {/* Hero gallery */}
      <div className="relative aspect-[16/10] bg-muted">
        {r.cover && <img src={r.cover} alt={r.title} className="w-full h-full object-cover" />}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          {r.verified && (
            <span className="px-2 py-1 rounded-md bg-emerald-500 text-white text-[10px] font-bold inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
          <span className="px-2 py-1 rounded-md bg-background/90 backdrop-blur text-[10px] font-bold uppercase">
            {r.vehicle_class}
          </span>
        </div>
      </div>

      {r.gallery && r.gallery.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 mt-3 -mb-1">
          {r.gallery.slice(0, 8).map((g, i) => (
            <img key={i} src={g} alt="" loading="lazy" className="shrink-0 w-20 h-20 rounded-lg object-cover bg-muted" />
          ))}
        </div>
      )}

      {/* Title + price */}
      <div className="px-4 mt-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {r.year ?? ""} · {r.make ?? "—"} {r.model ?? ""}
        </p>
        <h1 className="text-2xl font-black tracking-tight leading-tight">{r.title}</h1>
        <div className="flex items-baseline gap-2 mt-2">
          <p className="text-3xl font-black tabular-nums">${r.price_per_day}</p>
          <span className="text-sm text-muted-foreground">/ day</span>
          {r.price_per_week && (
            <span className="ml-2 text-[11px] text-muted-foreground">${r.price_per_week}/wk</span>
          )}
          {r.price_per_month && (
            <span className="text-[11px] text-muted-foreground">${r.price_per_month}/mo</span>
          )}
        </div>

        {/* Quick facts strip */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <Fact icon={Cog} label="Trans" value={r.transmission} />
          <Fact icon={Users} label="Seats" value={String(r.seats)} />
          <Fact icon={Fuel} label="Fuel" value={r.fuel} />
          <Fact icon={Snowflake} label="A/C" value={r.ac ? "Yes" : "No"} />
        </div>
      </div>

      {/* Mileage block */}
      <Section icon={Gauge} title="Mileage policy" tint="emerald">
        {r.unlimited_km ? (
          <p className="text-sm font-bold inline-flex items-center gap-1">
            <InfinityIcon className="w-4 h-4 text-emerald-600" /> Unlimited km, drive freely.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <KV label="Free km / day" value={`${r.free_km_per_day} km`} />
            <KV label="Extra km fee" value={r.extra_km_fee != null ? `$${r.extra_km_fee}/km` : "—"} />
          </div>
        )}
      </Section>

      {/* Eligibility */}
      <Section icon={ShieldCheck} title="Eligibility" tint="blue">
        <div className="grid grid-cols-2 gap-3">
          <KV label="Min age" value={`${r.min_age} yrs`} />
          {r.max_age && <KV label="Max age" value={`${r.max_age} yrs`} />}
          <KV label="License held" value={`≥ ${r.min_license_years} yr${r.min_license_years === 1 ? "" : "s"}`} />
          {r.young_driver_fee != null && (
            <KV label={`Under ${youngDriverThreshold} fee`} value={`$${r.young_driver_fee}/day`} />
          )}
          <KV label="Intl. license" value={r.international_license_ok ? "Accepted" : "Not accepted"} />
          <KV label="Cross-border" value={r.cross_border_allowed ? (r.cross_border_fee ? `+$${r.cross_border_fee}` : "Allowed") : "No"} />
        </div>
        {r.required_documents.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Bring on pickup</p>
            <div className="flex flex-wrap gap-1.5">
              {r.required_documents.map((d) => (
                <span key={d} className="text-[10px] font-bold border bg-card px-2 py-1 rounded-md inline-flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5" /> {d.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
        {r.cross_border_allowed && r.cross_border_countries.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Allowed across</p>
            <div className="flex flex-wrap gap-1.5">
              {r.cross_border_countries.map((c) => (
                <span key={c} className="text-[10px] font-bold border bg-card px-2 py-1 rounded-md inline-flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5" /> {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Booking constraints */}
      <Section icon={Calendar} title="Booking & pickup" tint="violet">
        <div className="grid grid-cols-2 gap-3">
          <KV label="Min rental" value={`${r.min_rental_days} day${r.min_rental_days === 1 ? "" : "s"}`} />
          {r.max_rental_days && <KV label="Max rental" value={`${r.max_rental_days} days`} />}
          <KV label="Advance notice" value={`${r.advance_booking_hours} hrs`} />
          <KV label="Fuel policy" value={r.fuel_policy.replace(/_/g, " ")} />
          {r.delivery_available && (
            <KV label="Delivery" value={r.delivery_fee ? `$${r.delivery_fee}` : "Available"} />
          )}
          <KV label="Deposit" value={r.deposit ? `$${r.deposit}` : "None"} />
        </div>
        {r.pickup_locations.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Pickup locations</p>
            <div className="flex flex-wrap gap-1.5">
              {r.pickup_locations.map((p) => (
                <span key={p} className="text-[10px] font-bold border bg-card px-2 py-1 rounded-md inline-flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" /> {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Rules & Penalties — the bold one */}
      <Section icon={AlertTriangle} title="Rules & penalties" tint="rose">
        <div className="grid grid-cols-2 gap-2">
          <RuleCard icon={Cigarette} ok={r.smoking_allowed} label="Smoking" penalty={r.smoking_penalty} />
          <RuleCard icon={PawPrint} ok={r.pets_allowed} label="Pets" penalty={r.pet_penalty} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          {r.late_return_fee_per_hour != null && (
            <KV label="Late return" value={`$${r.late_return_fee_per_hour}/hr`} danger />
          )}
          {r.cleaning_fee != null && <KV label="Cleaning" value={`$${r.cleaning_fee}`} danger />}
          {r.damage_excess != null && <KV label="Damage excess" value={`$${r.damage_excess}`} danger />}
          <KV label="Cancellation" value={r.cancellation_policy} />
          {r.cancellation_fee != null && <KV label="Cancel fee" value={`$${r.cancellation_fee}`} danger />}
        </div>
        {r.custom_rules.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {r.custom_rules.map((rule, i) => (
              <li key={i} className="text-xs flex gap-2">
                <span className="w-4 h-4 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">!</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        )}
        {r.custom_penalties.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Other penalties</p>
            <div className="space-y-1">
              {r.custom_penalties.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    ${p.amount}{p.currency ? ` ${p.currency}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Insurance */}
      <Section icon={ShieldCheck} title="Insurance" tint="emerald">
        <p className="text-sm">
          {r.insurance_included ? "Included " : "Not included "}
          {r.insurance_provider ? `· ${r.insurance_provider}` : ""}
        </p>
        {r.insurance_options.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {r.insurance_options.map((o, i) => (
              <div key={i} className="flex items-center justify-between text-xs border rounded-lg px-3 py-2">
                <span>{o.label}</span>
                <span className="font-bold">+${o.price_per_day}/day</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Features */}
      {r.features.length > 0 && (
        <Section icon={Sparkles} title="Features" tint="amber">
          <div className="flex flex-wrap gap-1.5">
            {r.features.map((f) => (
              <span key={f} className="text-[10px] font-bold border bg-card px-2 py-1 rounded-md">{f}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Description */}
      {r.description && (
        <Section icon={FileText} title="About this car" tint="zinc">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{r.description}</p>
        </Section>
      )}

      {/* Sticky CTA */}
      <div className="fixed bottom-16 left-0 right-0 px-3 z-30">
        <div className="max-w-md mx-auto bg-card/95 backdrop-blur border shadow-lg rounded-2xl p-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">From</p>
            <p className="text-lg font-black tabular-nums leading-none">${r.price_per_day}<span className="text-xs text-muted-foreground">/day</span></p>
          </div>
          {r.contact_whatsapp && (
            <a
              href={`https://wa.me/${r.contact_whatsapp.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          )}
          {r.contact_phone && (
            <a
              href={`tel:${r.contact_phone}`}
              className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          <Button onClick={() => setBookOpen(true)} className="flex-1 h-10 font-bold">
            <Calendar className="w-4 h-4 mr-1" /> Book now
          </Button>
        </div>
      </div>

      {bookOpen && <BookingDialog rental={r} onClose={() => setBookOpen(false)} />}
    </div>
  );
}

function Section({ icon: Icon, title, tint, children }: { icon: any; title: string; tint: "emerald" | "blue" | "violet" | "rose" | "amber" | "zinc"; children: React.ReactNode }) {
  const tints: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    zinc: "bg-muted text-foreground",
  };
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tints[tint]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <h2 className="font-bold text-sm">{title}</h2>
      </div>
      <div className="bg-card border rounded-2xl p-3.5 shadow-card">{children}</div>
    </section>
  );
}

function KV({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold capitalize ${danger ? "text-rose-600 dark:text-rose-400 tabular-nums" : ""}`}>{value}</p>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-card border rounded-xl p-2 text-center">
      <Icon className="w-3.5 h-3.5 mx-auto text-muted-foreground" />
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
      <p className="text-xs font-bold capitalize">{value}</p>
    </div>
  );
}

function RuleCard({ icon: Icon, ok, label, penalty }: { icon: any; ok: boolean; label: string; penalty: number | null }) {
  return (
    <div className={`border rounded-xl p-2.5 ${ok ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
      <div className="flex items-center justify-between">
        <Icon className={`w-4 h-4 ${ok ? "text-emerald-600" : "text-rose-600"}`} />
        <span className={`text-[9px] font-black uppercase tracking-wider ${ok ? "text-emerald-600" : "text-rose-600"}`}>
          {ok ? "Allowed" : "No"}
        </span>
      </div>
      <p className="text-xs font-bold mt-1">{label}</p>
      {!ok && penalty != null && (
        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold tabular-nums">${penalty} penalty</p>
      )}
    </div>
  );
}

/* ---------------- Booking dialog ---------------- */
function BookingDialog({ rental, onClose }: { rental: CarRental; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    pickup_at: "",
    return_at: "",
    pickup_location: rental.pickup_locations[0] ?? "",
    dropoff_location: "",
    delivery_requested: false,
    expected_km: "",
    cross_border: false,
    cross_border_destination: "",
    renter_age: "",
    license_years: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Compute estimate
  const days =
    f.pickup_at && f.return_at
      ? Math.max(1, Math.ceil((new Date(f.return_at).getTime() - new Date(f.pickup_at).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
  const base = days * rental.price_per_day;
  const youngExtra =
    f.renter_age && rental.young_driver_fee != null && rental.young_driver_age_threshold != null && Number(f.renter_age) < rental.young_driver_age_threshold
      ? rental.young_driver_fee * days
      : 0;
  const delivery = f.delivery_requested && rental.delivery_fee ? rental.delivery_fee : 0;
  const cross = f.cross_border && rental.cross_border_fee ? rental.cross_border_fee : 0;
  const estimated = base + youngExtra + delivery + cross;

  const submit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in to book"); return; }
    if (!f.pickup_at || !f.return_at) { toast.error("Pick dates"); return; }
    if (days < rental.min_rental_days) { toast.error(`Minimum ${rental.min_rental_days} day(s)`); return; }
    if (rental.max_rental_days && days > rental.max_rental_days) { toast.error(`Maximum ${rental.max_rental_days} day(s)`); return; }
    if (f.renter_age && Number(f.renter_age) < rental.min_age) { toast.error(`Must be ${rental.min_age}+`); return; }

    setSaving(true);
    const { error } = await supabase.from("car_rental_bookings").insert({
      rental_id: rental.id,
      renter_id: user.id,
      renter_email: user.email,
      pickup_at: f.pickup_at,
      return_at: f.return_at,
      pickup_location: f.pickup_location || null,
      dropoff_location: f.dropoff_location || null,
      delivery_requested: f.delivery_requested,
      expected_km: f.expected_km ? Number(f.expected_km) : null,
      cross_border: f.cross_border,
      cross_border_destination: f.cross_border_destination || null,
      renter_age: f.renter_age ? Number(f.renter_age) : null,
      license_years: f.license_years ? Number(f.license_years) : null,
      notes: f.notes || null,
      estimated_total: estimated,
      currency: rental.currency,
      status: "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Booking sent — the host will confirm shortly");
    qc.invalidateQueries({ queryKey: ["car-rental-bookings"] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Book this car</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pickup" type="datetime-local" value={f.pickup_at} onChange={(v) => setF({ ...f, pickup_at: v })} />
            <Field label="Return" type="datetime-local" value={f.return_at} onChange={(v) => setF({ ...f, return_at: v })} />
          </div>
          {rental.pickup_locations.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickup location</label>
              <select
                value={f.pickup_location}
                onChange={(e) => setF({ ...f, pickup_location: e.target.value })}
                className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1"
              >
                {rental.pickup_locations.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          <Field label="Drop-off (if different)" value={f.dropoff_location} onChange={(v) => setF({ ...f, dropoff_location: v })} />

          {rental.delivery_available && (
            <ToggleRow
              label={`Deliver to me${rental.delivery_fee ? ` (+$${rental.delivery_fee})` : ""}`}
              value={f.delivery_requested}
              onChange={(v) => setF({ ...f, delivery_requested: v })}
            />
          )}
          {rental.cross_border_allowed && (
            <>
              <ToggleRow
                label={`Cross-border trip${rental.cross_border_fee ? ` (+$${rental.cross_border_fee})` : ""}`}
                value={f.cross_border}
                onChange={(v) => setF({ ...f, cross_border: v })}
              />
              {f.cross_border && (
                <Field label="Destination country" value={f.cross_border_destination} onChange={(v) => setF({ ...f, cross_border_destination: v })} />
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Your age" type="number" value={f.renter_age} onChange={(v) => setF({ ...f, renter_age: v })} />
            <Field label="License (yrs)" type="number" value={f.license_years} onChange={(v) => setF({ ...f, license_years: v })} />
          </div>
          <Field label="Expected km" type="number" value={f.expected_km} onChange={(v) => setF({ ...f, expected_km: v })} />
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
            <textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              rows={2}
              className="w-full rounded-xl border bg-background p-3 text-sm mt-1"
            />
          </div>

          {/* Estimate */}
          {days > 0 && (
            <div className="bg-muted/60 rounded-xl p-3 space-y-1 text-xs">
              <Row label={`Base (${days} day${days === 1 ? "" : "s"})`} value={`$${base.toFixed(2)}`} />
              {youngExtra > 0 && <Row label="Young driver" value={`+$${youngExtra.toFixed(2)}`} />}
              {delivery > 0 && <Row label="Delivery" value={`+$${delivery.toFixed(2)}`} />}
              {cross > 0 && <Row label="Cross-border" value={`+$${cross.toFixed(2)}`} />}
              <div className="border-t pt-1.5 flex justify-between font-black text-sm">
                <span>Estimated total</span>
                <span className="tabular-nums">${estimated.toFixed(2)}</span>
              </div>
              {rental.deposit > 0 && (
                <p className="text-[10px] text-muted-foreground">+ ${rental.deposit} refundable deposit</p>
              )}
            </div>
          )}

          <Button onClick={submit} disabled={saving} className="w-full h-11">
            {saving ? "Sending…" : "Request booking"}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            By booking you accept the host's rules, mileage policy and penalties.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1"
      />
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between border rounded-xl px-3 py-2.5 cursor-pointer">
      <span className="text-sm font-medium">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
