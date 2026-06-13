export default function SponsoredBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/70 text-[9px] font-bold uppercase tracking-wider ${className}`}>
      Ad
    </span>
  );
}
