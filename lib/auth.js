const crypto = require("crypto");

const COOKIE_NAME = "tino_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const body = base64url(JSON.stringify(payload));
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${hmac}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const [body, hmac] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(";").reduce((acc, part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function createSessionCookie() {
  const token = sign({ exp: Date.now() + SESSION_TTL_MS });
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  return Boolean(verify(token));
}

function requireAuth(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

module.exports = {
  COOKIE_NAME,
  createSessionCookie,
  clearSessionCookie,
  isAuthenticated,
  requireAuth,
};
