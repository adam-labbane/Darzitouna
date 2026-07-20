#!/usr/bin/env node
// scripts/test-operateur-archivage.mjs
//
// Preuve exécutable que le trigger protect_client_archiving (migration
// 20260720100000_client_soft_delete.sql) bloque bien un OPERATEUR qui
// tente d'archiver un client, y compris en contournant complètement
// l'UI (requête PATCH directe sur la table, comme le ferait quelqu'un
// qui ouvre la console du navigateur). C'est la preuve que la vraie
// protection est en base, pas le fait de cacher le bouton côté React.
//
// Usage : npx supabase start && npx supabase db reset && node scripts/test-operateur-archivage.mjs
//
// Clés de démo fixes du Supabase CLI local (affichées en clair par
// `supabase status`) : ne JAMAIS pointer ce script vers un projet
// Supabase réel/hébergé.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Ahmed Trabelsi — opérateur de "Huilerie Mohamed" (huilerie A). Voir supabase/seed.sql.
const AHMED_ID = "44444444-4444-4444-4444-444444444444";
const AHMED_PIN = "0000";

// "Client Huilerie A", client de seed appartenant à la même huilerie
// qu'Ahmed — donc visible et normalement modifiable par lui (RLS OK),
// seul l'archivage doit être refusé (rôle).
const CLIENT_A_ID = "88888888-8888-8888-8888-888888888888";

async function deriveAuthPassword(userId, pin) {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✅ ${message}`);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  const password = await deriveAuthPassword(AHMED_ID, AHMED_PIN);
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: `${AHMED_ID}@darzitouna.local`,
    password,
  });
  if (loginError) {
    fail(`Connexion d'Ahmed échouée : ${loginError.message}`);
    return;
  }
  ok("Session ouverte pour Ahmed (OPERATEUR)");

  // Tentative d'archivage via UPDATE direct sur deleted_at — exactement
  // ce que ferait un appel API tapé à la main, sans passer par le
  // bouton "Archiver" (absent de l'UI pour un opérateur).
  const { data, error } = await supabase
    .from("client")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", CLIENT_A_ID)
    .select();

  if (error?.code === "P0001") {
    ok(`Trigger déclenché comme attendu : "${error.message}"`);
  } else if (error) {
    fail(`Erreur inattendue (pas P0001) : [${error.code}] ${error.message}`);
  } else if ((data?.length ?? 0) > 0) {
    fail("FUITE CRITIQUE : l'opérateur a réussi à archiver le client !");
  } else {
    fail("Aucune erreur P0001 et aucune ligne modifiée : résultat ambigu, à investiguer.");
  }

  await supabase.auth.signOut();

  if (process.exitCode === 1) {
    console.log("\nRésultat : LA PROTECTION PAR RÔLE NE FONCTIONNE PAS — voir l'erreur ci-dessus.");
  } else {
    console.log("\nRésultat : un opérateur ne peut pas archiver un client, confirmé.");
  }
}

main();
