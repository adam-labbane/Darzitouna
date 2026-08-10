import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import AppGuard from "./components/AppGuard";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import AppLayout from "./components/AppLayout";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClientsList from "./pages/ClientsList";
import ClientProfil from "./pages/ClientProfil";
import DepotsList from "./pages/DepotsList";
import DepotNouveau from "./pages/DepotNouveau";
import Stocks from "./pages/Stocks";
import Pressages from "./pages/Pressages";
import Factures from "./pages/Factures";
import Config from "./pages/Config";
import ModuleAVenir from "./pages/ModuleAVenir";
import TicketPublic from "./pages/TicketPublic";
// TEMPORAIRE — sonde Sentry, à retirer après validation (voir TestSentry.tsx).
import TestSentry from "./pages/TestSentry";

// Route racine sans chemin : elle n'ajoute aucun segment d'URL et sert
// uniquement à porter l'errorElement. Toute erreur levée dans une route
// enfant remonte jusqu'ici — c'est le seul moyen d'intercepter les erreurs
// d'un data router, qui ne les laisse pas atteindre React au-dessus.
const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/t/:token",
        element: <TicketPublic />,
      },
      // TEMPORAIRE — sonde Sentry, à retirer après validation.
      {
        path: "/test-sentry",
        element: <TestSentry />,
      },
      {
        path: "/setup",
        element: <Setup />,
      },
      {
        path: "/",
        element: (
          <AppGuard>
            <Login />
          </AppGuard>
        ),
      },
      {
        element: (
          <AppGuard requireAuth>
            <AppLayout />
          </AppGuard>
        ),
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/clients", element: <ClientsList /> },
          { path: "/clients/:id", element: <ClientProfil /> },
          { path: "/depots", element: <DepotsList /> },
          { path: "/depots/nouveau", element: <DepotNouveau /> },
          { path: "/pressages", element: <Pressages /> },
          { path: "/stocks", element: <Stocks /> },
          { path: "/factures", element: <Factures /> },
          { path: "/grignons", element: <ModuleAVenir titre="Grignons" /> },
          { path: "/config", element: <Config /> },
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
