const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "OK" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { email, password } = JSON.parse(event.body || "{}");
    if (!email || !password) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Email y password requeridos" }) };
    }

    // Crear usuario
    const resCreate = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true })
    });

    const createText = await resCreate.text();
    let createJson;
    try { createJson = JSON.parse(createText); } catch { createJson = { raw: createText }; }

    let userId = createJson?.user?.id || createJson?.id || null;

    // Si el usuario ya existe (422)
    if (resCreate.status === 422 || !userId) {
      const resLookup = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
      });
      const lookupJson = await resLookup.json();
      userId = lookupJson?.[0]?.id || lookupJson?.user?.id || null;
      if (!userId) {
        return { statusCode: 422, headers: cors, body: JSON.stringify({ error: "No se pudo obtener ID de usuario" }) };
      }
    }

    // Upsert en profiles como seller
    const resUpsert = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({ id: userId, role: "seller" })
    });

    if (!resUpsert.ok) {
      const errText = await resUpsert.text();
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Falló al asignar rol seller", detail: errText }) };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, userId }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
