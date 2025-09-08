// netlify/functions/create-seller.js
exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    // Fallback por si el runtime no trae fetch global
    if (typeof fetch === "undefined") {
      const { default: f } = await import("node-fetch"); globalThis.fetch = f;
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing envs", { hasUrl: !!SUPABASE_URL, hasKey: !!SERVICE_ROLE_KEY });
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }) };
    }

    const { email, password } = JSON.parse(event.body || "{}");
    if (!email || !password || password.length < 6) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Email y password (≥6) requeridos" }) };
    }

    // 1) Crear usuario (admin API)
    const resCreate = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });

    const createText = await resCreate.text();
    let createJson; try { createJson = JSON.parse(createText); } catch { createJson = { raw: createText }; }

    if (!resCreate.ok) {
      console.error("Create user failed", resCreate.status, createJson);
      return { statusCode: resCreate.status, headers: cors, body: JSON.stringify({ error: "No se pudo crear el usuario", detail: createJson }) };
    }

    // Extraer id de posibles formatos
    let userId =
      (createJson && createJson.id) ||
      (createJson && createJson.user && createJson.user.id) ||
      (Array.isArray(createJson) && createJson[0] && createJson[0].id) ||
      null;

    // 2) Si no vino el id, buscar por email
    if (!userId) {
      const resLookup = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      });
      const lookupText = await resLookup.text();
      let lookupJson; try { lookupJson = JSON.parse(lookupText); } catch { lookupJson = { raw: lookupText }; }

      if (resLookup.ok) {
        if (Array.isArray(lookupJson) && lookupJson.length > 0) {
          userId = lookupJson[0].id;
        } else if (lookupJson && lookupJson.user && lookupJson.user.id) {
          userId = lookupJson.user.id;
        }
      } else {
        console.error("Lookup by email failed", resLookup.status, lookupJson);
      }
    }

    if (!userId) {
      console.error("No userId after create/lookup", createJson);
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "No se pudo obtener ID del usuario", detail: createJson }) };
    }

    // 3) Upsert de perfil con rol seller
    const resUpsert = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ id: userId, role: "seller" }),
    });

    const upsertText = await resUpsert.text();
    let upsertJson; try { upsertJson = JSON.parse(upsertText); } catch { upsertJson = { raw: upsertText }; }

    if (!resUpsert.ok) {
      console.error("Upsert profile failed", resUpsert.status, upsertJson);
      return { statusCode: resUpsert.status, headers: cors, body: JSON.stringify({ error: "Usuario creado pero no se pudo asignar rol seller", detail: upsertJson }) };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, userId }) };
  } catch (err) {
    console.error("Unhandled error create-seller", err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Error interno", detail: String(err) }) };
  }
};
