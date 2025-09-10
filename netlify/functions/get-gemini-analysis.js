
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { name, category, description } = body;
    const analysis = `Resumen sugerido para "${name}" (${category}):
- Beneficios: sonido claro, batería de larga duración, conectividad estable.
- Público: usuarios móviles, gamers casuales, llamadas de trabajo.
- Descripción: ${description || "Producto de calidad con excelente relación precio/valor."}
Recomendación de copy: Disfruta libertad inalámbrica con ${name}.`;
    return { statusCode: 200, headers: {"Content-Type":"application/json"}, body: JSON.stringify({ analysis }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
