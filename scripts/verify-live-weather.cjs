// Read-only production configuration smoke; never log credentials, upstream URLs or readings.
const assert = require('node:assert/strict');
const { handleLive } = require('../packages/fetch-observations/function/services/live-handler.js');
(async () => {
  const response = await handleLive();
  assert.equal(response.statusCode, 200, 'Configured live observation request failed');
  const data = JSON.parse(response.body);
  assert.ok(Number.isFinite(Date.parse(data.observedAt)), 'Observation timestamp is missing');
  assert.ok(Date.parse(data.observedAt) <= Date.now() + 60000, 'Observation is future-dated');
  assert.ok(data.temperatureC !== null || data.windMph !== null, 'No usable station readings');
  assert.equal(response.body.includes(process.env.TEMPEST_TOKEN), false, 'Credential appeared in response');
  console.log('Verified live integration with production configuration; station report age (seconds):',
    Math.max(0, Math.round((Date.now() - Date.parse(data.observedAt)) / 1000)));
})().catch(() => {
  console.error('Live integration smoke failed; no private measurements or upstream errors logged.');
  process.exitCode = 1;
});
