import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Briefcase, KanbanSquare, LogOut, Moon, Sun, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "./ui";

const navCls =
  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const activeCls = "!bg-accent !text-accent-foreground";

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Briefcase className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">Oussema Job Search</span>
          </Link>
          <nav className="ml-1 flex items-center gap-1 text-sm">
            <Link to="/" className={navCls} activeProps={{ className: activeCls }} activeOptions={{ exact: true }}>
              <Briefcase className="h-4 w-4" /> Jobs
            </Link>
            <Link to="/board" className={navCls} activeProps={{ className: activeCls }}>
              <KanbanSquare className="h-4 w-4" /> Board
            </Link>
            <Link to="/profile" className={navCls} activeProps={{ className: activeCls }}>
              <User className="h-4 w-4" /> Profile
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden text-xs text-muted-foreground md:inline">{email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="fade-in mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
