import type { LucideIcon } from "lucide-react";
import { Home, Truck, Factory, Users, Warehouse, Receipt, Recycle, Settings } from "lucide-react";

export interface MenuItem {
  label: string;
  path: string;
  icon: LucideIcon;
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
