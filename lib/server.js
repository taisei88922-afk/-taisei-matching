import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VISITOR_SECRET && process.env.OWNER_EMAIL);

export function ready(res) {
  if (configured()) return true;
  res.status(503).json({ error: 'Messaging is not configured yet' });
  return false;
}

export function sameOrigin(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  try {
    if (origin && new URL(origin).host === host && new URL(origin).protocol === 'https:') return true;
  } catch (_) { /* Reject malformed Origin headers. */ }
  res.status(403).json({ error: 'Invalid origin' });
  return false;
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split(/=(.*)/s).slice(0, 2)).filter(([k, v]) => k && v));
}

function decoded(value) {
  try { return decodeURIComponent(value || ''); } catch (_) { return ''; }
}

export function cookie(name, value, age) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}

export function visitor(req, res) {
  const raw = decoded(cookies(req).tm_visitor);
  const [id, mac] = raw.split('.');
  if (/^[0-9a-f-]{36}$/.test(id || '') && /^[0-9a-f]{64}$/.test(mac || '')) {
    const expected = createHmac('sha256', process.env.VISITOR_SECRET).update(id).digest('hex');
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return id;
  }
  const newId = randomUUID();
  const signature = createHmac('sha256', process.env.VISITOR_SECRET).update(newId).digest('hex');
  res.setHeader('Set-Cookie', cookie('tm_visitor', `${newId}.${signature}`, 60 * 60 * 24 * 365));
  return newId;
}

export async function supabase(path, options = {}, admin = false) {
  const key = admin ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.error_description || body?.error || 'Request failed');
  return body;
}

export async function owner(req, res) {
  const jar = cookies(req);
  let access = decoded(jar.tm_owner_access);
  const getUser = token => supabase('/auth/v1/user', { headers: { Authorization: `Bearer ${token}` } });
  let user = access ? await getUser(access).catch(() => null) : null;
  if (!user && jar.tm_owner_refresh) {
    const session = await supabase('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: decoded(jar.tm_owner_refresh) })
    }).catch(() => null);
    if (session) {
      access = session.access_token;
      res.setHeader('Set-Cookie', [cookie('tm_owner_access', access, session.expires_in || 3600), cookie('tm_owner_refresh', session.refresh_token, 60 * 60 * 24 * 30)]);
      user = await getUser(access).catch(() => null);
    }
  }
  if (user?.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase() && user.email_confirmed_at) return user;
  res.status(401).json({ error: 'Owner login required' });
  return null;
}

export function fail(res, error) {
  console.error('Messaging request failed:', error);
  return res.status(502).json({ error: '処理できませんでした。時間をおいて再試行してください。' });
}

export const profileIds = new Set(['rice-1', 'party-1', 'fit-1', 'rice-2', 'party-2', 'fit-2', 'rice-3', 'party-3', 'fit-3', 'beauty-1', 'hinata-1', 'kanto-1']);
