import { fail, profileIds, ready, sameOrigin, supabase, visitor } from '../lib/server.js';

const db = (path, options = {}) => supabase(`/rest/v1/${path}`, options, true);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!ready(res)) return;
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (req.method === 'POST' && !sameOrigin(req, res)) return;
  const visitorId = visitor(req, res);
  try {
    if (req.method === 'GET' && !req.query.profileId) {
      const rows = await db(`conversations?visitor_id=eq.${visitorId}&select=id,profile_id,updated_at&order=updated_at.desc&limit=50`);
      return res.status(200).json({ conversations: rows });
    }
    const profileId = req.method === 'GET' ? req.query.profileId : req.body?.profileId;
    if (!profileIds.has(profileId)) return res.status(400).json({ error: 'Invalid profile' });
    const rows = await db(`conversations?visitor_id=eq.${visitorId}&profile_id=eq.${profileId}&select=id&limit=1`);
    if (req.method === 'GET') {
      if (!rows.length) return res.status(200).json({ messages: [] });
      const messages = await db(`messages?conversation_id=eq.${rows[0].id}&select=sender,body,created_at&order=created_at.asc&limit=200`);
      return res.status(200).json({ messages });
    }
    const body = req.body?.text;
    if (typeof body !== 'string' || !body.trim() || body.length > 500) return res.status(400).json({ error: '1〜500文字で入力してください。' });
    const since = encodeURIComponent(new Date(Date.now() - 60_000).toISOString());
    const recent = await db(`messages?visitor_id=eq.${visitorId}&sender=eq.visitor&created_at=gte.${since}&select=id&limit=11`);
    if (recent.length >= 10) return res.status(429).json({ error: '少し時間をおいて送信してください。' });
    let conversationId = rows[0]?.id;
    if (!conversationId) {
      const created = await db('conversations?on_conflict=visitor_id,profile_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ visitor_id: visitorId, profile_id: profileId })
      });
      conversationId = created[0].id;
    }
    await db('messages', {
      method: 'POST', body: JSON.stringify({ conversation_id: conversationId, visitor_id: visitorId, sender: 'visitor', body: body.trim() })
    });
    await db(`conversations?id=eq.${conversationId}`, {
      method: 'PATCH', body: JSON.stringify({ updated_at: new Date().toISOString() })
    });
    return res.status(201).json({ ok: true });
  } catch (error) {
    return fail(res, error);
  }
}
