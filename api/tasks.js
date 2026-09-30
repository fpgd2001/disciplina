// GET    /api/tasks            -> tareas pendientes (y las completadas hoy) de U y Pertel
// POST   /api/tasks            -> crea tarea {source, title, date, priority, extra}
// PATCH  /api/tasks            -> {id, source, done:true|false}
const { TASK_SOURCES, send, authorized, readBody, notion, queryAll, plain, fail } = require('./_lib/util');

function statusValue(src, name) {
  return src.statusType === 'status' ? { status: { name } } : { select: { name } };
}
function mapPage(p, key, src) {
  const pr = p.properties || {};
  const st = pr[src.status] && (pr[src.status].status || pr[src.status].select);
  const d = pr[src.date] && pr[src.date].date;
  const pri = pr[src.prio] && pr[src.prio].select;
  const ex = src.extra && pr[src.extra] && pr[src.extra].select;
  return {
    id: p.id, source: key, sourceLabel: src.label, url: p.url,
    title: plain(pr[src.title] && pr[src.title].title) || '(sin título)',
    status: st ? st.name : null,
    done: !!st && st.name === src.done,
    due: d ? d.start : null,
    priority: pri ? pri.name : null,
    extra: ex ? ex.name : null,
    edited: p.last_edited_time
  };
}

module.exports = async (req, res) => {
  if (!authorized(req, res)) return;
  try {
    if (req.method === 'GET') {
      const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
      const lists = await Promise.all(Object.entries(TASK_SOURCES).map(async ([key, src]) => {
        const notDone = src.statusType === 'status'
          ? { property: src.status, status: { does_not_equal: src.done } }
          : { property: src.status, select: { does_not_equal: src.done } };
        const recent = { timestamp: 'last_edited_time', last_edited_time: { on_or_after: since } };
        try {
          const pages = await queryAll(src.db, { filter: { or: [notDone, recent] } });
          return { key, ok: true, items: pages.map(p => mapPage(p, key, src)) };
        } catch (e) {
          return { key, ok: false, error: e.message, hint: e.hint, items: [] };
        }
      }));
      const meta = {};
      await Promise.all(Object.entries(TASK_SOURCES).map(async ([key, src]) => {
        meta[key] = { label: src.label, extraName: src.extra, extraOptions: [] };
        if (!src.extra) return;
        try {
          const db = await notion('/databases/' + src.db);
          const prop = db.properties && db.properties[src.extra];
          meta[key].extraOptions = prop && prop.select ? prop.select.options.map(o => o.name) : [];
        } catch (e) { /* sin opciones */ }
      }));
      return send(res, 200, {
        tasks: lists.flatMap(l => l.items),
        sources: lists.map(l => ({ key: l.key, ok: l.ok, error: l.error, hint: l.hint })),
        meta
      });
    }

    const b = await readBody(req);
    const src = TASK_SOURCES[b.source];
    if (!src) return send(res, 400, { error: 'Fuente inválida.' });

    if (req.method === 'POST') {
      const title = String(b.title || '').trim().slice(0, 300);
      if (!title) return send(res, 400, { error: 'Falta el título.' });
      const props = {
        [src.title]: { title: [{ text: { content: title } }] },
        [src.status]: statusValue(src, src.todo)
      };
      if (b.date) props[src.date] = { date: { start: String(b.date).slice(0, 10) } };
      if (b.priority) props[src.prio] = { select: { name: b.priority } };
      if (src.extra && b.extra) props[src.extra] = { select: { name: b.extra } };
      const p = await notion('/pages', 'POST', { parent: { database_id: src.db }, properties: props });
      return send(res, 200, { task: mapPage(p, b.source, src) });
    }

    if (req.method === 'PATCH') {
      if (!b.id) return send(res, 400, { error: 'Falta id.' });
      const name = b.done ? src.done : (b.prevStatus && b.prevStatus !== src.done ? b.prevStatus : src.todo);
      const p = await notion('/pages/' + b.id, 'PATCH', { properties: { [src.status]: statusValue(src, name) } });
      return send(res, 200, { task: mapPage(p, b.source, src) });
    }

    send(res, 405, { error: 'Método no permitido.' });
  } catch (e) { fail(res, e); }
};
