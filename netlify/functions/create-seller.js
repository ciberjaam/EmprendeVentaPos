// `fetch` is provided by the Node 18 runtime. We intentionally avoid
// importing node-fetch here to reduce bundle size.  This function
// creates or promotes a user to a seller by interacting with the
// Supabase management API.  It is invoked by the frontend when an
// administrator registers a new vendor without using the Supabase UI.

/*
 * Environment variables required:
 *   - SUPABASE_URL: base URL of the Supabase project (e.g. https://xyz.supabase.co)
 *   - SUPABASE_SERVICE_ROLE_KEY: service role API key with admin privileges
 *
 * Flow implemented:
 *   1. Attempt to create a new auth user via POST /auth/v1/admin/users
 *   2. If the user already exists (422) or an ID isn't returned, perform a
 *      lookup by email to obtain the existing user ID.
 *   3. Upsert a row into the `profiles` table with the obtained user ID
 *      and the role set to 'seller'.  Using an upsert (Prefer:
 *      resolution=merge-duplicates) ensures the role is overwritten if the
 *      profile already exists and gracefully handles the situation where the
 *      trigger that creates a profile has not yet fired.
 */

exports.handler = async (event) => {
  // Only POST requests are accepted.  Respond with 405 for others.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    // Parse incoming JSON body
    const { email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email y contraseña son obligatorios' }) };
    }
    const SUPABASE_URL  = process.env.SUPABASE_URL;
    const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Variables de entorno faltantes' }) };
    }

    // 1. Attempt to create the user.  If the user already exists (status 422) the
    //    returned JSON may not include an id, so we handle that separately below.
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    let createJson;
    try {
      createJson = await createRes.json();
    } catch (_) {
      createJson = {};
    }
    let userId = createJson?.user?.id || createJson?.id || null;

    // 2. If a user ID was not returned or the create call returned a 422, lookup
    //    the user by email.  This handles the case where the user already
    //    exists.  Without this, the function would return an error when
    //    attempting to create a duplicate user.
    if (createRes.status === 422 || !userId) {
      const lookupRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`
        }
      });
      const lookupJson = await lookupRes.json();
      // Supabase returns either an array of users or an object with a user
      userId = lookupJson?.[0]?.id || lookupJson?.user?.id || null;
      if (!userId) {
        return { statusCode: 422, body: JSON.stringify({ error: 'No se pudo obtener ID de usuario' }) };
      }
    }

    // 3. Upsert into profiles with role 'seller'.  Using a POST with
    //    Prefer: resolution=merge-duplicates means that if a profile exists
    //    (perhaps created by a trigger with a default role of buyer) it will
    //    be merged and the role will be updated to seller.  If a profile does
    //    not yet exist, this call will create it.  This avoids timing issues
    //    related to waiting for triggers.
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: userId, role: 'seller' })
    });
    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: 'Falló al asignar rol seller', detail: errText }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Vendedor creado', userId }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};