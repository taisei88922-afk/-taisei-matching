// Vercel Serverless Function. Set OPENAI_API_KEY in the project's environment.
const personas = {
  'rice-1': 'ごはん好きTAISEI。町中華、炒飯、ラーメンが好き。',
  'party-1': '飲み会TAISEI。よく笑う。賑やかな席も聞き役も好き。',
  'fit-1': '筋トレTAISEI。ジム通いを続け、努力する人が好き。',
  'rice-2': 'ラーメンTAISEI。麺と街歩きが好き。',
  'party-2': 'しっぽりTAISEI。落ち着いた店でじっくり話すのが好き。',
  'fit-2': '健康志向TAISEI。散歩、朝活、規則正しい生活が好き。',
  'rice-3': '食べ歩きTAISEI。商店街と新しいお店探しが好き。',
  'party-3': '爆笑TAISEI。笑うのが好きで、場を和ませたい。',
  'fit-3': '努力家TAISEI。筋トレや仕事にコツコツ取り組む。',
  'beauty-1': '美意識たいせい。スキンケアや身だしなみを楽しみ、軽い冗談も好き。',
  'hinata-1': '日向たいせい。バレーのジャンプと挑戦が好きで、元気がある。',
  'kanto-1': 'たいせい（関東地方の姿）。屋根の上から冒険を夢見る、好奇心旺盛な架空のキャラクター。'
};

export default async function handler(req, res) {
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:'Chat is not configured'});
  const {profileId, messages} = req.body || {};
  if(!Object.hasOwn(personas, profileId) || !Array.isArray(messages) || messages.length > 12)
    return res.status(400).json({error:'Invalid conversation'});
  const history = messages.map(m => {
    if(!m || !['me','them'].includes(m.from) || typeof m.text !== 'string' || m.text.length > 500)
      return null;
    return {role:m.from === 'me' ? 'user' : 'assistant', content:m.text};
  });
  if(history.includes(null) || history.at(-1)?.role !== 'user')
    return res.status(400).json({error:'Invalid conversation'});
  try {
    const result = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
        model:'gpt-4.1-mini',
        store:false,
        max_output_tokens:160,
        instructions:`あなたはマッチングデモの架空のプロフィール「${personas[profileId]}」として会話する。日本語で自然に1〜3文、直前の発言に具体的に答える。気持ちが沈んでいる相手に安易に褒めたり話題を変えたりしない。必要なら質問は1つだけ。実際に人間であると偽らず、現実の約束や連絡先交換はしない。`,
        input:history
      })
    });
    if(!result.ok) return res.status(502).json({error:'Reply unavailable'});
    const data = await result.json();
    const reply = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('').trim();
    if(!reply) return res.status(502).json({error:'Empty reply'});
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({reply});
  } catch (_) {
    return res.status(502).json({error:'Reply unavailable'});
  }
}
