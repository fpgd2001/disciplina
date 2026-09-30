// GET /api/status -> qué integraciones están configuradas (sin revelar las llaves).
const { send, sentKey } = require('./_lib/util');
const clean = s => String(s || '').trim();
module.exports = (req, res) => {
  const key = clean(process.env.APP_KEY);
  const sent = sentKey(req);
  send(res, 200, {
    appKey: !!key,
    notion: !!clean(process.env.NOTION_TOKEN),
    calendar: !!clean(process.env.GCAL_ICS_URL),
    keyOk: !!key && sent === key,
    // Solo largos, para detectar espacios o caracteres de más sin revelar la clave.
    keyLen: key.length,
    sentLen: sent.length,
    caseOnly: !!key && sent !== key && sent.toLowerCase() === key.toLowerCase()
  });
};
