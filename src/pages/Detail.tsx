import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, ExternalLink, FileText, Mail, Sparkles, Trash2, Wand2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { Button, ButtonLink, Chip, Input, Skeleton, Textarea, cn, selectCls } from "@/components/ui";
import { computeMatchScore, generateDoc } from "@/lib/ai";
import { downloadDocx, downloadPdf } from "@/lib/download";
import { STATUSES, STATUS_STYLE, daysAgo, fmtDate, isNew, mailtoFor, parseEmail, type AppDoc, type Host, type MatchScore } from "@/lib/jobs";
import { DeadlinePill } from "./Dashboard";

export function Detail({ email, id }: { email: string; id: string }) {
  const [host, setHost] = useState<Host | null>(null);
  const [missing, setMissing] = useState(false);
  const [score, setScore] = useState<MatchScore | null>(null);
  const [docs, setDocs] = useState<AppDoc[]>([]);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [scoring, setScoring] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: m }, { data: d }] = await Promise.all([
        supabase.from("hosts").select("*").eq("id", id).maybeSingle(),
        supabase.from("match_scores").select("*").eq("host_id", id).maybeSingle(),
        supabase.from("application_docs").select("*").eq("host_id", id).order("created_at", { ascending: false }),
      ]);
      if (!h) return setMissing(true);
      setHost(h as Host);
      setNotes((h as Host).notes ?? "");
      setScore((m as MatchScore) ?? null);
      setDocs((d as AppDoc[]) ?? []);
    })();
  }, [id]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = async (p: Partial<Host>, quiet = false) => {
    const { error } = await supabase.from("hosts").update(p).eq("id", id);
    if (error) return toast.error(error.message);
    setHost((h) => (h ? { ...h, ...p } : h));
    if (!quiet) toast.success("Saved");
  };
  const onNotes = (v: string) => {
    setNotes(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ notes: v }, true), 700);
  };

  const rescore = async () => {
    setScoring(true);
    try {
      const r = await computeMatchScore(id);
      setScore({ host_id: id, score: r.score, reasons: r.reasons, gaps: r.gaps, updated_at: new Date().toISOString() });
      toast.success(`Match score: ${r.score}%`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scoring failed");
    }
    setScoring(false);
  };

  const remove = async () => {
    if (!confirm) return setConfirm(true);
    const { error } = await supabase.from("hosts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    navigate({ to: "/" });
  };

  if (missing)
    return (
      <AppShell email={email}>
        <p className="text-muted-foreground">Job not found.</p>
      </AppShell>
    );
  if (!host)
    return (
      <AppShell email={email}>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-4 h-96 w-full" />
      </AppShell>
    );

  const posted = daysAgo(host.posted_at);
  const applyHref = host.apply_url || host.link;

  return (
    <AppShell email={email}>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All jobs
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold leading-tight">{host.name}</h1>
            {isNew(host) && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{[host.place, host.region, host.mode, host.kind].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {applyHref && (
            <ButtonLink href={applyHref}>
              <ExternalLink className="h-4 w-4" /> Apply
            </ButtonLink>
          )}
          {host.apply_email && (
            <ButtonLink href={mailtoFor(host)} variant="outline" external={false}>
              <Mail className="h-4 w-4" /> Email {host.apply_email}
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[host.status])}>{host.status}</span>
        {host.source && <Chip>via {host.source}</Chip>}
        {host.tier && <Chip>Tier {host.tier}</Chip>}
        {host.remote_paid && <Chip className="bg-success text-success-foreground">remote+paid</Chip>}
        {host.verify && <Chip className="bg-warn text-warn-foreground">details need checking</Chip>}
        {host.added_at && <Chip className="bg-muted text-muted-foreground">added {fmtDate(host.added_at)}</Chip>}
        {posted !== null && <Chip className="bg-muted text-muted-foreground">posted {posted <= 0 ? "today" : `${posted}d ago`}</Chip>}
        {host.deadline && (
          <>
            <DeadlinePill deadline={host.deadline} />
            <Chip className="bg-muted text-muted-foreground">deadline {fmtDate(host.deadline)}</Chip>
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-4">
            <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm">
              {(
                [
                  ["Why it fits", host.why],
                  ["Pay", host.pay],
                  ["Timing", host.timing],
                  ["How to apply", host.apply],
                ] as [string, string | null][]
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              {host.link && (
                <div className="contents">
                  <dt className="text-muted-foreground">Posting</dt>
                  <dd className="truncate">
                    <a href={host.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {host.link.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> AI match score
              </h2>
              <Button size="sm" variant="outline" onClick={rescore} disabled={scoring}>
                {scoring ? "Scoring…" : score ? "Recompute" : "Compute"}
              </Button>
            </div>
            {score ? (
              <div className="mt-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold tabular-nums">
                    {score.score}
                    <span className="text-base font-normal text-muted-foreground">%</span>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${score.score}%` }} />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why you match</h3>
                    <ul className="mt-1 list-inside list-disc text-sm">
                      {score.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gaps to address</h3>
                    <ul className="mt-1 list-inside list-disc text-sm">
                      {score.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Compare this job with your profile and CV.</p>
            )}
          </section>

          <Assistant host={host} docs={docs} setDocs={setDocs} />
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border bg-card p-4 lg:sticky lg:top-20">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
            <select className={cn(selectCls, "mt-1 w-full capitalize")} value={host.status} onChange={(e) => save({ status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">My notes</label>
            <Textarea className="mt-1 min-h-40" value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="Contacts, interview dates, follow-ups…" />
            <EditField label="Deadline" type="date" value={host.deadline ?? ""} onSave={(v) => save({ deadline: v || null })} />
            <EditField label="Application form URL" value={host.apply_url ?? ""} onSave={(v) => save({ apply_url: v || null })} />
            <EditField label="Apply email" type="email" value={host.apply_email ?? ""} onSave={(v) => save({ apply_email: v || null })} />
            <Button variant={confirm ? "destructive" : "ghost"} size="sm" className="mt-3" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" /> {confirm ? "Click again to remove" : "Remove job"}
            </Button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function EditField({ label, value, onSave, type = "text" }: { label: string; value: string; onSave: (v: string) => void; type?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
      <Input type={type} className="mt-1 font-normal normal-case tracking-normal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </label>
  );
}

const KIND_LABEL = { cover_letter: "Cover letter", email: "Email", cv: "Tailored CV" } as const;

function Assistant({ host, docs, setDocs }: { host: Host; docs: AppDoc[]; setDocs: (d: AppDoc[]) => void }) {
  const [jd, setJd] = useState("");
  const [lang, setLang] = useState<"en" | "fr">(() => (/france|paris|tunis|maroc|belgique|lyon|grenoble|toulouse|orl[eé]ans|v[eé]lizy|s[eè]vres/i.test(host.place ?? "") ? "fr" : "en"));
  const [busy, setBusy] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<AppDoc | null>(null);

  const generate = async (kind: AppDoc["kind"]) => {
    setBusy(kind);
    try {
      const r = await generateDoc(host.id, kind, lang, jd || undefined);
      const title = `${KIND_LABEL[kind]} — ${host.name} (${lang.toUpperCase()})`;
      const meta = kind === "cv" ? { coverage: r.coverage, keywords: r.keywords, missing: r.missing } : {};
      const { data, error } = await supabase
        .from("application_docs")
        .insert({ host_id: host.id, kind, language: lang, title, content: r.content, meta })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setDocs([data as AppDoc, ...docs]);
      setOpenDoc(data as AppDoc);
      toast.success(`${KIND_LABEL[kind]} ready`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
    setBusy(null);
  };

  const delDoc = async (d: AppDoc) => {
    const { error } = await supabase.from("application_docs").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    setDocs(docs.filter((x) => x.id !== d.id));
  };

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-1.5 font-semibold">
        <Wand2 className="h-4 w-4 text-primary" /> Application assistant
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Generates documents from your profile CV. Paste the job description for sharper results.</p>
      <Textarea
        className="mt-3 min-h-24"
        placeholder="Optional: paste the full job description here…"
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border text-sm">
          {(["en", "fr"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn("px-3 py-1.5 uppercase transition-colors", lang === l ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              {l}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => generate("cover_letter")} disabled={!!busy}>
          {busy === "cover_letter" ? "Writing…" : "Cover letter"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => generate("email")} disabled={!!busy}>
          {busy === "email" ? "Writing…" : "Ready-to-send email"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => generate("cv")} disabled={!!busy}>
          {busy === "cv" ? "Tailoring…" : "Tailor my CV"}
        </Button>
      </div>
      {busy && <div className="mt-3 h-1 overflow-hidden rounded bg-muted"><div className="h-full w-1/3 animate-pulse rounded bg-primary" /></div>}
      {docs.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saved documents</h3>
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:border-primary">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <button onClick={() => setOpenDoc(doc)} className="min-w-0 flex-1 truncate text-left">
                {doc.title} <span className="text-xs text-muted-foreground">· {fmtDate(doc.created_at)}</span>
              </button>
              <button onClick={() => delDoc(doc)} className="text-muted-foreground hover:text-destructive" aria-label="Delete document">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {openDoc && (
        <DocView
          doc={openDoc}
          host={host}
          onClose={() => setOpenDoc(null)}
          onSaved={(d) => setDocs(docs.map((x) => (x.id === d.id ? d : x)))}
        />
      )}
    </section>
  );
}

function DocView({ doc, host, onClose, onSaved }: { doc: AppDoc; host: Host; onClose: () => void; onSaved: (d: AppDoc) => void }) {
  const [content, setContent] = useState(doc.content);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onEdit = (v: string) => {
    setContent(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { data, error } = await supabase.from("application_docs").update({ content: v, updated_at: new Date().toISOString() }).eq("id", doc.id).select().single();
      if (error) toast.error(error.message);
      else if (data) onSaved(data as AppDoc);
    }, 800);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    toast.success("Copied");
  };
  const title = doc.title ?? "document";
  const em = doc.kind === "email" ? parseEmail(content) : null;
  const gmail = em
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(host.apply_email ?? "")}&su=${encodeURIComponent(em.subject)}&body=${encodeURIComponent(em.body)}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="fade-in max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {doc.kind === "cv" && doc.meta?.coverage !== undefined && (
          <div className="mt-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Keyword coverage</span>
              <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${doc.meta.coverage}%` }} />
              </div>
              <span className="font-semibold">{doc.meta.coverage}%</span>
            </div>
            {doc.meta.missing?.length ? <p className="mt-1 text-muted-foreground">Missing: {doc.meta.missing.join(", ")}</p> : null}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copy}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadPdf(title, content)}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadDocx(title, content)}>
            <Download className="h-3.5 w-3.5" /> Word
          </Button>
          {em && (
            <>
              <ButtonLink size="sm" href={mailtoFor(host, em.subject, em.body)} external={false}>
                <Mail className="h-3.5 w-3.5" /> Open in mail app
              </ButtonLink>
              <ButtonLink size="sm" variant="outline" href={gmail}>
                <Mail className="h-3.5 w-3.5" /> Open in Gmail
              </ButtonLink>
            </>
          )}
        </div>
        <Textarea className="mt-3 min-h-96 font-mono text-[13px] leading-relaxed" value={content} onChange={(e) => onEdit(e.target.value)} />
        {doc.kind === "cv" && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">Compare with base CV</summary>
            <BaseCvDiff tailored={content} />
          </details>
        )}
      </div>
    </div>
  );
}

function BaseCvDiff({ tailored }: { tailored: string }) {
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .from("profile")
      .select("base_cv")
      .eq("id", "me")
      .maybeSingle()
      .then(({ data }) => setBase((data as { base_cv: string } | null)?.base_cv ?? ""));
  }, []);
  const baseLines = new Set((base ?? "").split("\n").map((l) => l.trim()).filter(Boolean));
  return (
    <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
      <div>
        <h4 className="font-semibold">Base CV</h4>
        <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-2">{base ?? "Loading…"}</pre>
      </div>
      <div>
        <h4 className="font-semibold">Tailored (changed lines highlighted)</h4>
        <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-2">
          {tailored.split("\n").map((l, i) => (
            <span key={i} className={l.trim() && !baseLines.has(l.trim()) ? "bg-accent text-accent-foreground" : ""}>
              {l}
              {"\n"}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
