import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Country = { name: string; iso2: string; dial: string; flag: string };

// Curated list — covers majority of users. Add more as needed.
export const COUNTRIES: Country[] = [
  { name: "United States", iso2: "US", dial: "1", flag: "🇺🇸" },
  { name: "United Kingdom", iso2: "GB", dial: "44", flag: "🇬🇧" },
  { name: "India", iso2: "IN", dial: "91", flag: "🇮🇳" },
  { name: "Canada", iso2: "CA", dial: "1", flag: "🇨🇦" },
  { name: "Australia", iso2: "AU", dial: "61", flag: "🇦🇺" },
  { name: "Germany", iso2: "DE", dial: "49", flag: "🇩🇪" },
  { name: "France", iso2: "FR", dial: "33", flag: "🇫🇷" },
  { name: "Spain", iso2: "ES", dial: "34", flag: "🇪🇸" },
  { name: "Italy", iso2: "IT", dial: "39", flag: "🇮🇹" },
  { name: "Netherlands", iso2: "NL", dial: "31", flag: "🇳🇱" },
  { name: "Portugal", iso2: "PT", dial: "351", flag: "🇵🇹" },
  { name: "Ireland", iso2: "IE", dial: "353", flag: "🇮🇪" },
  { name: "Belgium", iso2: "BE", dial: "32", flag: "🇧🇪" },
  { name: "Switzerland", iso2: "CH", dial: "41", flag: "🇨🇭" },
  { name: "Sweden", iso2: "SE", dial: "46", flag: "🇸🇪" },
  { name: "Norway", iso2: "NO", dial: "47", flag: "🇳🇴" },
  { name: "Denmark", iso2: "DK", dial: "45", flag: "🇩🇰" },
  { name: "Finland", iso2: "FI", dial: "358", flag: "🇫🇮" },
  { name: "Poland", iso2: "PL", dial: "48", flag: "🇵🇱" },
  { name: "Czechia", iso2: "CZ", dial: "420", flag: "🇨🇿" },
  { name: "Greece", iso2: "GR", dial: "30", flag: "🇬🇷" },
  { name: "Turkey", iso2: "TR", dial: "90", flag: "🇹🇷" },
  { name: "Russia", iso2: "RU", dial: "7", flag: "🇷🇺" },
  { name: "China", iso2: "CN", dial: "86", flag: "🇨🇳" },
  { name: "Hong Kong", iso2: "HK", dial: "852", flag: "🇭🇰" },
  { name: "Singapore", iso2: "SG", dial: "65", flag: "🇸🇬" },
  { name: "Japan", iso2: "JP", dial: "81", flag: "🇯🇵" },
  { name: "South Korea", iso2: "KR", dial: "82", flag: "🇰🇷" },
  { name: "Indonesia", iso2: "ID", dial: "62", flag: "🇮🇩" },
  { name: "Malaysia", iso2: "MY", dial: "60", flag: "🇲🇾" },
  { name: "Thailand", iso2: "TH", dial: "66", flag: "🇹🇭" },
  { name: "Vietnam", iso2: "VN", dial: "84", flag: "🇻🇳" },
  { name: "Philippines", iso2: "PH", dial: "63", flag: "🇵🇭" },
  { name: "Pakistan", iso2: "PK", dial: "92", flag: "🇵🇰" },
  { name: "Bangladesh", iso2: "BD", dial: "880", flag: "🇧🇩" },
  { name: "Sri Lanka", iso2: "LK", dial: "94", flag: "🇱🇰" },
  { name: "Nepal", iso2: "NP", dial: "977", flag: "🇳🇵" },
  { name: "UAE", iso2: "AE", dial: "971", flag: "🇦🇪" },
  { name: "Saudi Arabia", iso2: "SA", dial: "966", flag: "🇸🇦" },
  { name: "Qatar", iso2: "QA", dial: "974", flag: "🇶🇦" },
  { name: "Kuwait", iso2: "KW", dial: "965", flag: "🇰🇼" },
  { name: "Bahrain", iso2: "BH", dial: "973", flag: "🇧🇭" },
  { name: "Oman", iso2: "OM", dial: "968", flag: "🇴🇲" },
  { name: "Israel", iso2: "IL", dial: "972", flag: "🇮🇱" },
  { name: "Algeria", iso2: "DZ", dial: "213", flag: "🇩🇿" },
  { name: "Angola", iso2: "AO", dial: "244", flag: "🇦🇴" },
  { name: "Botswana", iso2: "BW", dial: "267", flag: "🇧🇼" },
  { name: "Cameroon", iso2: "CM", dial: "237", flag: "🇨🇲" },
  { name: "Côte d'Ivoire", iso2: "CI", dial: "225", flag: "🇨🇮" },
  { name: "Egypt", iso2: "EG", dial: "20", flag: "🇪🇬" },
  { name: "Ethiopia", iso2: "ET", dial: "251", flag: "🇪🇹" },
  { name: "Ghana", iso2: "GH", dial: "233", flag: "🇬🇭" },
  { name: "Kenya", iso2: "KE", dial: "254", flag: "🇰🇪" },
  { name: "Madagascar", iso2: "MG", dial: "261", flag: "🇲🇬" },
  { name: "Malawi", iso2: "MW", dial: "265", flag: "🇲🇼" },
  { name: "Mali", iso2: "ML", dial: "223", flag: "🇲🇱" },
  { name: "Mauritius", iso2: "MU", dial: "230", flag: "🇲🇺" },
  { name: "Morocco", iso2: "MA", dial: "212", flag: "🇲🇦" },
  { name: "Mozambique", iso2: "MZ", dial: "258", flag: "🇲🇿" },
  { name: "Namibia", iso2: "NA", dial: "264", flag: "🇳🇦" },
  { name: "Nigeria", iso2: "NG", dial: "234", flag: "🇳🇬" },
  { name: "Rwanda", iso2: "RW", dial: "250", flag: "🇷🇼" },
  { name: "Senegal", iso2: "SN", dial: "221", flag: "🇸🇳" },
  { name: "Seychelles", iso2: "SC", dial: "248", flag: "🇸🇨" },
  { name: "South Africa", iso2: "ZA", dial: "27", flag: "🇿🇦" },
  { name: "Tanzania", iso2: "TZ", dial: "255", flag: "🇹🇿" },
  { name: "Tunisia", iso2: "TN", dial: "216", flag: "🇹🇳" },
  { name: "Uganda", iso2: "UG", dial: "256", flag: "🇺🇬" },
  { name: "Zambia", iso2: "ZM", dial: "260", flag: "🇿🇲" },
  { name: "Zimbabwe", iso2: "ZW", dial: "263", flag: "🇿🇼" },
  { name: "Brazil", iso2: "BR", dial: "55", flag: "🇧🇷" },
  { name: "Mexico", iso2: "MX", dial: "52", flag: "🇲🇽" },
  { name: "Argentina", iso2: "AR", dial: "54", flag: "🇦🇷" },
  { name: "Chile", iso2: "CL", dial: "56", flag: "🇨🇱" },
  { name: "Colombia", iso2: "CO", dial: "57", flag: "🇨🇴" },
  { name: "Peru", iso2: "PE", dial: "51", flag: "🇵🇪" },
  { name: "New Zealand", iso2: "NZ", dial: "64", flag: "🇳🇿" },
];

export const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.iso2 === "US")!;

interface PhoneInputProps {
  country: Country;
  onCountryChange: (c: Country) => void;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PhoneInput({
  country,
  onCountryChange,
  value,
  onChange,
  placeholder = "Phone number",
  disabled,
  className,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.dial.includes(q.replace(/\D/g, "")),
    );
  }, [query]);

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="h-12 inline-flex items-center gap-1.5 px-3 rounded-md border border-border bg-input text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
            aria-label="Select country code"
          >
            <span className="text-lg leading-none">{country.flag}</span>
            <span className="text-foreground">+{country.dial}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-[280px]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground text-center">No match</li>
            ) : (
              filtered.map((c) => {
                const selected = c.iso2 === country.iso2 && c.dial === country.dial;
                return (
                  <li key={`${c.iso2}-${c.dial}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onCountryChange(c);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent text-left",
                        selected && "bg-accent",
                      )}
                    >
                      <span className="text-lg leading-none">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">+{c.dial}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d\s-]/g, ""))}
        placeholder={placeholder}
        disabled={disabled}
        className="h-12 flex-1 bg-input border-border text-sm rounded-md"
      />
    </div>
  );
}

export function toE164(dial: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  if (!digits) return "";
  return `+${dial}${digits}`;
}
