// `fetch` es global en Node 18+, no se requiere importar `node-fetch`.

/*
 * Serverless function to create a new seller (usuario con rol 'seller').
 * Este endpoint se invoca desde el frontend cuando un administrador desea
 * registrar a un nuevo vendedor sin tener que acceder al panel de Supabase.
 *
 * Requiere que en las variables de entorno estén definidos:
 *   - SUPABASE_URL: la URL base del proyecto Supabase, por ejemplo
 *     https://xyzcompany.supabase.co
 *   - SUPABASE_SERVICE_ROLE_KEY: la clave de servicio de Supabase con
 *     permisos administrativos. Esta clave nunca se expone al frontend.
 *
 * El flujo que implementa es:
 *   1. Crear un usuario usando la API de administración de auth de Supabase
 *      mediante una llamada POST a /auth/v1/admin/users con email y password.
 *   2. Esperar brevemente para que el trigger de Supabase cree el perfil
 *      predeterminado con rol 'buyer'.
 *   3. Actualizar la fila en la tabla 'profiles' para establecer el rol
 *      'seller'. Utiliza la API REST de Supabase (servicio de PostgREST).
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    const { email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email y contraseña son obligatorios' }) };
    }
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Variables de entorno faltantes' }) };
    }
    // Paso 1: crear usuario
    const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const createUserData = await createUserRes.json();
    if (!createUserRes.ok) {
      const errorMsg = createUserData?.message || createUserData?.error || 'Error creando usuario';
      return { statusCode: createUserRes.status, body: JSON.stringify({ error: errorMsg }) };
    }
    const userId = createUserData.user?.id;
    if (!userId) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo obtener ID del usuario' }) };
    }
    // Espera breve para que el trigger cree la fila del perfil
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Paso 2: actualizar rol a 'seller'
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ role: 'seller' })
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok) {
      const errMsg = updateData?.message || updateData?.error || 'Error actualizando rol';
      return { statusCode: updateRes.status, body: JSON.stringify({ error: errMsg }) };
    }
    return { statusCode: 200, body: JSON.stringify({ message: 'Vendedor creado', userId }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal Server Error' }) };
  }
};