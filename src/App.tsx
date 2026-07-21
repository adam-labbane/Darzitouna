// src/App.tsx
import { createBrowserRouter, RouterProvider } from "react-router";
import AppGuard from "./components/AppGuard";
import AppLayout from "./components/AppLayout";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClientsList from "./pages/ClientsList";
import DepotsList from "./pages/DepotsList";
import DepotNouveau from "./pages/DepotNouveau";
import Stocks from "./pages/Stocks";
import ModuleAVenir from "./pages/ModuleAVenir";

const router = createBrowserRouter([
  {
    // Page de configuration initiale — accessible librement
    path: "/setup",
    element: <Setup />,
  },
  {
    // Page de login — protégée par AppGuard (vérifie que l'huilerie existe)
    path: "/",
    element: (
      <AppGuard>
        <Login />
      </AppGuard>
    ),
  },
  {
    // Toutes les pages connectées partagent UNE SEULE garde d'authentification
    // et UN SEUL layout (sidebar + en-tête), montés ici plutôt que répétés
    // dans chaque route. AppLayout rend <Outlet/> pour la page active.
    element: (
      <AppGuard requireAuth>
        <AppLayout />
      </AppGuard>
    ),
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/clients", element: <ClientsList /> },
      { path: "/depots", element: <DepotsList /> },
      { path: "/depots/nouveau", element: <DepotNouveau /> },
      { path: "/pressages", element: <ModuleAVenir titre="Pressage" /> },
      { path: "/stocks", element: <Stocks /> },
      { path: "/factures", element: <ModuleAVenir titre="Factures" /> },
      { path: "/grignons", element: <ModuleAVenir titre="Grignons" /> },
      { path: "/config", element: <ModuleAVenir titre="Configuration" /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
