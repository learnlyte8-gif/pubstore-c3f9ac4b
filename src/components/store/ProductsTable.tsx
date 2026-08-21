import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import CircleSpinner from "@/components/CircleSpinner";
import EmptyState from "@/components/EmptyState";
import {
  ArrowDown, ArrowUp, Eye, EyeOff, Package, Pencil, Plus, Search, Star, Tag, Trash2,
} from "lucide-react";

type Row = {
  id: string;
  title: string;
  image: string | null;
  gallery: string[] | null;
  price: number | null;
  original_price: number | null;
  category_slug: string | null;
  moq: number | null;
  unit: string | null;
  lead_time: string | null;
  ship_from: string | null;
  free_shipping: boolean | null;
  rating: number | null;
  review_count: number | null;
  sold: number | null;
  active: boolean | null;
  video_url: string | null;
  source: string | null;
  created_at: string;
};

type SortKey = "title" | "price" | "sold" | "rating" | "created_at";

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "title", label: "Product" },
  { key: null, label: "Category" },
  { key: "price", label: "Price", className: "text-right" },
  { key: null, label: "MOQ / Unit" },
  { key: "sold", label: "Sold", className: "text-right" },
  { key: "rating", label: "Rating", className: "text-right" },
  { key: null, label: "Media" },
  { key: null, label: "Shipping" },
  { key: "created_at", label: "Added" },
  { key: null, label: "Live" },
  { key: null, label: "" },
];

