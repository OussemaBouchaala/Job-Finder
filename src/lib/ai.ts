import { supabase } from "./supabase";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || json.error) throw new Error(json.error || `AI request failed (${res.status})`);
  return json;
}

export const computeMatchScore = (hostId: string) =>
  call<{ score: number; reasons: string[]; gaps: string[] }>({ action: "score", hostId });

export const generateDoc = (hostId: string, kind: "cover_letter" | "email" | "cv", language: "en" | "fr", jobDescription?: string) =>
  call<{ content: string; coverage?: number; keywords?: string[]; missing?: string[] }>({
    action: "generate",
    hostId,
    kind,
    language,
    jobDescription,
  });
