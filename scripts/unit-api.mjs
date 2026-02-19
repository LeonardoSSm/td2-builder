import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeAuditPath,
  shouldAuditPath,
  sanitizeJsonForAudit,
  buildAuditMetaFromReq,
} = require("../apps/api/dist/common/http/audit.utils.js");
const { buildOpenApiSpec, buildSwaggerUiHtml } = require("../apps/api/dist/common/openapi/openapi.utils.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`OK  ${name}\n`);
  } catch (err) {
    failed += 1;
    process.stdout.write(`FAIL ${name}\n`);
    process.stdout.write(`     ${(err && err.stack) || err}\n`);
  }
}

test("normalizeAuditPath trims query/hash/trailing slash", () => {
  assert.equal(normalizeAuditPath("/api/auth/login/?x=1#y"), "/api/auth/login");
  assert.equal(normalizeAuditPath(""), "/");
});

test("shouldAuditPath ignores health and csrf routes", () => {
  assert.equal(shouldAuditPath("/api/health"), false);
  assert.equal(shouldAuditPath("/api/auth/csrf"), false);
  assert.equal(shouldAuditPath("/api/auth/login"), true);
});

test("sanitizeJsonForAudit removes undefined recursively", () => {
  const out = sanitizeJsonForAudit({
    ok: true,
    bad: undefined,
    nested: { x: 1, y: undefined },
    arr: [1, undefined, "z"],
  });
  assert.deepEqual(out, { ok: true, nested: { x: 1 }, arr: [1, "z"] });
});

test("buildAuditMetaFromReq includes login email but not password", () => {
  const meta = buildAuditMetaFromReq({
    originalUrl: "/api/auth/login?from=ui",
    body: { email: "ROOT@LOCAL.TEST", password: "secret" },
    query: { from: "ui" },
    params: {},
  });
  assert.equal(meta.email, "root@local.test");
  assert.equal(Object.prototype.hasOwnProperty.call(meta, "password"), false);
});

test("buildOpenApiSpec creates docs skeleton with auth and health", () => {
  const spec = buildOpenApiSpec({ title: "X", version: "1.0.0", serverUrl: "/api" });
  assert.equal(spec.openapi, "3.0.3");
  assert.equal(spec.paths["/health"].get.summary, "Health check");
  assert.ok(spec.paths["/auth/login"].post);
});

test("buildSwaggerUiHtml references spec URL", () => {
  const html = buildSwaggerUiHtml({ title: "Docs", specUrl: "/api/docs-json" });
  assert.equal(html.includes("/api/docs-json"), true);
  assert.equal(html.includes("SwaggerUIBundle"), true);
});

process.stdout.write(`\nUnit tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
