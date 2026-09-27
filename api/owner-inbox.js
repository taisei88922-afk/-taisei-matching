import { fail, owner, ready, sameOrigin, supabase } from '../lib/server.js';

const db = (path, options = {}) => supabase(`/rest/v1/${path}`, options, true);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!ready(res)) return;
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (req.method === 'POST' && !sameOrigin(req, res)) return;
  if (!await owner(req, res)) return;
  try {
    if (req.method === 'GET' && !req.query.id) {
      const conversations = await db('conversations?select=id,profile_id,created_at,updated_at&order=updated_at.desc&limit=100');
      return res.status(200).json({ conversations });
    }
    const id = req.method === 'GET' ? req.query.id : req.body?.id;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid conversation' });
    const conversation = await db(`conversations?id=eq.${id}&select=id,profile_id&limit=1`);
    if (!conversation.length) return res.status(404).json({ error: 'Conversation not found' });
    if (req.method === 'GET') {
      const messages = await db(`messages?conversation_id=eq.${id}&select=sender,body,created_at&order=created_at.asc&limit=200`);
      return res.status(200).json({ conversation: conversation[0], messages });
    }
    const body = req.body?.text;
    if (typeof body !== 'string' || !body.trim() || body.length > 500) return res.status(400).json({ error: '1〜500文字で入力してください。' });
    await db('messages', { method: 'POST', body: JSON.stringify({ conversation_id: id, sender: 'owner', body: body.trim() }) });
    await db(`conversations?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ updated_at: new Date().toISOString() }) });
    return res.status(201).json({ ok: true });
  } catch (error) {
    return fail(res, error);
  }
}
