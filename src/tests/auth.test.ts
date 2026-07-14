// src/tests/auth.test.ts
//
// Les fonctions de src/lib/auth.ts prennent le client Supabase en paramètre :
// on peut donc les tester avec un client simulé, sans réseau ni variables
// d'environnement Supabase.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLoginUsers, verifyUserPin } from "../lib/auth";

function mockClient(rpc: SupabaseClient["rpc"]): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

describe("fetchLoginUsers", () => {
  it("appelle get_login_users avec le tenant_id et renvoie les données", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "1", nom_complet: "Ali Ben Salah", role: "operateur" }],
      error: null,
    });

    const users = await fetchLoginUsers(mockClient(rpc), "huilerie-123");

    expect(rpc).toHaveBeenCalledWith("get_login_users", { tenant_id: "huilerie-123" });
    expect(users).toEqual([{ id: "1", nom_complet: "Ali Ben Salah", role: "operateur" }]);
  });

  it("renvoie un tableau vide si data est null", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const users = await fetchLoginUsers(mockClient(rpc), "huilerie-123");
    expect(users).toEqual([]);
  });

  it("propage l'erreur Supabase (réseau, RLS, etc.)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("network") });
    await expect(fetchLoginUsers(mockClient(rpc), "huilerie-123")).rejects.toThrow("network");
  });
});

describe("verifyUserPin", () => {
  it("renvoie true uniquement si data est strictement true", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const ok = await verifyUserPin(mockClient(rpc), "user-1", "1234");

    expect(rpc).toHaveBeenCalledWith("verify_pin", { user_id: "user-1", pin_attempt: "1234" });
    expect(ok).toBe(true);
  });

  it("renvoie false si le PIN est incorrect", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const ok = await verifyUserPin(mockClient(rpc), "user-1", "0000");
    expect(ok).toBe(false);
  });

  it("propage l'erreur Supabase sans jamais l'avaler silencieusement", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("timeout") });
    await expect(verifyUserPin(mockClient(rpc), "user-1", "1234")).rejects.toThrow("timeout");
  });
});
