// Utilidades compartidas por las funciones de /api (Vercel).
const NOTION_VERSION = '2022-06-28';

// Bases de datos de Notion. Se pueden cambiar con variables de entorno en Vercel.
const TASK_SOURCES = {
  u: {
    label: 'U',
    db: process.env.NOTION_DB_U || '2f208aa7-1329-449a-a074-c9f67953d608',
    title: 'Tarea', date: 'Fecha de entrega', prio: 'Prioridad', extra: 'Curso',
    status: 'Estado', statusType: 'status', done: 'Listo', todo: 'Sin empezar'
  },
  pertel: {
    label: 'Pertel',
    db: process.env.NOTION_DB_PERTEL || '41828eab-6f9a-44b6-bdba-c9766cfbc75a',
    title: 'Tarea', date: 'Fecha limite', prio: 'Prioridad', extra: null,
    status: 'Estado', statusType: 'select', done: 'Hecho', todo: 'Por hacer'
  }
};
const CHECKINS_DB = process.env.NOTION_DB_CHECKINS || '84af8f34-2be6-42e0-92ea-8522b51c0843';

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Toda llamada necesita la clave de la app (APP_KEY) en el header x-app-key.
function authorized(req, res) {
  const key = process.env.APP_KEY;
  if (!key) { send(res, 503, { error: 'Falta configurar APP_KEY en Vercel.' }); return false; }
  if (req.headers['x-app-key'] !== key) { send(res, 401, { error: 'Clave incorrecta.' }); return false; }
  return true;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}

async function notion(path, method = 'GET', body) {
  const token = process.env.NOTION_TOKEN;
  if (!token) { const e = new Error('Falta configurar NOTION_TOKEN en Vercel.'); e.status = 503; throw e; }
  const r = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data.message || ('Notion respondió ' + r.status));
    e.status = r.status === 404 ? 404 : 502;
    e.hint = r.status === 404 ? 'Comparte la página con tu integración de Notion.' : undefined;
    throw e;
  }
  return data;
}

async function queryAll(dbId, body = {}) {
  let out = [], cursor;
  do {
    const d = await notion('/databases/' + dbId + '/query', 'POST', Object.assign({ page_size: 100 }, body, cursor ? { start_cursor: cursor } : {}));
    out = out.concat(d.results || []);
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor && out.length < 500);
  return out;
}

const plain = arr => (arr || []).map(t => t.plain_text).join('');

function fail(res, e) {
  send(res, e.status || 500, { error: e.message || 'Error', hint: e.hint });
}

module.exports = { TASK_SOURCES, CHECKINS_DB, send, authorized, readBody, notion, queryAll, plain, fail };
