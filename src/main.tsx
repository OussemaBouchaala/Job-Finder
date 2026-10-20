import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Toaster } from "sonner";
import "./styles.css";
import { AuthGate } from "./lib/auth-gate";
import { Dashboard } from "./pages/Dashboard";
import { Detail } from "./pages/Detail";
import { Board } from "./pages/Board";
import { Profile } from "./pages/Profile";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster richColors closeButton position="bottom-right" />
    </>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-5xl font-bold">404</h1>
      <a href="/" className="text-primary hover:underline">
        Go home
      </a>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <AuthGate>{(e) => <Dashboard email={e} />}</AuthGate>,
});
const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  component: () => <AuthGate>{(e) => <Board email={e} />}</AuthGate>,
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: () => <AuthGate>{(e) => <Profile email={e} />}</AuthGate>,
});
const jobRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/jobs/$id",
  component: function JobPage() {
    const { id } = jobRoute.useParams();
    return <AuthGate>{(e) => <Detail key={id} email={e} id={id} />}</AuthGate>;
  },
});

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, boardRoute, profileRoute, jobRoute]),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
