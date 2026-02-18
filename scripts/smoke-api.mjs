const API_URL = process.env.API_URL ?? "http://localhost:3001/api";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init) {
  const res = await fetch(`${API_URL}${path}`, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function run() {
  const health = await request("/health");
  assert(health.res.ok, `health failed: ${health.res.status}`);
  assert(health.body?.ok === true, "health response missing ok=true");

  const catalog = await request("/catalog/brands");
  assert(catalog.res.ok, `catalog failed: ${catalog.res.status}`);
  assert(Array.isArray(catalog.body), "catalog response should be an array");

  const importsNoKey = await request("/imports/xlsx", { method: "POST" });
  assert(importsNoKey.res.status === 401, "imports should require JWT auth");

  const createBuild = await request("/builds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Smoke Build" }),
  });
  assert(createBuild.res.ok, `build create failed: ${createBuild.res.status}`);
  assert(typeof createBuild.body?.id === "string", "build create response missing id");

  const summary = await request(`/builds/${createBuild.body.id}/summary`);
  assert(summary.res.ok, `build summary failed: ${summary.res.status}`);
  assert(summary.body?.buildId === createBuild.body.id, "build summary returned invalid buildId");

  console.log("Smoke tests passed");
}

run().catch((err) => {
  console.error(`Smoke tests failed: ${err.message}`);
  process.exit(1);
});
