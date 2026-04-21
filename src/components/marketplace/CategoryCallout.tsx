import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function CategoryCallout({
  title,
  subtitle,
  href,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  tone?: "primary" | "warm" | "fresh" | "ink";
}) {
  const tones: Record<string, string> = {
    primary: "bg-gradient-to-br from-primary via-indigo-500 to-violet-600 text-primary-foreground",
    warm: "bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 text-white",
    fresh: "bg-gradient-to-br from-emerald-400 via-teal-500 to-sky-500 text-white",
    ink: "bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-white",
  };
  return (
    <Link
      to={href}
      className={`relative col-span-2 rounded-2xl overflow-hidden p-3.5 shadow-card hover:shadow-elevated transition block ${tones[tone]}`}
    >
      <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/15 blur-xl" />
      <div className="relative flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" strokeWidth={2.4} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">{subtitle}</p>
          <p className="text-sm font-extrabold leading-tight line-clamp-2 mt-0.5">{title}</p>
        </div>
        <ArrowRight className="w-4 h-4 shrink-0 opacity-90" />
      </div>
    </Link>
  );
}
