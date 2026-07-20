// src/App.tsx
import { createBrowserRouter, RouterProvider } from "react-router";
import AppGuard from "./components/AppGuard";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClientsList from "./pages/ClientsList";
import DepotsList from "./pages/DepotsList";
import DepotNouveau from "./pages/DepotNouveau";

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
    // Dashboard — protégé ET nécessite d'être connecté
    path: "/dashboard",
    element: (
      <AppGuard requireAuth>
        <Dashboard />
      </AppGuard>
    ),
  },
  {
    // Clients — protégé ET nécessite d'être connecté
    path: "/clients",
    element: (
      <AppGuard requireAuth>
        <ClientsList />
      </AppGuard>
    ),
  },
  {
    // Dépôts — protégé ET nécessite d'être connecté
    path: "/depots",
    element: (
      <AppGuard requireAuth>
        <DepotsList />
      </AppGuard>
    ),
  },
  {
    path: "/depots/nouveau",
    element: (
      <AppGuard requireAuth>
        <DepotNouveau />
      </AppGuard>
    ),
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;