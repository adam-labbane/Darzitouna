/**
 * Sonde de supervision — Cloudflare Pages Function.
 *
 * Exposée sur https://<domaine>/sonde-api pour un moniteur d'uptime externe.
 * Contrairement à une redirection `_redirects` (servie par l'edge Cloudflare
 * sans jamais contacter Supabase, donc verte même API morte), cette fonction
 * appelle réellement l'API côté serveur et reflète son état dans SON PROPRE
 * code HTTP : 200 si l'API répond, 503 sinon.
 *
 * Le token de sonde n'existe pas en base : la RPC traverse tout de même
 * PostgREST puis Postgres et la table `depot` avant de renvoyer `[]`. La sonde
 * vérifie donc la chaîne complète sans lire la moindre donnée métier.
 */

const PROBE_TOKEN = "sonde-supervision";
const TIMEOUT_MS = 5000;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestGet({ env }) {
  const baseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;

  // Une sonde mal configurée doit virer au rouge, pas passer silencieusement.
  if (!baseUrl || !anonKey) {
    return json({ status: "down", reason: "missing_env" }, 503);
  }

  const url =
    `${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_ticket_public` +
    `?p_token=${encodeURIComponent(PROBE_TOKEN)}`;

  // AbortController plutôt que AbortSignal.timeout : permet de distinguer un
  // dépassement de délai d'une erreur réseau dans la raison remontée.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  const startedAt = Date.now();

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        // La clé ne transite jamais par l'URL : ni logs Cloudflare, ni Referer.
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        accept: "application/json",
      },
      signal: controller.signal,
    });

    const latency_ms = Date.now() - startedAt;

    if (!upstream.ok) {
      return json(
        { status: "down", reason: `upstream_http_${upstream.status}`, latency_ms },
        503,
      );
    }

    const raw = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      // Un 200 renvoyant du HTML = page d'erreur d'un intermédiaire.
      return json({ status: "down", reason: "invalid_json", latency_ms }, 503);
    }

    if (!Array.isArray(payload)) {
      return json({ status: "down", reason: "unexpected_payload", latency_ms }, 503);
    }

    return json({ status: "ok", latency_ms }, 200);
  } catch {
    return json(
      {
        status: "down",
        reason: timedOut ? "timeout" : "fetch_failed",
        latency_ms: Date.now() - startedAt,
      },
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

// Plusieurs moniteurs (UptimeRobot notamment) sondent en HEAD avant GET :
// sans ce handler, ils recevraient un 405 et signaleraient une panne.
export const onRequestHead = onRequestGet;
