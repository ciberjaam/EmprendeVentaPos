const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const body = JSON.parse(event.body || "{}");
    const { prompt, name, category, description, salesSummary } = body;

    // Si no hay API key -> responder mock seguro
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      const analysis =
        `Resumen (MOCK) para "${name || "Producto"}" (${category || "N/D"}):\n` +
        `- ${description || "Descripción no provista"}\n` +
        `- Ventas del día: ${salesSummary || "N/D"}\n` +
        `Sugerencia: Optimiza títulos e imágenes para mejorar conversión.`;
      return { statusCode: 200, headers, body: JSON.stringify({ analysis, mode: "mock" }) };
    }

    // Llamada real a Gemini (Generative Language API)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const userText =
      prompt ||
      `Analiza estas ventas y redacta insights y recomendaciones breves:\n${salesSummary || ""}\n` +
      `Producto: ${name || ""} | Categoría: ${category || ""} | Desc: ${description || ""}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userText }] }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: err }) };
    }

    const data = await resp.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      JSON.stringify(data);

    return { statusCode: 200, headers, body: JSON.stringify({ analysis: text, mode: "gemini" }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
