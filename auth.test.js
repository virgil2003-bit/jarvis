import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAuthHandler, authenticateRequest, SESSION_COOKIE } from './auth.js';
const password = 'private-device-password-for-tests';
const initialTime = Date.parse('2026-11-02T18:00:00Z');
async function run(fn) {
 const env = { JARVIS_ACCESS_TOKEN: password }; let time = initialTime;
 const handler = createAuthHandler({ env, now: () => time });
 const server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost').pathname));
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 try { await fn({ base: `http://127.0.0.1:${server.address().port}`, env, setTime: value => { time = value; } }); }
 finally { await new Promise(resolve => server.close(resolve)); }
}
function login(base, body = { password }, headers = {}) {
 return fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
const cookieFrom = response => response.headers.get('set-cookie').split(';')[0];

test('remembered login is private, HttpOnly, secure, host-only, persistent and works across handler restarts', async () => run(async ({ base }) => {
 const response = await login(base);
 assert.equal(response.status, 200);
 assert.deepEqual(await response.json(), { authenticated: true, remembered: true });
 const header = response.headers.get('set-cookie');
 assert.match(header, /^__Host-jarvis_session=/);
 for (const attribute of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Max-Age=2592000']) assert.ok(header.includes(attribute), attribute);
 assert.ok(!header.includes(password)); assert.ok(!header.includes('Domain='));
 assert.equal(response.headers.get('cache-control'), 'no-store');
 const cookie = cookieFrom(response);
 const status = await fetch(base + '/api/auth/status', { headers: { Cookie: cookie } });
 assert.deepEqual(await status.json(), { authenticated: true });
 // No server-side session map is required: the same proof survives a restart.
 assert.equal(authenticateRequest({ headers: { cookie } }, password, { now: () => initialTime }), true);
 const another = await login(base); assert.notEqual(cookieFrom(another), cookie);
}));

test('password rotation, expiry, tampering and duplicate cookies fail closed', async () => run(async ({ base, env, setTime }) => {
 const response = await login(base); const cookie = cookieFrom(response);
 const request = { headers: { cookie } };
 assert.equal(authenticateRequest(request, password, { now: () => initialTime + 29 * 86400000 }), true);
 setTime(initialTime + 30 * 86400000);
 assert.deepEqual(await (await fetch(base + '/api/auth/status', { headers: { Cookie: cookie } })).json(), { authenticated: false });
 assert.equal(authenticateRequest(request, password + '-rotated', { now: () => initialTime }), false);
 const [name, value] = cookie.split('=');
 const parts = value.split('.'); parts[1] = String(Number(parts[1]) + 86400);
 assert.equal(authenticateRequest({ headers: { cookie: name + '=' + parts.join('.') } }, password, { now: () => initialTime }), false);
 assert.equal(authenticateRequest({ headers: { cookie: cookie + '; ' + cookie } }, password, { now: () => initialTime }), false);
 env.JARVIS_ACCESS_TOKEN = password + '-rotated';
 assert.deepEqual(await (await fetch(base + '/api/auth/status', { headers: { Cookie: cookie } })).json(), { authenticated: false });
}));

test('unremembered login uses only a browser-session cookie; logout forgets this device', async () => run(async ({ base }) => {
 const response = await login(base, { password, remember: false });
 assert.deepEqual(await response.json(), { authenticated: true, remembered: false });
 assert.ok(!response.headers.get('set-cookie').includes('Max-Age='));
 assert.ok(!response.headers.get('set-cookie').includes('Expires='));
 const cookie = cookieFrom(response);
 assert.equal(authenticateRequest({ headers: { cookie } }, password, { now: () => initialTime + 13 * 3600000 }), false);
 const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
 assert.equal(logout.status, 200); assert.deepEqual(await logout.json(), { authenticated: false });
 assert.ok(logout.headers.get('set-cookie').includes(`${SESSION_COOKIE}=;`));
 assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
 assert.deepEqual(await (await fetch(base + '/api/auth/status')).json(), { authenticated: false });
}));

test('wrong passwords are rate-limited, secrets are never echoed, and valid bearer access remains supported', async () => run(async ({ base, setTime }) => {
 assert.equal(authenticateRequest({ headers: { authorization: 'Bearer ' + password } }, password), true);
 assert.equal(authenticateRequest({ headers: { authorization: 'Bearer wrong' } }, password), false);
 assert.equal(authenticateRequest({ headers: { authorization: 'Bearer short' } }, 'short'), false);
 for (let i = 0; i < 10; i++) {
  const response = await login(base, { password: 'wrong-private-password' });
  assert.equal(response.status, 401); assert.ok(!(await response.text()).includes('wrong-private-password'));
 }
 const limited = await login(base);
 assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
 setTime(initialTime + 16 * 60000);
 assert.equal((await login(base)).status, 200);
}));

test('cross-origin cookie mutations and authentication requests are rejected', async () => run(async ({ base }) => {
 const response = await login(base); const cookie = cookieFrom(response);
 assert.equal(authenticateRequest({ headers: { cookie, origin: 'https://evil.example', host: 'jarvis.example' } }, password, { now: () => initialTime }), false);
 assert.equal(authenticateRequest({ headers: { cookie, 'sec-fetch-site': 'cross-site' } }, password, { now: () => initialTime }), false);
 assert.equal(authenticateRequest({ headers: { cookie, 'sec-fetch-site': 'same-site' } }, password, { now: () => initialTime }), false);
 const origin = new URL(base).origin;
 assert.equal(authenticateRequest({ headers: { cookie, origin, host: new URL(base).host } }, password, { now: () => initialTime }), true);
 assert.equal((await login(base, { password }, { Origin: 'https://evil.example' })).status, 403);
 assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
 assert.equal((await login(base, { password }, { Origin: origin })).status, 200);
}));

test('malformed, oversized and invalid login bodies cannot authenticate', async () => run(async ({ base, env }) => {
 assert.equal((await login(base, { password, remember: 'yes' })).status, 400);
 assert.equal((await login(base, null)).status, 400);
 assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })).status, 400);
 assert.equal((await login(base, { password: 'x'.repeat(5000) })).status, 413);
 assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', body: 'password=' + password })).status, 415);
 assert.equal((await fetch(base + '/api/auth/login')).status, 405);
 env.JARVIS_ACCESS_TOKEN = 'short';
 assert.equal((await login(base)).status, 503);
 assert.deepEqual(await (await fetch(base + '/api/auth/status')).json(), { authenticated: false });
}));
