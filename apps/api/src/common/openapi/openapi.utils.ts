type OpenApiSpec = Record<string, any>;

export function buildOpenApiSpec(opts: {
  title: string;
  version: string;
  serverUrl: string;
}): OpenApiSpec {
  const { title, version, serverUrl } = opts;
  return {
    openapi: "3.0.3",
    info: {
      title,
      version,
      description: "TD2 Builder API documentation",
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Catalog" },
      { name: "Builds" },
      { name: "Admin" },
      { name: "Monitor" },
      { name: "Audit" },
      { name: "AI" },
      { name: "Maps" },
      { name: "Imports" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "td2_at",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer" },
            error: { type: "string" },
            message: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
            path: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            "200": { description: "OK" },
          },
        },
      },
      "/auth/csrf": {
        get: {
          tags: ["Auth"],
          summary: "Get CSRF token",
          responses: { "200": { description: "CSRF token" } },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login with email/password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Logged in" },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Current authenticated user",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          responses: {
            "200": { description: "User profile" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/catalog/gear-items": {
        get: {
          tags: ["Catalog"],
          summary: "List gear items",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer" } },
            { in: "query", name: "pageSize", schema: { type: "integer" } },
            { in: "query", name: "slot", schema: { type: "string" } },
            { in: "query", name: "rarity", schema: { type: "string" } },
            { in: "query", name: "q", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Gear list" } },
        },
      },
      "/catalog/weapons": {
        get: {
          tags: ["Catalog"],
          summary: "List weapons",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer" } },
            { in: "query", name: "pageSize", schema: { type: "integer" } },
            { in: "query", name: "weaponClass", schema: { type: "string" } },
            { in: "query", name: "q", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Weapon list" } },
        },
      },
      "/builds": {
        post: {
          tags: ["Builds"],
          summary: "Create build",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          responses: { "200": { description: "Build created" } },
        },
      },
      "/builds/mine": {
        get: {
          tags: ["Builds"],
          summary: "List my builds",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          responses: { "200": { description: "My builds" } },
        },
      },
      "/admin/monitor": {
        get: {
          tags: ["Monitor"],
          summary: "Admin monitor summary",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          responses: {
            "200": { description: "Monitoring metrics" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/admin/audit": {
        get: {
          tags: ["Audit"],
          summary: "List audit logs",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          responses: { "200": { description: "Audit entries" } },
        },
      },
      "/ai/chat": {
        post: {
          tags: ["AI"],
          summary: "AI assistant chat",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          responses: { "200": { description: "AI response" } },
        },
      },
      "/maps": {
        get: {
          tags: ["Maps"],
          summary: "List farm maps",
          responses: { "200": { description: "Map list" } },
        },
      },
      "/imports/jobs": {
        get: {
          tags: ["Imports"],
          summary: "List import jobs",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          responses: { "200": { description: "Jobs" } },
        },
      },
    },
  };
}

export function buildSwaggerUiHtml(opts: { title: string; specUrl: string }): string {
  const { title, specUrl } = opts;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0b1220; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <div id="swagger-fallback" style="display:none;max-width:920px;margin:24px auto;padding:16px;border:1px solid #334155;border-radius:12px;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;">
    <h2 style="margin:0 0 8px 0;">Swagger UI unavailable</h2>
    <p style="margin:0 0 8px 0;">The interactive UI assets could not be loaded (likely blocked network/CDN).</p>
    <p style="margin:0;">Use raw OpenAPI JSON: <a href="${escapeHtml(specUrl)}" style="color:#7dd3fc;">${escapeHtml(specUrl)}</a></p>
  </div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    (function () {
      var fallback = document.getElementById('swagger-fallback');
      if (typeof SwaggerUIBundle !== 'function') {
        if (fallback) fallback.style.display = 'block';
        return;
      }
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
