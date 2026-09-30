// GET /api/status -> qué integraciones están configuradas (sin revelar las llaves).
const { send } = require('./_lib/util');
module.exports = (req, res) => {
  send(res, 200, {
    appKey: !!process.env.APP_KEY,
    notion: !!process.env.NOTION_TOKEN,
    calendar: !!process.env.GCAL_ICS_URL,
    keyOk: !!process.env.APP_KEY && req.headers['x-app-key'] === process.env.APP_KEY
  });
};
