const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "OK" };
  }

  try {
    if (event.httpMethod === "GET") {
      // Listar vendedores
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?role=eq.seller`, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
      });
      const sellers = await res.json();
      return { statusCode: 200, headers: cors, body: JSON.stringify(sellers) };
    }

    if (event.httpMethod === "POST") {
      // Cambiar contraseña
      const { userId, newPassword } = JSON.parse(event.body || "{}");
      if (!userId || !newPassword) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Faltan parámetros" }) };
      }
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
      });
      return { statusCode: res.ok ? 200 : 500, headers: cors, body: await res.text() };
    }

    if (event.httpMethod === "DELETE") {
      // Eliminar vendedor
      const { userId } = JSON.parse(event.body || "{}");
      if (!userId) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Falta userId" }) };
      }
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
      });
      return { statusCode: res.ok ? 200 : 500, headers: cors, body: await res.text() };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Método no permitido" }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
