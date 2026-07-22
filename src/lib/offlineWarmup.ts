import type { SupabaseClient } from "@supabase/supabase-js";
import { getCuves } from "./cuves";
import { getClients } from "./clients";
import { getSaisons } from "./saisons";
import { getDepots } from "./depots";
import type { Saison } from "../types/saison";

const OFFLINE_DATA_CACHE_NAME = "supabase-data";

export async function warmOfflineCache(client: SupabaseClient): Promise<void> {
  if (!navigator.onLine) return;

  const saisonsPromise = getSaisons(client).catch(() => [] as Saison[]);

  const tasks: Promise<unknown>[] = [getCuves(client), getClients(client), saisonsPromise];

  const saisons = await saisonsPromise;
  const activeSaison = saisons.find((saison) => saison.is_active);
  if (activeSaison) {
    tasks.push(getDepots(client, activeSaison.id));
  }

  await Promise.allSettled(tasks);
}

export async function clearOfflineCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(OFFLINE_DATA_CACHE_NAME).catch(() => {});
}