export default function ProductsTable({
  supplierId,
  categories = [],
}: {
  supplierId: string;
  categories?: { slug?: string; id?: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "live" | "hidden">("all");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<SortKey>("created_at");
  const [asc, setAsc] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-products-table", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,title,image,gallery,price,original_price,category_slug,moq,unit,lead_time,ship_from,free_shipping,rating,review_count,sold,active,video_url,source,created_at"
        )
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-products-table"] });
    qc.invalidateQueries({ queryKey: ["my-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (needle && !(r.title ?? "").toLowerCase().includes(needle)) return false;
      if (status === "live" && r.active === false) return false;
      if (status === "hidden" && r.active !== false) return false;
      if (cat !== "all" && (r.category_slug ?? "") !== cat) return false;
      return true;
    });
    const dir = asc ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort === "title") return dir * (a.title ?? "").localeCompare(b.title ?? "");
      const av = Number((a as any)[sort] ?? 0);
      const bv = Number((b as any)[sort] ?? 0);
      if (sort === "created_at") return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return dir * (av - bv);
    });
  }, [rows, q, status, cat, sort, asc]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const setSorting = (key: SortKey) => {
    if (key === sort) setAsc((v) => !v);
    else { setSort(key); setAsc(key === "title"); }
  };

  const setActive = async (ids: string[], active: boolean) => {
    if (ids.length === 0) return;
    setWorking(true);
    const { error } = await supabase.from("products").update({ active }).in("id", ids);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`${active ? "Published" : "Hidden"} ${ids.length} product${ids.length > 1 ? "s" : ""}`);
    refresh();
  };

  const assignCategory = async (slug: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setWorking(true);
    const { error } = await supabase.from("products").update({ category_slug: slug }).in("id", ids);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`Moved ${ids.length} product${ids.length > 1 ? "s" : ""} to ${slug}`);
    setSelected(new Set());
    refresh();
  };

  const removeRows = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} product${ids.length > 1 ? "s" : ""}? This can't be undone.`)) return;
    setWorking(true);
    const { error } = await supabase.from("products").delete().in("id", ids);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${ids.length} product${ids.length > 1 ? "s" : ""}`);
    setSelected(new Set());
    refresh();
  };

  if (isLoading) return <div className="p-10 text-center"><CircleSpinner size={28} /></div>;

  const liveCount = rows.filter((r) => r.active !== false).length;

  return (
    <div className="p-5 space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-[360px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter products"
            className="pl-9 h-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => {
              const slug = (c.slug ?? c.id) as string;
              return <SelectItem key={slug} value={slug}>{c.name}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <span className="text-[12px] text-muted-foreground">
          {filtered.length} of {rows.length} · {liveCount} live
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" className="h-9">
            <Link to="/store/products/new"><Plus className="w-4 h-4 mr-1.5" /> Add product</Link>
          </Button>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-[13px] font-medium text-primary">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="h-8" disabled={working} onClick={() => setActive(Array.from(selected), true)}>
            <Eye className="w-3.5 h-3.5 mr-1.5" /> Publish
          </Button>
          <Button size="sm" variant="outline" className="h-8" disabled={working} onClick={() => setActive(Array.from(selected), false)}>
            <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Hide
          </Button>
          <Select onValueChange={assignCategory}>
            <SelectTrigger className="h-8 w-[190px] text-[13px]">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Tag className="w-3.5 h-3.5" /> Move to category</span>
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => {
                const slug = (c.slug ?? c.id) as string;
                return <SelectItem key={slug} value={slug}>{c.name}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={working} onClick={() => removeRows(Array.from(selected))}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
          <button className="ml-auto text-[12px] text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package className="w-7 h-7 text-muted-foreground" />}
          title="No products yet"
          description="Add your first product so buyers can find your store."
          action={<Button asChild><Link to="/store/products/new"><Plus className="w-4 h-4 mr-1.5" /> Add product</Link></Button>}
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                {COLUMNS.map((c) => (
                  <TableHead key={c.label || "actions"} className={`text-[12px] whitespace-nowrap ${c.className ?? ""}`}>
                    {c.key ? (
                      <button onClick={() => setSorting(c.key!)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {c.label}
                        {sort === c.key && (asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    ) : c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const imgs = (r.gallery ?? []).filter(Boolean);
                const discount =
                  r.original_price && r.price && Number(r.original_price) > Number(r.price)
                    ? Math.round(((Number(r.original_price) - Number(r.price)) / Number(r.original_price)) * 100)
                    : 0;
                return (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} />
                    </TableCell>
                    <TableCell className="min-w-[280px]">
                      <div className="flex items-center gap-3">
                        <img
                          src={r.image || imgs[0] || "/placeholder.svg"}
                          alt={r.title}
                          className="w-10 h-10 rounded-md object-cover bg-muted shrink-0"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <Link to={`/product/${r.id}`} className="block text-[13px] font-medium truncate max-w-[280px] hover:underline">
                            {r.title}
                          </Link>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {r.id.slice(0, 8)}{r.source ? ` · ${r.source}` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                      {r.category_slug ?? <span className="text-destructive">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="text-[13px] font-semibold">${Number(r.price ?? 0).toFixed(2)}</span>
                      {discount > 0 && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground line-through">
                          ${Number(r.original_price).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                      {r.moq ?? 1} · {r.unit ?? "piece"}
                    </TableCell>
                    <TableCell className="text-right text-[13px]">{r.sold ?? 0}</TableCell>
                    <TableCell className="text-right text-[13px] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-primary" />
                        {Number(r.rating ?? 0).toFixed(1)}
                        <span className="text-[11px] text-muted-foreground">({r.review_count ?? 0})</span>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-[11px] text-muted-foreground">
                        {imgs.length || (r.image ? 1 : 0)} img{r.video_url ? " · video" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                      {r.free_shipping ? <Badge variant="secondary" className="text-[10px]">Free</Badge> : (r.lead_time || "—")}
                      {r.ship_from ? <span className="ml-1.5">{r.ship_from}</span> : null}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.active !== false}
                        onCheckedChange={(v) => setActive([r.id], v)}
                        aria-label="Toggle live"
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                          <Link to={`/store/product-edit/${r.id}`} title="Edit"><Pencil className="w-3.5 h-3.5" /></Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                          onClick={() => removeRows([r.id])}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <p className="py-10 text-center text-[13px] text-muted-foreground">No products match your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
