import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, LayoutGrid, Plus, RefreshCw, Search, Sparkles, Table2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { Button, Chip, Input, Skeleton, Textarea, cn, selectCls } from "@/components/ui";
import {
  MODES,
  REGIONS,
  STATUSES,
  STATUS_STYLE,
  addedThisWeek,
  daysAgo,
  daysUntil,
  fmtDate,
  isNew,
  type Host,
  type MatchScore,
} from "@/lib/jobs";

type SortKey = "match" | "deadline" | "added" | "posted" | "rank";
const REGION_ORDER: Record<string, number> = { Remote: 0, Gulf: 1, Europe: 2, Americas: 3, Tunisia: 4 };

export function Dashboard({ email }: { email: string }) {
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const [scores, setScores] = useState<Record<string, MatchScore>>({});
  const [sync, setSync] = useState<{ ran_at: string; summary: string | null } | null>(null);
  const [view, setView] = useState<"cards" | "table">(() => (localStorage.getItem("view") as "cards" | "table") || "cards");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [tier, setTier] = useState("all");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [remotePaid, setRemotePaid] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [newWeek, setNewWeek] = useState(false);
  const [hideRejected, setHideRejected] = useState(true);
  const [dueWithin, setDueWithin] = useState("all");
  const [sort, setSort] = useState<SortKey>("added");
  const [showSync, setShowSync] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [{ data: h, error }, { data: s }, { data: m }] = await Promise.all([
      supabase.from("hosts").select("*").order("rank"),
      supabase.from("sync_log").select("ran_at, summary").order("ran_at", { ascending: false }).limit(1),
      supabase.from("match_scores").select("*"),
    ]);
    if (error) toast.error(error.message);
    setHosts((h as Host[]) ?? []);
    setSync(s?.[0] ?? null);
    setScores(Object.fromEntries(((m as MatchScore[]) ?? []).map((r) => [r.host_id, r])));
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("view", view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sources = useMemo(
    () => Array.from(new Set((hosts ?? []).map((h) => h.source).filter(Boolean) as string[])).sort(),
    [hosts],
  );

  const list = useMemo(() => {
    if (!hosts) return [];
    const out = hosts.filter((h) => {
      if (region !== "all" && (region === "Remote" ? !h.remote_paid && h.mode !== "Remote" : h.region !== region)) return false;
      if (tier !== "all" && h.tier !== tier) return false;
      if (mode !== "all" && (h.mode ?? "").toLowerCase() !== mode.toLowerCase()) return false;
      if (status !== "all" && h.status !== status) return false;
      if (hideRejected && status === "all" && h.status === "rejected") return false;
      if (source !== "all" && h.source !== source) return false;
      if (remotePaid && !h.remote_paid) return false;
      if (needsVerify && !h.verify) return false;
      if (newWeek && !addedThisWeek(h)) return false;
      if (dueWithin !== "all") {
        const d = daysUntil(h.deadline);
        if (d === null || d < 0 || d > Number(dueWithin)) return false;
      }
      if (q) {
        const t = q.toLowerCase();
        if (![h.name, h.place, h.kind, h.why, h.notes, h.apply, h.source, h.pay].some((v) => v?.toLowerCase().includes(t)))
          return false;
      }
      return true;
    });
    const val = (h: Host): number => {
      switch (sort) {
        case "match":
          return -(scores[h.id]?.score ?? -1);
        case "deadline":
          return h.deadline ? new Date(h.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        case "added":
          return -(h.added_at ? new Date(h.added_at).getTime() : 0) + (h.rank ?? 0);
        case "posted":
          return -(h.posted_at ? new Date(h.posted_at).getTime() : 0);
        default:
          return (REGION_ORDER[h.remote_paid ? "Remote" : (h.region ?? "")] ?? 9) * 1000 + (h.rank ?? 0);
      }
    };
    return out.sort((a, b) => val(a) - val(b));
  }, [hosts, scores, q, region, tier, mode, status, hideRejected, source, remotePaid, needsVerify, newWeek, dueWithin, sort]);

  if (!hosts)
    return (
      <AppShell email={email}>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        </div>
      </AppShell>
    );

  const counts = Object.fromEntries(STATUSES.map((s) => [s, hosts.filter((h) => h.status === s).length]));
  const fresh = hosts.filter((h) => isNew(h)).sort((a, b) => (b.added_at ?? "").localeCompare(a.added_at ?? ""));
  const weekCount = hosts.filter(addedThisWeek).length;
  const upcoming = hosts
    .filter((h) => {
      const d = daysUntil(h.deadline);
      return d !== null && d >= 0 && d <= 30 && h.status !== "rejected";
    })
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  const best = Object.values(scores)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => hosts.find((h) => h.id === s.host_id))
    .filter(Boolean) as Host[];

  const activeFilters =
    [region, tier, mode, status, source, dueWithin].filter((v) => v !== "all").length +
    [remotePaid, needsVerify, newWeek].filter(Boolean).length +
    (q ? 1 : 0);
  const clear = () => {
    setQ("");
    setRegion("all");
    setTier("all");
    setMode("all");
    setStatus("all");
    setSource("all");
    setDueWithin("all");
    setRemotePaid(false);
    setNeedsVerify(false);
    setNewWeek(false);
  };

  const toggleChip = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button
      onClick={() => set(!on)}
      className={cn(
        "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );

  return (
    <AppShell email={email}>
      {/* Pipeline counts */}
      <section className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? "all" : s)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5",
              status === s ? "border-primary bg-accent" : "bg-card hover:bg-muted",
            )}
          >
            <div className="text-2xl font-semibold tabular-nums">{counts[s]}</div>
            <div className="text-xs capitalize text-muted-foreground">{s}</div>
          </button>
        ))}
      </section>

      {/* Overview */}
      <section className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Upcoming deadlines
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None in the next 30 days.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {upcoming.slice(0, 4).map((h) => {
                const d = daysUntil(h.deadline)!;
                return (
                  <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link to="/jobs/$id" params={{ id: h.id }} className="truncate hover:underline">
                      {h.name}
                    </Link>
                    <DeadlinePill deadline={h.deadline} short />
                    <span className="sr-only">{d} days</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Best matches
          </div>
          {best.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Open a job and compute its AI match score.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {best.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link to="/jobs/$id" params={{ id: h.id }} className="truncate hover:underline">
                    {h.name}
                  </Link>
                  <MatchPill score={scores[h.id]} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Daily sync
            </div>
            <span className="text-xs text-muted-foreground">{weekCount} added this week</span>
          </div>
          {sync ? (
            <button onClick={() => setShowSync(!showSync)} className="mt-2 text-left text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fmtDate(sync.ran_at)}</span> —{" "}
              <span className={showSync ? "" : "line-clamp-2"}>{sync.summary}</span>
            </button>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not run yet.</p>
          )}
        </div>
      </section>

      {/* New this week */}
      {fresh.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New in the last 3 days · {fresh.length}
          </h2>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {fresh.map((h) => (
              <Link
                key={h.id}
                to="/jobs/$id"
                params={{ id: h.id }}
                className="w-64 shrink-0 rounded-xl border border-primary/40 bg-card px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-primary"
              >
                <div className="truncate text-sm font-medium">{h.name}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[h.place, h.pay].filter(Boolean).join(" · ")}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="sticky top-[53px] z-20 -mx-4 mt-6 space-y-2 bg-background/90 px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input ref={searchRef} className="pl-8" placeholder="Search jobs…  ( / )" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="added">Newest added</option>
            <option value="rank">Priority (region + rank)</option>
            <option value="match">Best match</option>
            <option value="deadline">Deadline</option>
            <option value="posted">Recently posted</option>
          </select>
          <div className="flex rounded-md border bg-card">
            <button
              onClick={() => setView("cards")}
              aria-label="Card view"
              className={cn("p-2 transition-colors", view === "cards" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("table")}
              aria-label="Table view"
              className={cn("p-2 transition-colors", view === "table" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={selectCls} value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
            <option value="all">All regions</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select className={selectCls} value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Tier">
            <option value="all">All tiers</option>
            {["A", "B", "C"].map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </select>
          <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Mode">
            <option value="all">Any mode</option>
            {MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select className={selectCls} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="all">All sources</option>
            {sources.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className={selectCls} value={dueWithin} onChange={(e) => setDueWithin(e.target.value)} aria-label="Deadline">
            <option value="all">Any deadline</option>
            <option value="7">Due in 7 days</option>
            <option value="14">Due in 14 days</option>
            <option value="30">Due in 30 days</option>
          </select>
          {toggleChip(remotePaid, setRemotePaid, "Remote + paid")}
          {toggleChip(newWeek, setNewWeek, "New this week")}
          {toggleChip(needsVerify, setNeedsVerify, "Needs verify")}
          {toggleChip(hideRejected, setHideRejected, "Hide rejected")}
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-9" onClick={clear}>
              <X className="h-3.5 w-3.5" /> Clear ({activeFilters})
            </Button>
          )}
        </div>
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        {list.length} of {hosts.length} jobs
      </p>

      {/* List */}
      <section className="mt-2">
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No jobs match these filters.</p>
        ) : view === "cards" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((h) => (
              <JobCard key={h.id} h={h} score={scores[h.id]} />
            ))}
          </div>
        ) : (
          <JobTable list={list} scores={scores} />
        )}
      </section>

      <AddHost onAdded={(h) => setHosts((hs) => [...(hs ?? []), h])} />
    </AppShell>
  );
}

export function DeadlinePill({ deadline, short }: { deadline: string | null; short?: boolean }) {
  const d = daysUntil(deadline);
  if (d === null || !deadline) return null;
  const cls =
    d < 0
      ? "bg-muted text-muted-foreground"
      : d < 7
        ? "bg-destructive text-destructive-foreground"
        : d < 14
          ? "bg-warn text-warn-foreground"
          : "bg-secondary text-secondary-foreground";
  const label = d < 0 ? "closed" : d === 0 ? "due today" : short ? `${d}d` : `${d}d left`;
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", cls)}>{label}</span>;
}

export function MatchPill({ score }: { score?: MatchScore | undefined }) {
  if (!score) return null;
  const cls =
    score.score >= 75 ? "bg-success text-success-foreground" : score.score >= 50 ? "bg-warn text-warn-foreground" : "bg-muted text-muted-foreground";
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", cls)} title="AI match score">
      {score.score}%
    </span>
  );
}

function JobCard({ h, score }: { h: Host; score?: MatchScore | undefined }) {
  const posted = daysAgo(h.posted_at);
  return (
    <Link
      to="/jobs/$id"
      params={{ id: h.id }}
      className="group block rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-snug group-hover:text-primary">{h.name}</h3>
            {isNew(h) && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span>}
          </div>
          {h.place && <div className="mt-0.5 text-sm text-muted-foreground">{h.place}</div>}
        </div>
        <MatchPill score={score} />
      </div>
      {h.why && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{h.why}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[h.status])}>{h.status}</span>
        {h.tier && <Chip>Tier {h.tier}</Chip>}
        {h.mode && <Chip>{h.mode}</Chip>}
        {h.remote_paid && <Chip className="bg-success text-success-foreground">remote+paid</Chip>}
        {h.verify && <Chip className="bg-warn text-warn-foreground">verify</Chip>}
        <DeadlinePill deadline={h.deadline} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {h.pay && <span className="font-medium text-foreground/80">{h.pay}</span>}
        {h.source && <span>via {h.source}</span>}
        {h.added_at && <span>added {fmtDate(h.added_at)}</span>}
        {posted !== null && <span>posted {posted <= 0 ? "today" : `${posted}d ago`}</span>}
      </div>
    </Link>
  );
}

function JobTable({ list, scores }: { list: Host[]; scores: Record<string, MatchScore> }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="p-3">Job</th>
            <th className="p-3">Source</th>
            <th className="p-3">Deadline</th>
            <th className="p-3">Added</th>
            <th className="p-3">Posted</th>
            <th className="p-3">Status</th>
            <th className="p-3">Match</th>
          </tr>
        </thead>
        <tbody>
          {list.map((h) => (
            <tr key={h.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
              <td className="p-3">
                <Link to="/jobs/$id" params={{ id: h.id }} className="font-medium hover:underline">
                  {h.name}
                </Link>
                {isNew(h) && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span>}
                <div className="text-xs text-muted-foreground">{[h.place, h.mode, h.pay].filter(Boolean).join(" · ")}</div>
              </td>
              <td className="p-3 text-muted-foreground">{h.source ?? "—"}</td>
              <td className="p-3">
                <DeadlinePill deadline={h.deadline} />
              </td>
              <td className="whitespace-nowrap p-3 text-muted-foreground">{fmtDate(h.added_at)}</td>
              <td className="whitespace-nowrap p-3 text-muted-foreground">{h.posted_at ? fmtDate(h.posted_at) : "—"}</td>
              <td className="p-3">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[h.status])}>{h.status}</span>
              </td>
              <td className="p-3">
                <MatchPill score={scores[h.id]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const empty = {
  name: "",
  place: "",
  region: "Europe",
  remote_paid: false,
  tier: "B",
  mode: "",
  pay: "",
  why: "",
  timing: "",
  deadline: "",
  link: "",
  source: "",
  posted_at: "",
  apply_url: "",
  apply_email: "",
};

function AddHost({ onAdded }: { onAdded: (h: Host) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const nul = (v: string) => v.trim() || null;
    const row = {
      id,
      name: f.name,
      place: nul(f.place),
      region: f.region,
      remote_paid: f.remote_paid,
      tier: f.tier,
      rank: 99,
      kind: "Open offer",
      verify: false,
      mode: nul(f.mode),
      pay: nul(f.pay),
      why: nul(f.why),
      timing: nul(f.timing),
      deadline: nul(f.deadline),
      link: nul(f.link),
      source: nul(f.source),
      posted_at: nul(f.posted_at),
      apply_url: nul(f.apply_url) ?? nul(f.link),
      apply_email: nul(f.apply_email),
      status: "research",
      added_at: new Date().toISOString().slice(0, 10),
    };
    const { data, error } = await supabase.from("hosts").insert(row).select().single();
    if (error) return toast.error(error.message);
    setF(empty);
    setOpen(false);
    toast.success(`${f.name} added`);
    onAdded(data as Host);
  };

  if (!open)
    return (
      <div className="mt-8">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add a job manually
        </Button>
      </div>
    );

  const txt = (k: keyof typeof empty, ph: string, type = "text", cls = "") => (
    <Input type={type} placeholder={ph} value={f[k] as string} onChange={set(k)} className={cls} aria-label={ph} />
  );

  return (
    <form onSubmit={submit} className="fade-in mt-8 rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Add a job</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Input required placeholder="Company: role *" value={f.name} onChange={set("name")} className="sm:col-span-2" />
        {txt("place", "Place")}
        <select className={selectCls} value={f.region} onChange={set("region")} aria-label="Region">
          {REGIONS.filter((r) => r !== "Remote").map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select className={selectCls} value={f.tier} onChange={set("tier")} aria-label="Tier">
          {["A", "B", "C"].map((t) => (
            <option key={t} value={t}>
              Tier {t}
            </option>
          ))}
        </select>
        <select className={selectCls} value={f.mode} onChange={set("mode")} aria-label="Work mode">
          <option value="">Work mode…</option>
          {MODES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        {txt("source", "Source (LinkedIn, Indeed…)")}
        {txt("pay", "Pay")}
        {txt("timing", "Timing / duration")}
        <label className="text-xs text-muted-foreground">
          Deadline
          <Input type="date" value={f.deadline} onChange={set("deadline")} />
        </label>
        <label className="text-xs text-muted-foreground">
          Posted on
          <Input type="date" value={f.posted_at} onChange={set("posted_at")} />
        </label>
        {txt("apply_email", "Apply email", "email", "self-end")}
        {txt("link", "Posting link (https://…)", "url", "sm:col-span-3")}
        {txt("apply_url", "Application form URL (if different)", "url", "sm:col-span-3")}
        <Textarea placeholder="Why it fits" value={f.why} onChange={set("why")} className="min-h-20 sm:col-span-3" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.remote_paid} onChange={set("remote_paid")} className="accent-primary" /> Remote and paid
        </label>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">Add job</Button>
        </div>
      </div>
    </form>
  );
}
