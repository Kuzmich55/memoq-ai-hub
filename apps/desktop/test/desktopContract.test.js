const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRODUCT_NAME,
  CONTRACT_VERSION,
  DEFAULT_HOST,
  DEFAULT_PORT,
  ROUTES,
  normalizeGatewayHost,
  normalizeGatewayPort
} = require('../src/shared/desktopContract');

test('desktop contract exposes expected core fields', () => {
  assert.equal(PRODUCT_NAME, 'memoQ AI Hub');
  assert.equal(CONTRACT_VERSION, '1');
  assert.equal(DEFAULT_HOST, '127.0.0.1');
  assert.equal(DEFAULT_PORT, 5271);
  assert.equal(ROUTES.desktopVersion, '/desktop/version');
  assert.equal(ROUTES.mtTranslate, '/mt/translate');
  assert.equal(ROUTES.mtTranslateAggregate, '/mt/translate-aggregate');
  assert.equal(ROUTES.mtTranslateAggregateResult, '/mt/translate-aggregate/result');
});

test('desktop contract keeps the unauthenticated gateway on loopback', () => {
  assert.equal(normalizeGatewayHost('127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeGatewayHost(' LOCALHOST '), 'localhost');
  assert.throws(() => normalizeGatewayHost('0.0.0.0'), /must be 127\.0\.0\.1 or localhost/);
  assert.throws(() => normalizeGatewayHost('192.168.1.10'), /must be 127\.0\.0\.1 or localhost/);
});

test('desktop contract validates the gateway port before starting services', () => {
  assert.equal(normalizeGatewayPort('5271'), 5271);
  assert.throws(() => normalizeGatewayPort('not-a-port'), /integer between 1 and 65535/);
  assert.throws(() => normalizeGatewayPort(0), /integer between 1 and 65535/);
  assert.throws(() => normalizeGatewayPort(65536), /integer between 1 and 65535/);
});
