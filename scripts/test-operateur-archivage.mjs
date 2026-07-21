#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const AHMED_ID = "44444444-4444-4444-4444-444444444444";
const AHMED_PIN = "0000";

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
