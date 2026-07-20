// src/tests/auth.test.ts
//
// Les fonctions de src/lib/auth.ts prennent le client Supabase en paramètre :
// on peut donc les tester avec un client simulé, sans réseau ni variables
// d'environnement Supabase.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { endSession, fetchLoginUsers, startSession, verifyUserPin } from "../lib/auth";

function mockClient(rpc: SupabaseClient["rpc"]): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

function mockAuthClient(signInWithPassword: ReturnType<typeof vi.fn>): SupabaseClient {
  return { auth: { signInWithPassword } } as unknown as SupabaseClient;
}

function mockSignOutClient(signOut: ReturnType<typeof vi.fn>): SupabaseClient {
  return { auth: { signOut } } as unknown as SupabaseClient;
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

describe("startSession", () => {
  it("appelle signInWithPassword avec l'email interne et le mot de passe dérivé du PIN", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: {}, error: null });

    await startSession(mockAuthClient(signInWithPassword), "user-1", "1234");

    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    const call = signInWithPassword.mock.calls[0][0] as { email: string; password: string };
    expect(call.email).toBe("user-1@darzitouna.local");
    // Le mot de passe ne doit jamais être le PIN en clair.
    expect(call.password).not.toBe("1234");
    expect(call.password).toMatch(/^[0-9a-f]{64}$/);
  });

  it("propage l'erreur si signInWithPassword échoue (ex: panne réseau)", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {},
      error: new Error("network"),
    });

    await expect(
      startSession(mockAuthClient(signInWithPassword), "user-1", "1234"),
    ).rejects.toThrow("network");
  });
});

describe("endSession", () => {
  it("appelle signOut() pour invalider la session côté serveur", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await endSession(mockSignOutClient(signOut));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("propage l'erreur si signOut() échoue", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error("network") });

    await expect(endSession(mockSignOutClient(signOut))).rejects.toThrow("network");
  });
});
