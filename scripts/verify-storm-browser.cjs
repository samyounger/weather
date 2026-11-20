// Standalone sequential browser acceptance; no real identities or station fixtures.
const { chromium, webkit } = require(process.env.WEATHER_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
let server;
const base = process.env.WEATHER_TEST_URL || 'http://127.0.0.1:4173';
if (!process.argv.includes('--workers=1')) throw new Error('Pass --workers=1; these browser journeys must run sequentially.');
const summary = (year = 2025) => ({
  from: `${year}-01-23T00:00:00.000Z`, to: `${year}-01-26T00:00:00.000Z`,
  expectedMinutes: 4320, observedMinutes: 4260, rejectedRows: 2, conflictingMinutes: 1,
  coverage: { gust: 0.986, rain: 0.97, temperature: 0.986, pressure: 0.986 },
  peakGust: { mph: year === 2025 ? 63.2 : 25.2, at: `${year}-01-24T12:01:00.000Z` },
  rainMm: 12.5, temperature: { minC: -1.2, maxC: 8.7 },
  minPressure: { hpa: 947.1, at: `${year}-01-24T08:12:00.000Z` },
  hourly: Array.from({ length: 72 }, (_, i) => ({
    at: new Date(Date.UTC(year, 0, 23, i)).toISOString(),
    gustMph: i === 5 ? null : 20 + i % 30, rainMm: i === 5 ? null : 0.5,
    pressureHpa: i === 5 ? null : 980, temperatureC: i === 5 ? null : 4, minutes: i === 5 ? 0 : 60,
    coverageMinutes: { gust: i === 5 ? 0 : 60, rain: i === 5 ? 0 : 60, pressure: i === 5 ? 0 : 60, temperature: i === 5 ? 0 : 60 },
  })),
  episodes: [30, 40, 50].map((thresholdMph) => ({
    thresholdMph, qualifyingMinutes: thresholdMph === 40 ? 80 : 15, longestRunMinutes: 3,
    firstAt: `${year}-01-24T10:01:00Z`, lastAt: `${year}-01-24T16:00:00Z`,
  })),
});
const fixture = () => ({
  id: 'eowyn', retrievedAt: '2026-11-20T12:00:00Z',
  station: { name: 'Synthetic acceptance-test station', timeZone: 'Europe/London', historySince: '2024-05-27T14:03:00Z' },
  event: summary(), comparison: summary(2026), comparisonError: null, source: 'Synthetic test fixture, not real observations',
});
let count = 0;
const check = async (label, task) => { await task(); count++; console.log(`PASS ${label}`); };
(async () => {
  if (!process.env.WEATHER_TEST_URL) {
    server = spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json', { paths: [path.resolve('packages/weather-dashboard')] })), 'bin/vite.js'), '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
      cwd: path.resolve('packages/weather-dashboard'), stdio: ['ignore', fs.openSync('.tools/storm-vite.log', 'w'), fs.openSync('.tools/storm-vite-error.log', 'w')],
    });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { const result = await fetch(base); if (result.ok) { ready = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error('Test Vite server did not become ready');
  }
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const width of [375, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        let mode = 'success';
        let requests = 0;
        await page.route('**/runtime-config.json', (route) => route.fulfill({ json: {
          apiBaseUrl: base + '/test-api', cognitoRegion: 'test', cognitoUserPoolId: 'test', cognitoClientId: 'test',
        } }));
        await context.addInitScript(() => localStorage.setItem('weather-dashboard-session', JSON.stringify({
          accessToken: 'synthetic-access', idToken: 'synthetic-jwt', refreshToken: '',
          email: 'test@example.test', expiresAt: Date.now() + 3600000,
        })));
        await page.route('**/test-api/storms/eowyn', async (route) => {
          requests++;
          assert.equal(route.request().headers().authorization, 'Bearer synthetic-jwt');
          if (mode === 'error') return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
          const data = fixture();
          if (mode === 'empty') {
            data.event = { ...data.event, observedMinutes: 0, peakGust: null, rainMm: null, temperature: null, minPressure: null,
              coverage: { gust: 0, rain: 0, temperature: 0, pressure: 0 }, hourly: [],
              episodes: data.event.episodes.map((e) => ({ ...e, qualifyingMinutes: 0, longestRunMinutes: 0, firstAt: null, lastAt: null })) };
            data.comparison = null; data.comparisonError = 'Reference unavailable';
          }
          if (mode === 'invalid') data.event.episodes.unshift(null);
          if (mode === 'no-gust') {
            data.event.peakGust = null; data.event.coverage.gust = 0;
            data.event.hourly = data.event.hourly.map((hour) => ({ ...hour, gustMph: null, coverageMinutes: { ...hour.coverageMinutes, gust: 0 } }));
            data.event.episodes = data.event.episodes.map((e) => ({ ...e, qualifyingMinutes: 0, longestRunMinutes: 0, firstAt: null, lastAt: null }));
          }
          if (mode === 'partial') { data.comparison.coverage.gust = 0.6; }
          if (mode === 'reference-error') { data.comparison = null; data.comparisonError = 'Reference could not be retrieved'; }
          return route.fulfill({ json: data });
        });
        const tabTo = async (text) => {
          for (let step = 0; step < 100; step++) {
            const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
            if (focused === text) return;
            await page.keyboard.press('Tab');
          }
          throw new Error('Could not reach with Tab: ' + text);
        };
        await page.route('**/test-api/series?*', (route) => route.fulfill({ json: { data: [], aggregationLevel: '15m' } }));
        const prefix = `${name} ${width}px`;
        await check(prefix + ' story and measured local cards', async () => {
          await page.goto(base);
          await page.getByRole('heading', { name: /Éowyn/ }).waitFor();
          await page.getByText('63.2 mph', { exact: true }).waitFor();
          assert.match(await page.locator('#local-story').innerText(), /98.6% minute coverage/);
          assert.match(await page.locator('#almanac').innerText(), /38.0 mph higher/);
        });
        await check(prefix + ' threshold control and evidence table', async () => {
          await page.getByRole('combobox').selectOption('50');
          assert.match(await page.locator('.storm-callout').first().innerText(), /15 sampled minutes/);
          await page.getByText('Inspect hourly observations and coverage', { exact: true }).click();
          assert.equal(await page.locator('#replay-heading').count(), 1);
          assert.equal(await page.locator('.storm-table-scroll tbody tr').count(), 72);
          assert.match(await page.locator('.storm-table-scroll tbody tr').nth(5).innerText(), /Unavailable/);
        });
        await check(prefix + ' historical warning forecast sources and uncertainty', async () => {
          assert.match(await page.locator('#forecast').innerText(), /17:50/);
          assert.match(await page.locator('#forecast').innerText(), /Scottish Borders/);
          assert.match(await page.locator('#forecast').innerText(), /warning polygon/);
          await page.getByText('Primary sources, dates and free-data terms', { exact: true }).click();
          assert.equal(await page.locator('.storm-sources a').count(), 5);
          for (const link of await page.locator('.storm-sources a').all()) assert.match(await link.getAttribute('href'), /^https:\/\/www\.(metoffice\.gov\.uk|gov\.uk)\//);
          assert.match(await page.locator('#lifecycle').innerText(), /Final dissipation unknown/);
        });
        await check(prefix + ' layout and keyboard focus', async () => {
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.keyboard.press('Control+Home');
          await tabTo('Explore trends');
          await page.keyboard.press('Enter');
          await page.getByRole('heading', { name: 'Private Weather Dashboard' }).waitFor();
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Storm story');
          await page.keyboard.press('Space');
          await page.getByText('63.2 mph', { exact: true }).waitFor();
          for (let step = 0; step < 60; step++) {
            await page.keyboard.press('Tab');
            if (await page.evaluate(() => document.activeElement.id === 'gust-threshold')) break;
          }
          assert.equal(await page.evaluate(() => document.activeElement.id), 'gust-threshold');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
          assert.equal(await page.getByRole('combobox').inputValue(), '50');
          // Native select popups may consume the first Tab to commit their selection.
          for (let step = 0; step < 4; step++) {
            await page.keyboard.press('Tab');
            if ((await page.evaluate(() => document.activeElement.textContent)).includes('Inspect hourly')) break;
          }
          assert.match(await page.evaluate(() => document.activeElement.textContent), /Inspect hourly/);
          await page.keyboard.press('Space');
          assert.equal(await page.locator('.storm-table-scroll').isVisible(), true);
          assert.equal(await page.getByRole('img', { name: "Éowyn's regional journey" }).count(), 1);
        });
        await check(prefix + ' existing trends and return navigation', async () => {
          await page.getByRole('button', { name: 'Explore trends' }).click();
          await page.getByRole('heading', { name: 'Private Weather Dashboard' }).waitFor();
          await page.getByRole('button', { name: 'Storm story' }).click();
          await page.getByText('63.2 mph', { exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Storm story' }).getAttribute('aria-pressed'), 'true');
        });
        await check(prefix + ' recover from upstream failure', async () => {
          mode = 'error'; await page.reload();
          await page.getByRole('alert').waitFor();
          assert.match(await page.getByRole('alert').innerText(), /temporarily unavailable/);
          assert.equal(await page.locator('#lifecycle').count(), 1);
          mode = 'success'; await tabTo('Retry station history'); await page.keyboard.press('Enter');
          await page.getByText('63.2 mph', { exact: true }).waitFor();
        });
        await check(prefix + ' empty history never becomes zero weather', async () => {
          mode = 'empty'; await page.reload();
          await page.getByText('No station reports are available', { exact: false }).waitFor();
          assert.match(await page.locator('#local-story').innerText(), /Unavailable/);
          assert.match(await page.locator('#almanac').innerText(), /Reference unavailable/);
          assert.equal(await page.getByText('0.0 mm', { exact: true }).count(), 0);
        });
        await check(prefix + ' insufficient reference coverage', async () => {
          mode = 'partial'; await page.reload();
          await page.getByText(/Not enough gust coverage/).waitFor();
        });
        await check(prefix + ' reference failure leaves event usable', async () => {
          mode = 'reference-error'; await page.reload();
          await page.getByText('63.2 mph', { exact: true }).waitFor();
          assert.match(await page.locator('#almanac').innerText(), /Reference could not be retrieved/);
          mode = 'success'; await tabTo('Retry reference history'); await page.keyboard.press('Space');
          await page.getByText(/38.0 mph higher/).waitFor();
        });
        await check(prefix + ' missing gust metrics are unavailable not zero activity', async () => {
          mode = 'no-gust'; await page.reload();
          await page.getByText('No usable gust observations; threshold activity is unavailable, not zero.', { exact: true }).waitFor();
          assert.equal(await page.getByRole('combobox').isDisabled(), true);
          assert.equal(await page.getByText('0 sampled minutes', { exact: false }).count(), 0);
        });
        await check(prefix + ' malformed payload becomes handled retry state', async () => {
          mode = 'invalid'; await page.reload();
          await page.getByRole('alert').waitFor();
          assert.match(await page.getByRole('alert').innerText(), /not recognised/);
          assert.equal(await page.getByRole('heading', { name: 'Named before it even formed' }).count(), 1);
          mode = 'success'; await page.getByRole('button', { name: 'Retry station history' }).click();
          await page.getByText('63.2 mph', { exact: true }).waitFor();
        });
        await check(prefix + ' browser console and screenshot', async () => {
          assert.deepEqual(errors, []);
          fs.mkdirSync('.tools/storm-browser', { recursive: true });
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `.tools/storm-browser/${name}-${width}.png`, fullPage: false });
          assert.ok(requests >= 7);
        });
        await context.close();
      }
    } finally { await browser.close(); }
  }
  console.log(`${count} sequential browser journeys passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => server?.kill('SIGTERM'));
