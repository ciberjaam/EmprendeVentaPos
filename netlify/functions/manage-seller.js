// netlify/functions/manage-seller.js
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }) };
    }

    const headersJson = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };

    // Helper: obtener user por email (admin API)
    const getUserByEmail = async (email) => {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: headersJson });
      const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
      if (!r.ok) throw new Error(`lookup ${r.status}: ${t}`);
      if (Array.isArray(j) && j[0]) return j[0];
      if (j && j.user) return j.user;
      return null;
    };

    // GET: lista sellers con email
    if (event.httpMethod === "GET") {
      const q = (event.queryStringParameters && event.queryStringParameters.q) || "";

      // 1) perfiles con rol seller
      const rProf = await fetch(`${SUPABASE_URL}/rest/v1/profiles?role=eq.seller&select=id`, { headers: headersJson });
      const prof = await rProf.json();
      const ids = (Array.isArray(prof) ? prof : []).map(p => p.id);

      // 2) para cada id, trae el email desde auth
      const sellers = [];
      for (const id of ids) {
        const rUser = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: headersJson });
        const ut = await rUser.text(); let uj; try { uj = JSON.parse(ut); } catch { uj = {}; }
        const email = uj.email || (uj.user && uj.user.email) || "";
        if (!q || email.toLowerCase().includes(q.toLowerCase())) {
          sellers.push({ id, email });
        }
      }
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, sellers }) };
    }

    // PATCH: cambiar contraseña (por userId o email)
    if (event.httpMethod === "PATCH") {
      const { userId, email, password } = JSON.parse(event.body || "{}");
      if ((!userId && !email) || !password || password.length < 6) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Requiere userId o email, y password ≥ 6" }) };
      }
      const id = userId || (await getUserByEmail(email))?.id;
      if (!id) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Usuario no encontrado" }) };

      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: "PUT", headers: headersJson, body: JSON.stringify({ password })
      });
      const txt = await r.text();
      return { statusCode: r.ok ? 200 : r.status, headers: cors, body: r.ok ? JSON.stringify({ ok:true, id }) : txt };
    }

    // DELETE: eliminar vendedor (por userId o email)
    if (event.httpMethod === "DELETE") {
      const { userId, email } = JSON.parse(event.body || "{}");
      if (!userId && !email) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Requiere userId o email" }) };
      }
      const id = userId || (await getUserByEmail(email))?.id;
      if (!id) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Usuario no encontrado" }) };

      // borra profile (por si existe)
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, { method: "DELETE", headers: headersJson });
      // borra usuario auth
      const rDel = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: headersJson });
      const txt = await rDel.text();
      return { statusCode: rDel.ok ? 200 : rDel.status, headers: cors, body: rDel.ok ? JSON.stringify({ ok:true }) : txt };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(err) }) };
  }
};
