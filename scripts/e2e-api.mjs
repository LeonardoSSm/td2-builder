const API_URL = process.env.API_URL ?? "http://localhost:3001/api";
const LOGIN_EMAIL = (process.env.E2E_EMAIL ?? "root@local.test").trim().toLowerCase();
const LOGIN_PASSWORD = String(process.env.E2E_PASSWORD ?? "td2e2e123");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cookieJar = new Map();

function readSetCookies(res) {
  const anyHeaders = res.headers;
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function saveCookies(res) {
  for (const line of readSetCookies(res)) {
    const first = String(line).split(";")[0] ?? "";
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    const name = first.slice(0, idx).trim();
    const value = first.slice(idx + 1).trim();
    if (!name) continue;
    cookieJar.set(name, value);
  }
}

function cookieHeader() {
  if (!cookieJar.size) return "";
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function request(path, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  const ck = cookieHeader();
  if (ck) headers.Cookie = ck;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  saveCookies(res);
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

  const setup = await request("/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: LOGIN_PASSWORD }),
  });
  assert([200, 201, 403].includes(setup.res.status), `auth/setup unexpected status: ${setup.res.status}`);

  const csrf = await request("/auth/csrf");
  assert(csrf.res.ok, `auth/csrf failed: ${csrf.res.status}`);
  const csrfToken = String(csrf.body?.csrfToken ?? "").trim();
  assert(csrfToken.length > 0, "csrf token missing");

  const login = await request("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });

  assert(
    login.res.ok,
    `auth/login failed: ${login.res.status} ${JSON.stringify(login.body)}`,
  );

  const me = await request("/auth/me");
  assert(me.res.ok, `auth/me failed: ${me.res.status}`);
  assert(typeof me.body?.id === "string", "auth/me missing user id");

  const createBuild = await request("/builds", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ name: "E2E Build" }),
  });
  assert(createBuild.res.ok, `build create failed: ${createBuild.res.status}`);

  const buildId = createBuild.body?.id;
  assert(typeof buildId === "string" && buildId.length > 0, "build id missing");

  const summary = await request(`/builds/${buildId}/summary`);
  assert(summary.res.ok, `build summary failed: ${summary.res.status}`);
  assert(summary.body?.buildId === buildId, "build summary invalid build id");

  const csrf2 = await request("/auth/csrf");
  const csrfToken2 = String(csrf2.body?.csrfToken ?? "").trim();
  const logout = await request("/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken2 },
    body: "{}",
  });
  assert(logout.res.ok, `auth/logout failed: ${logout.res.status}`);

  console.log("E2E tests passed");
}

run().catch((err) => {
  console.error(`E2E tests failed: ${err.message}`);
  process.exit(1);
});
