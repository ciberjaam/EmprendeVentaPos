/*
 * Netlify Function: manage-seller
 *
 * Este endpoint permite al administrador gestionar las cuentas de vendedores.
 * Proporciona tres operaciones:
 *
 * - GET: Devuelve la lista de vendedores registrados (id y email).
 * - PUT: Actualiza la contraseña de un vendedor específico.
 * - DELETE: Elimina a un vendedor específico.
 *
 * Las operaciones utilizan la API de administración de Supabase a través de
 * peticiones HTTP, empleando la clave de servicio (SERVICE_ROLE_KEY).
 */

exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Faltan variables de entorno SUPABASE_URL o SERVICE_ROLE_KEY' }) };
  }
  // Helper to call Supabase REST
  const requestSupabase = async (url, options = {}) => {
    const res = await fetch(url, options);
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = txt; }
    return { status: res.status, ok: res.ok, data };
  };
  if (event.httpMethod === 'GET') {
    // Lista de vendedores: obtenemos los IDs de la tabla profiles con rol 'seller'
    const profilesUrl = `${SUPABASE_URL}/rest/v1/profiles?role=eq.seller&select=id`;
    const profilesRes = await requestSupabase(profilesUrl, {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!profilesRes.ok) {
      return { statusCode: profilesRes.status, body: JSON.stringify({ message: 'Error obteniendo perfiles', detail: profilesRes.data }) };
    }
    const sellers = profilesRes.data;
    const result = [];
    for (const seller of sellers) {
      const uid = seller.id;
      const userRes = await requestSupabase(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
        method: 'GET',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (userRes.ok && userRes.data) {
        result.push({ id: uid, email: userRes.data.email });
      }
    }
    return { statusCode: 200, body: JSON.stringify(result) };
  }
  if (event.httpMethod === 'PUT' || event.httpMethod === 'PATCH') {
    // Actualizar contraseña: requiere JSON con { id, password }.
    // Supabase Admin API utiliza el método PATCH en el endpoint /auth/v1/admin/users/{id}
    // para actualizar atributos como la contraseña.  Algunas versiones de la API
    // también aceptan PUT, pero PATCH es el método recomendado.
    let body;
    try { body = JSON.parse(event.body); } catch { body = {}; }
    const { id, password } = body;
    if (!id || !password) {
      return { statusCode: 400, body: JSON.stringify({ message: 'id y password son obligatorios' }) };
    }
    const updateRes = await requestSupabase(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });
    if (!updateRes.ok) {
      return { statusCode: updateRes.status, body: JSON.stringify({ message: 'Error actualizando contraseña', detail: updateRes.data }) };
    }
    return { statusCode: 200, body: JSON.stringify({ message: 'Contraseña actualizada' }) };
  }
  if (event.httpMethod === 'DELETE') {
    // Eliminar vendedor: se espera query param id
    const params = new URLSearchParams(event.queryStringParameters || {});
    const id = params.get('id');
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ message: 'id es obligatorio para eliminar' }) };
    }
    const deleteRes = await requestSupabase(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!deleteRes.ok) {
      return { statusCode: deleteRes.status, body: JSON.stringify({ message: 'Error eliminando usuario', detail: deleteRes.data }) };
    }
    // La eliminación en auth.users eliminará también su perfil gracias al ON DELETE CASCADE
    return { statusCode: 200, body: JSON.stringify({ message: 'Vendedor eliminado' }) };
  }
  return { statusCode: 405, body: JSON.stringify({ message: 'Método no permitido' }) };
};