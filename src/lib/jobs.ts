export type Host = {
  id: string;
  name: string;
  place: string | null;
  region: string | null;
  remote_paid: boolean;
  tier: string | null;
  rank: number;
  kind: string | null;
  verify: boolean;
  mode: string | null;
  pay: string | null;
  why: string | null;
  apply: string | null;
  timing: string | null;
  deadline: string | null;
  link: string | null;
  status: string;
  notes: string | null;
  last_checked: string | null;
  added_at: string | null;
  posted_at: string | null;
  source: string | null;
  apply_url: string | null;
  apply_email: string | null;
};
export type MatchScore = { host_id: string; score: number; reasons: string[]; gaps: string[]; updated_at: string };
export type AppDoc = {
  id: string;
  host_id: string;
  kind: "cover_letter" | "email" | "cv";
  language: string;
  title: string | null;
  content: string;
  meta: { coverage?: number; keywords?: string[]; missing?: string[] } | null;
  created_at: string;
};

export const STATUSES = ["research", "contact", "applied", "interview", "offer", "rejected"] as const;
export const REGIONS = ["Remote", "Gulf", "Europe", "Americas", "Tunisia"] as const;
export const MODES = ["Remote", "Hybrid", "On-site"] as const;

export const STATUS_STYLE: Record<string, string> = {
  research: "bg-secondary text-secondary-foreground",
  contact: "bg-accent text-accent-foreground",
  applied: "bg-primary text-primary-foreground",
  interview: "bg-warn text-warn-foreground",
  offer: "bg-success text-success-foreground",
  rejected: "bg-muted text-muted-foreground line-through",
};

const DAY = 864e5;

export function daysAgo(d: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / DAY);
}

export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + "T00:00:00").getTime() - now.getTime()) / DAY);
}

export const isNew = (h: Host, days = 3) => {
  const a = daysAgo(h.added_at);
  return a !== null && a < days;
};
export const addedThisWeek = (h: Host) => isNew(h, 7);

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function mailtoFor(h: Host, subject?: string, body?: string): string {
  const s = encodeURIComponent(subject ?? `PFE internship application — ${h.name}`);
  const b = encodeURIComponent(
    body ??
      `Hello,\n\nI am Oussema Bouchaala, a final-year engineering student at INSAT Tunis, applying for the internship position at ${h.name}.\n\nPlease find my CV attached.\n\nBest regards,\nOussema Bouchaala\noussema.bouchaala@insat.ucar.tn`,
  );
  return `mailto:${h.apply_email ?? ""}?subject=${s}&body=${b}`;
}

export function parseEmail(content: string): { subject: string; body: string } {
  const lines = content.split("\n");
  const first = lines[0] ?? "";
  if (/^subject:/i.test(first)) return { subject: first.replace(/^subject:\s*/i, ""), body: lines.slice(1).join("\n").trim() };
  return { subject: "", body: content };
}
