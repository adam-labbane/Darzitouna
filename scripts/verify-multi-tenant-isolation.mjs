#!/usr/bin/env node
// scripts/verify-multi-tenant-isolation.mjs
//
// Preuve exécutable (pas un test Vitest — nécessite le vrai Supabase local
// en marche) que la session Auth d'un utilisateur d'une huilerie ne permet
// JAMAIS de lire ou modifier les données d'une autre huilerie, même en
// requête directe sur la table (supabase.from("client")...), sans passer
// par aucune fonction RPC dédiée.
//
// Usage : npx supabase start && npx supabase db reset && node scripts/verify-multi-tenant-isolation.mjs
//
// Les identifiants ci-dessous sont les clés de démo fixes du Supabase CLI
// local (affichées en clair par `supabase status`) : ne JAMAIS pointer ce
// script vers un projet Supabase réel/hébergé.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Mohamed — gérant de "Huilerie Mohamed" (huilerie A). Voir supabase/seed.sql.
const USER_A_ID = "33333333-3333-3333-3333-333333333333";
const USER_A_PIN = "1234";
const HUILERIE_B_ID = "55555555-5555-5555-5555-555555555555";
const CLIENT_B_ID = "99999999-9999-9999-9999-999999999999";

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

  const password = await deriveAuthPassword(USER_A_ID, USER_A_PIN);
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: `${USER_A_ID}@darzitouna.local`,
    password,
  });
  if (loginError) {
    fail(`Connexion de l'utilisateur A échouée : ${loginError.message}`);
    return;
  }
  ok("Session ouverte pour l'utilisateur de la huilerie A");

  // 1. Lecture sans filtre : la huilerie B ne doit jamais apparaître.
  const { data: allClients, error: readError } = await supabase
    .from("client")
    .select("id, huilerie_id");
  if (readError) {
    fail(`Lecture de la table client échouée : ${readError.message}`);
    return;
  }
  const leaked = allClients.filter((c) => c.huilerie_id === HUILERIE_B_ID);
  if (leaked.length > 0) {
    fail(`FUITE : ${leaked.length} client(s) de la huilerie B visibles par un utilisateur de la huilerie A`);
  } else {
    ok(`Aucun client de la huilerie B visible (${allClients.length} client(s) vus, tous de la huilerie A)`);
  }

  // 2. Lecture ciblée directe par id : RLS doit renvoyer 0 ligne, pas une erreur.
  const { data: targeted, error: targetedError } = await supabase
    .from("client")
    .select("id")
    .eq("id", CLIENT_B_ID);
  if (targetedError) {
    fail(`Requête ciblée échouée : ${targetedError.message}`);
  } else if ((targeted?.length ?? 0) > 0) {
    fail("FUITE : le client de la huilerie B est lisible par id direct");
  } else {
    ok("Requête ciblée sur le client de la huilerie B : 0 ligne (RLS bloque silencieusement)");
  }

  // 3. Tentative d'écriture sur une ligne d'une autre huilerie : doit
  // affecter 0 ligne (RLS bloque aussi UPDATE/DELETE, pas seulement SELECT).
  const { data: updated, error: updateError } = await supabase
    .from("client")
    .update({ telephone: "HACKED" })
    .eq("id", CLIENT_B_ID)
    .select();
  if (updateError) {
    fail(`Tentative de modification échouée avec une erreur inattendue : ${updateError.message}`);
  } else if ((updated?.length ?? 0) > 0) {
    fail("FUITE CRITIQUE : un utilisateur de la huilerie A a pu modifier un client de la huilerie B");
  } else {
    ok("Tentative de modification du client de la huilerie B : 0 ligne affectée");
  }

  await supabase.auth.signOut();

  if (process.exitCode === 1) {
    console.log("\nRésultat : ISOLATION MULTI-TENANT VIOLÉE — voir les erreurs ci-dessus.");
  } else {
    console.log("\nRésultat : isolation multi-tenant confirmée par 3 vérifications indépendantes.");
  }
}

main();
