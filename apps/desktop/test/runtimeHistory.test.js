const test = require('node:test');
const assert = require('node:assert/strict');

const {
  filterHistoryEntries,
  matchesHistoryIssue
} = require('../src/runtime/runtimeHistory');

const entries = [
  {
    id: 'success',
    status: 'success',
    providerId: 'provider-a',
    providerName: 'OpenAI',
    model: 'gpt-5.4',
    latencyMs: 100,
    submittedAt: '2026-03-22T10:00:00.000Z'
  },
  {
    id: 'failed',
    status: 'failed',
    providerId: 'provider-a',
    providerName: 'OpenAI',
    model: 'gpt-5.4',
    latencyMs: 200,
    submittedAt: '2026-03-22T10:05:00.000Z'
  },
  {
    id: 'timeout',
    status: 'failed',
    providerId: 'provider-b',
    providerName: 'Compatible',
    model: 'deepseek-chat',
    latencyMs: 300,
    submittedAt: '2026-03-22T10:10:00.000Z',
    attempts: [{ errorCode: 'PROVIDER_TIMEOUT' }]
  },
  {
    id: 'rate-limit',
    status: 'failed',
    providerId: 'provider-b',
    providerName: 'Compatible',
    model: 'deepseek-chat',
    latencyMs: 400,
    submittedAt: '2026-03-22T10:15:00.000Z',
    attempts: [{ errorCode: 'PROVIDER_RATE_LIMITED' }]
  },
  {
    id: 'fallback',
    status: 'success',
    providerId: 'provider-c',
    providerName: 'Fallback Route',
    model: 'model-c',
    latencyMs: 500,
    submittedAt: '2026-03-22T10:20:00.000Z',
    throughput: { fallbackReasons: ['batch_failed'] }
  },
  {
    id: 'slow',
    status: 'success',
    providerId: 'provider-d',
    providerName: 'Slow Route',
    model: 'model-d',
    latencyMs: 30001,
    submittedAt: '2026-03-22T10:25:00.000Z'
  },
  {
    id: 'legacy',
    status: 'success',
    providerId: 'provider-e',
    providerName: 'Legacy',
    model: 'model-e',
    submittedAt: '2026-03-22T10:30:00.000Z'
  }
];

test('runtime history issue filters identify failed, timeout, rate limit, fallback, and slow records', () => {
  assert.deepEqual(filterHistoryEntries(entries, { issue: 'failed' }).map((entry) => entry.id), ['failed', 'timeout', 'rate-limit']);
  assert.deepEqual(filterHistoryEntries(entries, { issue: 'timeout' }).map((entry) => entry.id), ['timeout']);
  assert.deepEqual(filterHistoryEntries(entries, { issue: 'rate_limit' }).map((entry) => entry.id), ['rate-limit']);
  assert.deepEqual(filterHistoryEntries(entries, { issue: 'fallback' }).map((entry) => entry.id), ['fallback']);
  assert.deepEqual(filterHistoryEntries(entries, { issue: 'slow' }).map((entry) => entry.id), ['slow']);
});

test('runtime history issue matching tolerates legacy records with missing diagnostics', () => {
  const legacy = { id: 'legacy', status: 'success' };

  assert.equal(matchesHistoryIssue(legacy, 'timeout'), false);
  assert.equal(matchesHistoryIssue(legacy, 'rate_limit'), false);
  assert.equal(matchesHistoryIssue(legacy, 'fallback'), false);
  assert.equal(matchesHistoryIssue(legacy, 'slow'), false);
  assert.equal(matchesHistoryIssue(legacy, ''), true);
  assert.equal(matchesHistoryIssue(legacy, 'unknown'), true);
});
