// GET    /api/checkins          -> todos los check-ins guardados en Notion
// POST   /api/checkins          -> crea o actualiza {date, time, target, rank, xp, money, manual}
// DELETE /api/checkins?date=... -> archiva el de ese día
const { CHECKINS_DB, send, authorized, readBody, notion, queryAll, plain, fail } = require('./_lib/util');

function mapRow(p) {
  const pr = p.properties;
  return {
    id: p.id,
    date: plain(pr['Fecha'].title),
    time: plain(pr['Hora'].rich_text),
    target: plain(pr['Meta'].rich_text),
    rank: pr['Rango'].select ? pr['Rango'].select.name : null,
    xp: pr['XP'].number || 0,
    money: pr['Soles'].number || 0,
    manual: !!pr['Manual'].checkbox
  };
}
async function findByDate(date) {
  const rows = await queryAll(CHECKINS_DB, { filter: { property: 'Fecha', title: { equals: date } } });
  return rows;
}

module.exports = async (req, res) => {
  if (!authorized(req, res)) return;
  try {
    if (req.method === 'GET') {
      const rows = await queryAll(CHECKINS_DB, { sorts: [{ property: 'Fecha', direction: 'ascending' }] });
      return send(res, 200, { checkins: rows.map(mapRow).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date)) });
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return send(res, 400, { error: 'Fecha inválida.' });
      const props = {
        'Fecha': { title: [{ text: { content: b.date } }] },
        'Día': { date: { start: b.date } },
        'Hora': { rich_text: [{ text: { content: String(b.time || '') } }] },
        'Meta': { rich_text: [{ text: { content: String(b.target || '') } }] },
        'Rango': b.rank ? { select: { name: b.rank } } : { select: null },
        'XP': { number: Number(b.xp) || 0 },
        'Soles': { number: Number(b.money) || 0 },
        'Manual': { checkbox: !!b.manual }
      };
      const existing = await findByDate(b.date);
      if (existing.length) {
        await notion('/pages/' + existing[0].id, 'PATCH', { properties: props });
        for (const extra of existing.slice(1)) await notion('/pages/' + extra.id, 'PATCH', { archived: true });
      } else {
        await notion('/pages', 'POST', { parent: { database_id: CHECKINS_DB }, properties: props });
      }
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      const date = (req.query && req.query.date) || new URL(req.url, 'http://x').searchParams.get('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return send(res, 400, { error: 'Fecha inválida.' });
      for (const r of await findByDate(date)) await notion('/pages/' + r.id, 'PATCH', { archived: true });
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: 'Método no permitido.' });
  } catch (e) { fail(res, e); }
};
