import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { Config } from "@netlify/functions";

const SUPABASE_URL = "https://sselbentysgmshrmqshd.supabase.co";
const SUPABASE_KEY = "sb_publishable_N90rxS-ZVoGW0aJd1l478g_FRD0L83y";
const MODEL = "claude-sonnet-4-6";

type Host = Record<string, unknown> & { id: string; name: string };

const err = (msg: string, status = 400) => Response.json({ error: msg }, { status });

function hostSummary(h: Host): string {
  const f = (k: string, label: string) => (h[k] ? `${label}: ${h[k]}` : null);
  return [
    `Role / company: ${h.name}`,
    f("place", "Location"),
    f("region", "Region"),
    f("mode", "Work mode"),
    f("pay", "Pay"),
    f("timing", "Timing"),
    f("deadline", "Deadline"),
    f("why", "Why it fits"),
    f("apply", "How to apply"),
    f("notes", "Candidate notes"),
  ]
    .filter(Boolean)
    .join("\n");
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.search(/[{[]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start < 0 || end <= start) throw new Error("AI returned no JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

async function ask(system: string, prompt: string, maxTokens = 1800): Promise<string> {
  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();
}

export default async (req: Request) => {
  if (req.method !== "POST") return err("POST only", 405);
  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY)
    return err("AI Gateway not active yet on this Netlify site.", 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return err("Not signed in", 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user?.user) return err("Session expired, sign in again", 401);

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    hostId?: string;
    kind?: "cover_letter" | "email" | "cv";
    language?: "en" | "fr";
    jobDescription?: string;
  } | null;
  if (!body?.hostId) return err("hostId required");

  const [{ data: host }, { data: profile }] = await Promise.all([
    supabase.from("hosts").select("*").eq("id", body.hostId).maybeSingle(),
    supabase.from("profile").select("*").eq("id", "me").maybeSingle(),
  ]);
  if (!host) return err("Job not found", 404);
  const cv = (profile?.base_cv as string) ?? "";
  const prefs = (profile?.preferences as string) ?? "";
  const jd = body.jobDescription?.trim() ? `\n\nFULL JOB DESCRIPTION:\n${body.jobDescription.trim().slice(0, 12000)}` : "";
  const context = `CANDIDATE CV:\n${cv}\n\nCANDIDATE PREFERENCES:\n${prefs}\n\nJOB:\n${hostSummary(host as Host)}${jd}`;

  try {
    if (body.action === "score") {
      const raw = await ask(
        'You are a strict career-matching engine. Score how well the candidate fits this internship (skills, seniority, location/visa feasibility, pay, timing Feb-Aug 2027, preference order remote+paid > Gulf > Europe > Americas > Tunisia). Reply with ONLY JSON: {"score": <integer 0-100>, "reasons": [3 short strings], "gaps": [up to 3 short strings, concrete things to prepare or risks]}',
        context,
        600,
      );
      const p = parseJson<{ score: number; reasons: string[]; gaps: string[] }>(raw);
      const score = Math.max(0, Math.min(100, Math.round(Number(p.score) || 0)));
      const reasons = (p.reasons ?? []).slice(0, 3).map(String);
      const gaps = (p.gaps ?? []).slice(0, 3).map(String);
      const { error } = await supabase
        .from("match_scores")
        .upsert({ host_id: body.hostId, score, reasons, gaps, updated_at: new Date().toISOString() });
      if (error) return err(error.message, 500);
      return Response.json({ score, reasons, gaps });
    }

    if (body.action === "generate") {
      const lang = body.language === "fr" ? "French" : "English";
      if (body.kind === "cv") {
        const raw = await ask(
          `You are an expert technical CV writer. Rewrite the candidate's base CV tailored to this job, in ${lang}. Keep the same sections and contact line; reorder and rephrase bullets to foreground the most relevant skills and results; mirror the job's keywords where truthful. NEVER invent employers, dates, metrics, degrees or skills not present in the base CV. Keep it to one page worth of text. Reply with ONLY JSON: {"cv": "<full tailored CV, plain text with line breaks>", "coverage": <integer 0-100 share of the job's key requirements covered>, "keywords": [matched keywords], "missing": [important job keywords the CV cannot truthfully claim]}`,
          context,
          3000,
        );
        const p = parseJson<{ cv: string; coverage: number; keywords: string[]; missing: string[] }>(raw);
        return Response.json({
          content: p.cv,
          coverage: Math.max(0, Math.min(100, Math.round(Number(p.coverage) || 0))),
          keywords: p.keywords ?? [],
          missing: p.missing ?? [],
        });
      }
      const instructions =
        body.kind === "cover_letter"
          ? `Write a tailored cover letter in ${lang} for this end-of-studies internship (PFE). Professional, specific and warm, 250-350 words, plain text, ready to sign "Oussema Bouchaala". Open with why this company/role, then 2 concrete matching achievements from the CV, then availability (6 months from Feb 2027) and a call to action. No placeholders like [Company].`
          : `Write a short application email in ${lang}, ready to send. First line exactly "Subject: ...", then a blank line, then the body (120-170 words): greeting, who the candidate is, the 2 most relevant achievements, availability (6-month PFE from Feb 2027), mention CV attached, sign-off with name, email and phone from the CV. No placeholders.`;
      const content = await ask(`You are an expert job-application writer. ${instructions} Use only facts from the CV.`, context, 1500);
      return Response.json({ content });
    }
    return err("Unknown action");
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500);
  }
};

export const config: Config = { path: "/api/ai" };
