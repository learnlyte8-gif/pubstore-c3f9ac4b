import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, Check, X, Users, Briefcase, MapPin, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchMyConnections, fetchSuggestedSeekers, type JobSeekerProfile } from "@/data/jobs";
import EmptyState from "@/components/EmptyState";
import CircleSpinner from "@/components/CircleSpinner";

type Tab = "discover" | "requests" | "connections";

export default function JobsNetwork() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("discover");
  const [q, setQ] = useState("");
  const [authedId, setAuthedId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAuthedId(data.user?.id ?? null)); }, []);

  const { data: connections = [] } = useQuery({
    queryKey: ["my-connections", authedId],
    queryFn: fetchMyConnections,
    enabled: !!authedId,
  });

  const { data: suggested = [], isLoading: loadingSuggested } = useQuery({
    queryKey: ["suggested-seekers", q],
    queryFn: async () => {
      const all = await fetchSuggestedSeekers(40);
      if (!q.trim()) return all;
      const t = q.toLowerCase();
      return all.filter((p) =>
        (p.headline ?? "").toLowerCase().includes(t)
        || (p.current_title ?? "").toLowerCase().includes(t)
        || (p.current_company ?? "").toLowerCase().includes(t)
        || p.skills.some((s) => s.toLowerCase().includes(t)),
      );
    },
  });

  const incomingRequests = connections.filter((c) => c.status === "pending" && c.recipient_id === authedId);
  const outgoingRequests = connections.filter((c) => c.status === "pending" && c.requester_id === authedId);
  const accepted = connections.filter((c) => c.status === "accepted");

  const peerIds = new Set<string>();
  connections.forEach((c) => peerIds.add(c.requester_id === authedId ? c.recipient_id : c.requester_id));
  const filteredSuggestions = suggested.filter((s) => s.user_id !== authedId && !peerIds.has(s.user_id));

  async function respond(id: string, status: "accepted" | "declined") {
    await supabase.from("job_connections").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["my-connections"] });
    toast.success(status === "accepted" ? "Connection accepted" : "Request declined");
  }
  async function sendRequest(targetId: string) {
    if (!authedId) { nav("/auth"); return; }
    const { error } = await supabase.from("job_connections").insert({ requester_id: authedId, recipient_id: targetId });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-connections"] });
    toast.success("Request sent");
  }

  return (
    <div className="pb-20">
      <header className="px-4 pt-4 pb-3 bg-gradient-to-br from-blue-700 via-indigo-700 to-sky-600 text-white">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-white/15 grid place-items-center"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex-1">
            <h1 className="text-lg font-black tracking-tight">My network</h1>
            <p className="text-[11px] opacity-90">{accepted.length} connections · {incomingRequests.length} pending</p>
          </div>
          <Link to="/jobs/feed" className="text-xs font-bold underline opacity-90">Feed</Link>
        </div>
        <div className="mt-3 relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by skill, title, company" className="bg-white text-foreground border-0" />
        </div>
        <div className="mt-3 flex bg-white/15 backdrop-blur rounded-full p-1">
          {(["discover", "requests", "connections"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 h-9 rounded-full text-xs font-bold transition ${tab === t ? "bg-white text-foreground" : "text-white/90"}`}>
              {t === "discover" ? "Discover" : t === "requests" ? `Requests${incomingRequests.length ? ` (${incomingRequests.length})` : ""}` : "Connections"}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 mt-4 space-y-3">
        {tab === "discover" && (
          <>
            {loadingSuggested && <p className="text-center text-xs text-muted-foreground py-6"><CircleSpinner size={28} /></p>}
            {!loadingSuggested && filteredSuggestions.length === 0 && (
              <EmptyState icon={<Sparkles className="w-7 h-7 text-muted-foreground" />} title="No suggestions" description="Check back later as more people join." />
            )}
            {filteredSuggestions.map((p) => (
              <PersonCard key={p.user_id} p={p} onConnect={() => sendRequest(p.user_id)} />
            ))}
          </>
        )}

        {tab === "requests" && (
          <>
            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <EmptyState icon={<UserPlus className="w-7 h-7 text-muted-foreground" />} title="No pending requests" description="Send a connection request to grow your network." />
            )}
            {incomingRequests.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Invitations</h3>
                <div className="space-y-2">
                  {incomingRequests.map((c) => (
                    <RequestRow key={c.id} userId={c.requester_id} message={c.message} onAccept={() => respond(c.id, "accepted")} onDecline={() => respond(c.id, "declined")} />
                  ))}
                </div>
              </div>
            )}
            {outgoingRequests.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Sent</h3>
                <div className="space-y-2">
                  {outgoingRequests.map((c) => <PendingOutgoing key={c.id} userId={c.recipient_id} />)}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "connections" && (
          <>
            {accepted.length === 0 && (
              <EmptyState icon={<Users className="w-7 h-7 text-muted-foreground" />} title="No connections yet" description="Discover people and start connecting." />
            )}
            {accepted.map((c) => {
              const peerId = c.requester_id === authedId ? c.recipient_id : c.requester_id;
              return <ConnectedRow key={c.id} userId={peerId} />;
            })}
          </>
        )}
      </main>
    </div>
  );
}

function PersonCard({ p, onConnect }: { p: JobSeekerProfile; onConnect: () => void }) {
  return (
    <Link to={`/jobs/people/${p.user_id}`} className="block">
      <div className="rounded-2xl bg-card border shadow-card p-3 flex gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted shrink-0">
          {p.avatar_url
            ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full grid place-items-center bg-primary/10 text-primary font-bold">{(p.headline || "U")[0]?.toUpperCase()}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight truncate">{p.current_title || p.headline || "Member"}</p>
          {p.current_company && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Briefcase className="w-3 h-3" /> {p.current_company}</p>}
          {(p.location_city || p.location_country) && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3" /> {[p.location_city, p.location_country].filter(Boolean).join(", ")}</p>
          )}
          {p.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {p.skills.slice(0, 3).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); onConnect(); }} className="shrink-0 self-start">
          <UserPlus className="w-3.5 h-3.5 mr-1" /> Connect
        </Button>
      </div>
    </Link>
  );
}

function useSeekerLite(userId: string) {
  return useQuery({
    queryKey: ["seeker-lite", userId],
    queryFn: async () => {
      const { data } = await supabase.from("job_seeker_profiles")
        .select("user_id,headline,current_title,current_company,avatar_url,location_city,location_country")
        .eq("user_id", userId).maybeSingle();
      return data;
    },
    enabled: !!userId,
  });
}

function RequestRow({ userId, message, onAccept, onDecline }: { userId: string; message: string | null; onAccept: () => void; onDecline: () => void; }) {
  const { data: p } = useSeekerLite(userId);
  return (
    <div className="rounded-2xl bg-card border shadow-card p-3">
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
          {p?.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center bg-primary/10 text-primary font-bold">{(p?.current_title || "U")[0]?.toUpperCase()}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <Link to={`/jobs/people/${userId}`} className="text-sm font-bold leading-tight truncate hover:underline block">
            {p?.current_title || p?.headline || "Member"}
          </Link>
          {p?.current_company && <p className="text-[11px] text-muted-foreground truncate">{p.current_company}</p>}
          {message && <p className="text-xs text-foreground/80 mt-1 italic line-clamp-2">"{message}"</p>}
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" className="flex-1" onClick={onAccept}><Check className="w-3.5 h-3.5 mr-1" /> Accept</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onDecline}><X className="w-3.5 h-3.5 mr-1" /> Decline</Button>
      </div>
    </div>
  );
}

function PendingOutgoing({ userId }: { userId: string }) {
  const { data: p } = useSeekerLite(userId);
  return (
    <Link to={`/jobs/people/${userId}`} className="rounded-2xl bg-card border shadow-card p-3 flex gap-3 items-center">
      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
        {p?.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center bg-primary/10 text-primary font-bold">{(p?.current_title || "U")[0]?.toUpperCase()}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{p?.current_title || p?.headline || "Member"}</p>
        {p?.current_company && <p className="text-[11px] text-muted-foreground truncate">{p.current_company}</p>}
      </div>
      <Badge variant="outline" className="text-[10px]">Pending</Badge>
    </Link>
  );
}

function ConnectedRow({ userId }: { userId: string }) {
  const { data: p } = useSeekerLite(userId);
  return (
    <Link to={`/jobs/people/${userId}`} className="rounded-2xl bg-card border shadow-card p-3 flex gap-3 items-center">
      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
        {p?.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center bg-primary/10 text-primary font-bold">{(p?.current_title || "U")[0]?.toUpperCase()}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{p?.current_title || p?.headline || "Member"}</p>
        {p?.current_company && <p className="text-[11px] text-muted-foreground truncate">{p.current_company}</p>}
      </div>
      <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500"><Check className="w-3 h-3" /></Badge>
    </Link>
  );
}
