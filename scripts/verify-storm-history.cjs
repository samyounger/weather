// Read-only integration smoke with the release's existing production Tempest configuration.
// Never print station measurements, credential-bearing URLs, or raw upstream errors.
const assert = require('node:assert/strict');
const { handleStorm } = require('../packages/fetch-observations/function/services/storm-handler.js');

(async () => {
  const response = await handleStorm();
  assert.equal(response.statusCode, 200, 'Production weather integration did not return a historical case');
  const data = JSON.parse(response.body);
  assert.equal(data.id, 'eowyn');
  assert.equal(data.station.timeZone, 'Europe/London');
  assert.ok(data.event.observedMinutes > 0, 'Event observations are unavailable');
  assert.ok(data.event.coverage.gust > 0, 'Event gust observations are unavailable');
  assert.ok(data.comparison?.observedMinutes > 0, 'Reference observations are unavailable');
  assert.equal(response.body.includes(process.env.TEMPEST_TOKEN), false, 'Credential appeared in response');
  console.log('Verified populated event/reference history with the release production configuration; no private observations logged.');
})().catch(() => {
  console.error('Historical integration smoke failed. Check configured station access or upstream availability; no raw payload logged.');
  process.exitCode = 1;
});
