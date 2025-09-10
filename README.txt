
VariedadesLA — Refactor completa y funcional (copia fiel)
=========================================================
- Este paquete mantiene la UI y la lógica tal cual la original,
  pero mueve el gran <script> inline a un módulo: js/original.js.
- Resultado: "refactorizada" (código modular) y 100% funcional como la original.

Cómo abrir:
1) VSCode + Live Server sobre index.html.
2) Si tenías un Service Worker anterior, DevTools → Application → Unregister y Ctrl+Shift+R.

Notas:
- sw.js ajustado para no cachear CDNs (evita CORS en Live Server).
- netlify/functions/get-gemini-analysis.js incluido (mock).
