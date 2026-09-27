import { cookie, fail, ready, sameOrigin, supabase } from '../lib/server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!ready(res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!sameOrigin(req, res)) return;
  const { action, email, code } = req.body || {};
  if (action === 'logout') {
    res.setHeader('Set-Cookie', [cookie('tm_owner_access', '', 0), cookie('tm_owner_refresh', '', 0)]);
    return res.status(200).json({ ok: true });
  }
  if (typeof email !== 'string' || email.trim().toLowerCase() !== process.env.OWNER_EMAIL.toLowerCase())
    return res.status(400).json({ error: 'オーナーのメールアドレスを入力してください。' });
  try {
    if (action === 'request') {
      await supabase('/auth/v1/otp', { method: 'POST', body: JSON.stringify({ email: email.trim(), create_user: true }) });
      return res.status(200).json({ ok: true });
    }
    if (action === 'verify' && typeof code === 'string' && /^\d{6,8}$/.test(code)) {
      const session = await supabase('/auth/v1/verify', {
        method: 'POST', body: JSON.stringify({ email: email.trim(), token: code, type: 'email' })
      });
      if (session.user?.email?.toLowerCase() !== process.env.OWNER_EMAIL.toLowerCase())
        return res.status(403).json({ error: 'Owner account required' });
      res.setHeader('Set-Cookie', [cookie('tm_owner_access', session.access_token, session.expires_in || 3600), cookie('tm_owner_refresh', session.refresh_token, 60 * 60 * 24 * 30)]);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Invalid request' });
  } catch (error) {
    return fail(res, error);
  }
}
