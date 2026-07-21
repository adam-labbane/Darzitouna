#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const MOHAMED_ID = "33333333-3333-3333-3333-333333333333";
const AHMED_ID = "44444444-4444-4444-4444-444444444444";
const SAISON_A = "22222222-2222-2222-2222-222222222222";

const CUVE_1_ID = "cccccccc-cccc-cccc-cccc-ccccccccccc1";
const CUVE_4_ID = "cccccccc-cccc-cccc-cccc-ccccccccccc4";

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

async function loginAs(userId, pin) {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const password = await deriveAuthPassword(userId, pin);
  const { error } = await supabase.auth.signInWithPassword({
    email: `${userId}@darzitouna.local`,
    password,
  });
  if (error) throw new Error(`Connexion échouée pour ${userId} : ${error.message}`);
  return supabase;
}

async function testBug1CorrectionDepasseCapacite() {
  const mohamed = await loginAs(MOHAMED_ID, "1234");

  const { error } = await mohamed.from("mvt_stock_huile").insert({
    cuve_id: CUVE_1_ID,
    saison_id: SAISON_A,
    type: "CORRECTION",
    quantite_delta: 1500,
    note: "test régression bug 1",
  });

  if (error?.code === "P0001" && error.message.includes("dépasserait la capacité")) {
    ok(`Bug 1a (correction > capacité) — trigger déclenché : "${error.message}"`);
  } else if (!error) {
    fail("Bug 1a — FUITE : une correction dépassant la capacité a été acceptée !");
  } else {
    fail(`Bug 1a — erreur inattendue : [${error.code}] ${error.message}`);
  }

  const { data: cuve } = await mohamed
    .from("cuve")
    .select("capacite_max, niveau_actuel")
    .eq("id", CUVE_1_ID)
    .single();
  if (cuve?.capacite_max === 2000 && cuve?.niveau_actuel === 1500) {
    ok("Bug 1a — Cuve 1 inchangée après la tentative (2000 L / 1500 L)");
  } else {
    fail(`Bug 1a — Cuve 1 modifiée de façon inattendue : ${JSON.stringify(cuve)}`);
  }

  await mohamed.auth.signOut();
}

async function testBug1EditionCapaciteSousNiveau() {
  const mohamed = await loginAs(MOHAMED_ID, "1234");

  const { error } = await mohamed
    .from("cuve")
    .update({ capacite_max: 1000 })
    .eq("id", CUVE_1_ID);

  if (error?.code === "23514") {
    ok(`Bug 1b (capacité < niveau actuel) — contrainte CHECK déclenchée : "${error.message}"`);
  } else if (!error) {
    fail("Bug 1b — FUITE : la capacité a pu être baissée sous le niveau actuel !");
  } else {
    fail(`Bug 1b — erreur inattendue : [${error.code}] ${error.message}`);
  }

  await mohamed.auth.signOut();
}

async function testBug2ArchivageParOperateur() {
  const ahmed = await loginAs(AHMED_ID, "0000");

  const { data, error } = await ahmed
    .from("cuve")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", CUVE_4_ID)
    .select();

  if (error?.code === "P0001" && error.message.includes("gérant")) {
    ok(`Bug 2 (archivage par OPERATEUR) — trigger déclenché : "${error.message}"`);
  } else if (!error && (data?.length ?? 0) > 0) {
    fail("Bug 2 — FUITE CRITIQUE : l'opérateur a réussi à archiver la cuve !");
  } else {
    fail(`Bug 2 — résultat inattendu : erreur=${JSON.stringify(error)}, data=${JSON.stringify(data)}`);
  }

  await ahmed.auth.signOut();
}

async function main() {
  await testBug1CorrectionDepasseCapacite();
  await testBug1EditionCapaciteSousNiveau();
  await testBug2ArchivageParOperateur();

  if (process.exitCode === 1) {
    console.log("\nRésultat : AU MOINS UNE RÉGRESSION DÉTECTÉE — voir les erreurs ci-dessus.");
  } else {
    console.log("\nRésultat : les deux bugs de sécurité restent corrigés.");
  }
}

main();
