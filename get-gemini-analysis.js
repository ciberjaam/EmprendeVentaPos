// Mock seguro: responde un análisis fijo y siempre funciona
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { name, category, description } = body;

    const analysis =
      `Resumen sugerido para "${name || "Producto"}" (${category || "N/D"}):\n` +
      `- Beneficios: sonido claro, batería de larga duración, conectividad estable.\n` +
      `- Público: usuarios móviles, gamers casuales, llamadas de trabajo.\n` +
      `- Descripción: ${description || "Producto de calidad con excelente relación precio/valor."}\n` +
      `Recomendación de copy: Disfruta libertad inalámbrica.`;

    return { statusCode: 200, headers, body: JSON.stringify({ analysis }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
