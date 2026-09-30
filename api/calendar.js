// GET /api/calendar?date=YYYY-MM-DD -> eventos de ese día (hora de Lima) desde tu Google Calendar (iCal secreto).
const ical = require('node-ical');
const { send, authorized, fail } = require('./_lib/util');

const OFFSET_H = 5; // Lima = UTC-5, sin horario de verano.
const pad = n => String(n).padStart(2, '0');
function limaHM(d) { const x = new Date(d.getTime() - OFFSET_H * 3600e3); return pad(x.getUTCHours()) + ':' + pad(x.getUTCMinutes()); }
function limaKey(d) { const x = new Date(d.getTime() - OFFSET_H * 3600e3); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); }

function expand(ev, from, to) {
  const out = [];
  const dur = (ev.end ? ev.end.getTime() : ev.start.getTime()) - ev.start.getTime();
  const allDay = ev.datetype === 'date' || (ev.start && ev.start.dateOnly);
  if (ev.rrule) {
    // Buscamos con margen y luego filtramos por el día real en Lima.
    const dates = ev.rrule.between(new Date(from.getTime() - 86400e3), new Date(to.getTime() + 86400e3), true);
    for (let d of dates) {
      const k = d.toISOString().slice(0, 10);
      if (ev.exdate && Object.keys(ev.exdate).some(x => x.slice(0, 10) === k)) continue;
      if (ev.recurrences && Object.keys(ev.recurrences).some(x => x.slice(0, 10) === k)) continue;
      out.push({ start: d, end: new Date(d.getTime() + dur), allDay });
    }
    if (ev.recurrences) for (const r of Object.values(ev.recurrences)) {
      if (r.start) out.push({ start: r.start, end: r.end || r.start, allDay, override: r });
    }
  } else {
    out.push({ start: ev.start, end: ev.end || ev.start, allDay });
  }
  return out;
}

module.exports = async (req, res) => {
  if (!authorized(req, res)) return;
  const urls = String(process.env.GCAL_ICS_URL || '').trim().split(/[\s,]+/).filter(Boolean);
  if (!urls.length) return send(res, 503, { error: 'Falta configurar GCAL_ICS_URL en Vercel.' });
  try {
    const q = new URL(req.url, 'http://x').searchParams;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '') ? q.get('date') : limaKey(new Date());
    const [y, m, d] = date.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, d, OFFSET_H));
    const to = new Date(from.getTime() + 86400e3);
    const events = [];
    for (const url of urls) {
      const data = await ical.async.fromURL(url);
      for (const ev of Object.values(data)) {
        if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;
        if (ev.status === 'CANCELLED') continue;
        for (const occ of expand(ev, from, to)) {
          const src = occ.override || ev;
          if (occ.allDay) {
            const k = occ.start.toISOString().slice(0, 10);
            const kEnd = occ.end.toISOString().slice(0, 10);
            if (!(k <= date && (kEnd > date || k === date))) continue;
          } else if (!(occ.start < to && occ.end > from)) continue;
          events.push({
            title: String(src.summary && src.summary.val || src.summary || '(sin título)'),
            location: String(src.location && src.location.val || src.location || ''),
            allDay: !!occ.allDay,
            start: occ.allDay ? null : limaHM(occ.start),
            end: occ.allDay ? null : limaHM(occ.end)
          });
        }
      }
    }
    const seen = new Set();
    const uniq = events.filter(e => { const k = e.title + e.start; if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.sort((a, b) => (a.allDay === b.allDay ? (a.start || '').localeCompare(b.start || '') : a.allDay ? -1 : 1));
    send(res, 200, { date, events: uniq });
  } catch (e) { fail(res, e); }
};
