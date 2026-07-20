// src/lib/navigation.ts
//
// Entrées du menu latéral et logique de visibilité selon le rôle.
// Fonction pure et testable (C2.2.2) : Sidebar.tsx ne fait qu'afficher
// getVisibleMenuItems(role), toute la logique de filtrage vit ici.
import type { LucideIcon } from "lucide-react";
import { Home, Truck, Factory, Users, Warehouse, Receipt, Recycle, Settings } from "lucide-react";

export interface MenuItem {
  label: string;
  path: string;
  icon: LucideIcon;
  // true = uniquement visible pour le rôle GERANT. C'est un filtre
  // d'UX (éviter d'afficher un lien vers un écran de gestion à un
  // opérateur) — PAS une mesure de sécurité. La vraie protection reste
  // le RLS et les triggers côté base : un opérateur qui devinerait
  // l'URL /config ou appellerait l'API directement doit être bloqué
  // là-bas, pas ici. Voir protect_client_archiving (module Clients)
  // pour un exemple déjà en place de ce principe : le bouton est caché
  // côté React, mais c'est un trigger PostgreSQL qui refuse réellement
  // l'opération.
  gerantOnly?: boolean;
}

export const MENU_ITEMS: MenuItem[] = [
  { label: "Accueil", path: "/dashboard", icon: Home },
  { label: "Dépôts", path: "/depots", icon: Truck },
  { label: "Pressage", path: "/pressages", icon: Factory },
  { label: "Clients", path: "/clients", icon: Users },
  { label: "Stocks", path: "/stocks", icon: Warehouse },
  { label: "Factures", path: "/factures", icon: Receipt },
  { label: "Grignons", path: "/grignons", icon: Recycle },
  { label: "Configuration", path: "/config", icon: Settings, gerantOnly: true },
];

export function getVisibleMenuItems(role: string | undefined): MenuItem[] {
  return MENU_ITEMS.filter((item) => !item.gerantOnly || role === "GERANT");
}
