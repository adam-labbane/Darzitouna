import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestHead } from "../../functions/sonde-api.js";

// Fichier en .js (et non .ts) volontairement : la Function est du JavaScript
// exécuté par Cloudflare, hors du périmètre de `tsc -b` (limité à src/*.ts).

const ENV = {
  SUPABASE_ANON_KEY: "cle-anon-de-test",
  VITE_SUPABASE_URL: "https://projet-test.supabase.co",
};

const TIMEOUT_DEPASSE = 5000;

function stubFetch(implementation) {
  const spy = vi.fn(implementation);
  vi.stubGlobal("fetch", spy);
  return spy;
}

const okResponse = () => new Response("[]", { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sonde-api", () => {
  it("répond 200 ok quand Supabase renvoie un tableau JSON", async () => {
    stubFetch(okResponse);

    const response = await onRequestGet({ env: ENV });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(typeof body.latency_ms).toBe("number");
  });

  it("interdit la mise en cache de la réponse", async () => {
    stubFetch(okResponse);

    const response = await onRequestGet({ env: ENV });

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("transmet la clé en en-tête et jamais dans l'URL", async () => {
    const fetchSpy = stubFetch(okResponse);

    await onRequestGet({ env: ENV });
    const [url, init] = fetchSpy.mock.calls[0];

    expect(url).toBe(
      "https://projet-test.supabase.co/rest/v1/rpc/get_ticket_public" +
        "?p_token=sonde-supervision",
    );
    expect(url).not.toContain(ENV.SUPABASE_ANON_KEY);
    expect(init.headers.apikey).toBe(ENV.SUPABASE_ANON_KEY);
  });

  it("répond 503 avec le code amont quand Supabase est en erreur", async () => {
    stubFetch(() => new Response("boom", { status: 500 }));

    const response = await onRequestGet({ env: ENV });

    expect(response.status).toBe(503);
    expect((await response.json()).reason).toBe("upstream_http_500");
  });

  it("répond 503 quand un 200 ne contient pas du JSON", async () => {
    stubFetch(() => new Response("<html>maintenance</html>", { status: 200 }));

    const response = await onRequestGet({ env: ENV });

    expect(response.status).toBe(503);
    expect((await response.json()).reason).toBe("invalid_json");
  });

  it("répond 503 quand la charge utile n'est pas un tableau", async () => {
    stubFetch(() => new Response('{"message":"erreur"}', { status: 200 }));

    const response = await onRequestGet({ env: ENV });

    expect(response.status).toBe(503);
    expect((await response.json()).reason).toBe("unexpected_payload");
  });

  it("répond 503 timeout au-delà de 5 s, sans attendre Supabase", async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const pending = onRequestGet({ env: ENV });
    await vi.advanceTimersByTimeAsync(TIMEOUT_DEPASSE);
    const response = await pending;

    expect(response.status).toBe(503);
    expect((await response.json()).reason).toBe("timeout");
  });

  it("répond 503 fetch_failed quand le réseau échoue", async () => {
    stubFetch(() => Promise.reject(new TypeError("network error")));

    const response = await onRequestGet({ env: ENV });

    expect(response.status).toBe(503);
    expect((await response.json()).reason).toBe("fetch_failed");
  });

  it("vire au rouge si la clé n'est pas configurée, sans appeler Supabase", async () => {
    const fetchSpy = stubFetch(okResponse);

    const response = await onRequestGet({ env: { VITE_SUPABASE_URL: ENV.VITE_SUPABASE_URL } });

    expect(response.status).toBe(503);
    expect((await response.json()).reason).toBe("missing_env:SUPABASE_ANON_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("nomme l'URL absente quand c'est elle qui manque", async () => {
    stubFetch(okResponse);

    const response = await onRequestGet({
      env: { SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY },
    });

    expect((await response.json()).reason).toBe(
      "missing_env:SUPABASE_URL|VITE_SUPABASE_URL",
    );
  });

  it("nomme les deux variables quand rien n'est configuré", async () => {
    stubFetch(okResponse);

    const response = await onRequestGet({ env: {} });

    expect((await response.json()).reason).toBe(
      "missing_env:SUPABASE_URL|VITE_SUPABASE_URL,SUPABASE_ANON_KEY",
    );
  });

  it("répond aussi en HEAD, sondé par certains moniteurs", async () => {
    stubFetch(okResponse);

    const response = await onRequestHead({ env: ENV });

    expect(response.status).toBe(200);
  });
});
