import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveAuthPassword, internalEmailFor } from "./authPassword";

export interface LoginUser {
  id: string;
  nom_complet: string;
  role: string;
}

export async function fetchLoginUsers(
  client: SupabaseClient,
  huilerieId: string,
): Promise<LoginUser[]> {
  const { data, error } = await client.rpc("get_login_users", {
    tenant_id: huilerieId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function verifyUserPin(
  client: SupabaseClient,
  userId: string,
  pinAttempt: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("verify_pin", {
    user_id: userId,
    pin_attempt: pinAttempt,
  });
  if (error) throw error;
  return data === true;
}

export async function startSession(
  client: SupabaseClient,
  userId: string,
  pin: string,
): Promise<void> {
  const password = await deriveAuthPassword(userId, pin);
  const { error } = await client.auth.signInWithPassword({
    email: internalEmailFor(userId),
    password,
  });
  if (error) throw error;
}

export async function endSession(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
