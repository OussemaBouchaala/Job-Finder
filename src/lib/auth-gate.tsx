import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { Button, Input, Textarea } from "@/components/ui";

const isRecoveryUrl = () => /type=recovery/.test(window.location.hash + window.location.search);

export function AuthGate({ children }: { children: (email: string) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(isRecoveryUrl);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  if (session && recovery) return <SetPassword onDone={() => setRecovery(false)} />;
  return session ? <>{children(session.user.email ?? "")}</> : <Login onRecovered={() => setRecovery(true)} />;
}

const card = "fade-in w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm";

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    history.replaceState(null, "", window.location.pathname);
    toast.success("Password updated");
    onDone();
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className={card}>
        <div>
          <h1 className="text-xl font-semibold">Set a new password</h1>
          <p className="text-sm text-muted-foreground">At least 8 characters.</p>
        </div>
        <Input type="password" required minLength={8} placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Input type="password" required minLength={8} placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>
          Save password
        </Button>
      </form>
    </main>
  );
}

function Login({ onRecovered }: { onRecovered: () => void }) {
  const [mode, setMode] = useState<"in" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) setMsg(error.message);
      else setSent(true);
    }
    setBusy(false);
  };

  const useLink = async () => {
    const raw = link.trim();
    const params = new URLSearchParams((raw.split("#")[1] ?? raw.split("?")[1] ?? "").replace(/^\?/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) {
      setMsg(params.get("error_description") ?? "That address doesn't contain a reset token. Copy the full address bar after clicking the email link.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    setBusy(false);
    if (error) return setMsg(error.message);
    onRecovered();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className={card}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold">Oussema Job Search</h1>
            <p className="text-sm text-muted-foreground">{mode === "in" ? "Sign in to continue" : "Reset your password"}</p>
          </div>
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode === "in" && (
            <Input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
          {!(mode === "reset" && sent) && (
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "in" ? "Sign in" : "Send reset email"}
            </Button>
          )}
        </form>
        {mode === "reset" && sent && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Email sent. Click the link in it. If it opens another site, copy the <b>whole address</b> from the browser's address bar and paste it here:
            </p>
            <Textarea className="min-h-20 text-xs" placeholder="https://…#access_token=…" value={link} onChange={(e) => setLink(e.target.value)} />
            <Button className="w-full" onClick={useLink} disabled={busy || !link}>
              Continue to set new password
            </Button>
          </div>
        )}
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <button
          type="button"
          className="w-full text-sm text-primary hover:underline"
          onClick={() => {
            setMode(mode === "in" ? "reset" : "in");
            setSent(false);
            setMsg(null);
          }}
        >
          {mode === "in" ? "Forgot password?" : "Back to sign in"}
        </button>
      </div>
    </main>
  );
}
