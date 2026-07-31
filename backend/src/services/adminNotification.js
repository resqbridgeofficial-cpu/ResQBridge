const convexClient = require("../config/convex");
const { anyApi } = require("convex/server");

async function notifyAdmin({ type, message, reportId, link }) {
  await convexClient.mutation(anyApi.adminNotifications.insertNotification, {
    type,
    message,
    reportId: reportId || undefined,
    link: link || undefined,
  });
}

module.exports = { notifyAdmin };
