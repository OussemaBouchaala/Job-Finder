import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Skeleton, Textarea } from "@/components/ui";

function ChangePassword() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw("");
    toast.success("Password changed");
  };
  return (
    <form onSubmit={submit} className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Change password</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <Input type="password" required minLength={8} placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} className="max-w-xs" />
        <Button type="submit" disabled={busy}>
          Update
        </Button>
      </div>
    </form>
  );
}

export function Profile({ email }: { email: string }) {
  const [cv, setCv] = useState<string | null>(null);
  const [prefs, setPrefs] = useState("");
  const [saved, setSaved] = useState<"" | "saving" | "saved">("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    supabase
      .from("profile")
      .select("*")
      .eq("id", "me")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        const p = data as { base_cv: string; preferences: string } | null;
        setCv(p?.base_cv ?? "");
        setPrefs(p?.preferences ?? "");
      });
    return () => clearTimeout(timer.current);
  }, []);

  const save = (base_cv: string, preferences: string) => {
    clearTimeout(timer.current);
    setSaved("saving");
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from("profile").upsert({ id: "me", base_cv, preferences, updated_at: new Date().toISOString() });
      if (error) toast.error(error.message);
      setSaved(error ? "" : "saved");
    }, 700);
  };

  return (
    <AppShell email={email}>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">My profile</h1>
        <span className="text-xs text-muted-foreground">{saved === "saving" ? "Saving…" : saved === "saved" ? "All changes saved" : ""}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        The AI assistant uses this CV and these preferences for match scores, cover letters, emails and CV tailoring. It never invents experience.
      </p>
      {cv === null ? (
        <Skeleton className="mt-6 h-96 w-full" />
      ) : (
        <section className="mt-6 space-y-6">
          <div>
            <h2 className="mb-1 text-sm font-semibold">Preferences</h2>
            <Textarea
              className="min-h-20"
              value={prefs}
              onChange={(e) => {
                setPrefs(e.target.value);
                save(cv, e.target.value);
              }}
            />
          </div>
          <div>
            <h2 className="mb-1 text-sm font-semibold">Base CV</h2>
            <Textarea
              className="min-h-[32rem] font-mono text-[13px] leading-relaxed"
              value={cv}
              onChange={(e) => {
                setCv(e.target.value);
                save(e.target.value, prefs);
              }}
            />
          </div>
          <ChangePassword />
        </section>
      )}
    </AppShell>
  );
}
