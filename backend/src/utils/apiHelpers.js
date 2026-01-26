const util = require('util');

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function extractAxiosStatus(err) {
  const status = err?.response?.status;
  return Number.isFinite(status) ? status : null;
}

function extractAxiosMessage(err) {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const msg = data.message || data.error || data.detail;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (typeof err?.message === "string" && err.message.trim())
    return err.message;
  return "Request failed";
}

module.exports = {
  asyncRoute,
  extractAxiosStatus,
  extractAxiosMessage,
};
