import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, BedDouble, Car, Factory, Sprout, Home as HomeIcon, Banknote, Wrench } from "lucide-react";
import ServiceActionsTab from "@/components/marketplace/ServiceActionsTab";

const SECTIONS = [
  { id: "stays", label: "Stays", icon: BedDouble },
  { id: "car-rentals", label: "Car rentals", icon: Car },
  { id: "vehicles", label: "Vehicles", icon: Car },
  { id: "properties", label: "Real estate", icon: HomeIcon },
  { id: "finance", label: "Finance", icon: Banknote },
  { id: "industrial", label: "Industrial", icon: Factory },
  { id: "agro", label: "Agro", icon: Sprout },
  { id: "pros", label: "Local services", icon: Wrench },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function StoreActions() {
  const [params] = useSearchParams();
  const initial = (SECTIONS.find((s) => s.id === params.get("section"))?.id ?? "stays") as SectionId;
  const [section, setSection] = useState<SectionId>(initial);
  const focusId = params.get("id") || undefined;

  // If notification opens this page later with a new ?section= , sync state.
  useEffect(() => {
    const next = SECTIONS.find((s) => s.id === params.get("section"))?.id as SectionId | undefined;
    if (next && next !== section) setSection(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/store" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base leading-tight truncate">Actions inbox</h1>
          <p className="text-[11px] text-muted-foreground truncate">All buyer requests across your services</p>
        </div>
      </header>

      <div className="px-3 pt-3 flex gap-1.5 overflow-x-auto scrollbar-none">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = s.id === section;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`shrink-0 h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 border transition ${active ? "bg-foreground text-background border-foreground" : "bg-card"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      <ServiceActionsTab section={section} focusId={focusId} />
    </div>
  );
}
