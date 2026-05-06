const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildHistoryInsights,
  buildHistoryMetrics,
  buildHistorySummary,
  buildIntegrationConfig
} = require('../src/runtime/runtimeHistoryIntegrationSupport');

test('runtime history integration support returns empty insights for empty history', () => {
  assert.deepEqual(buildHistoryInsights([]), {
    totalRequests: 0,
    totalSegments: 0,
    successCount: 0,
    failedCount: 0,
    successRate: null,
    avgLatencyMs: null,
    slowRequestCount: 0,
    timeoutCount: 0,
    rateLimitCount: 0,
    exactCacheHitCount: 0,
    adaptiveCacheHitCount: 0,
    cacheHitCount: 0,
    cacheHitRate: null,
    batchFallbackCount: 0,
    providerBreakdown: [],
    attentionItems: []
  });
});

test('runtime history integration support builds aggregate history insights', () => {
  const insights = buildHistoryInsights([
    {
      providerId: 'provider-a',
      providerName: 'OpenAI',
      model: 'gpt-5.4',
      status: 'success',
      latencyMs: 100,
      segmentCount: 2,
      attempts: [{ cacheKind: 'exact' }]
    },
    {
      providerId: 'provider-a',
      providerName: 'OpenAI',
      model: 'gpt-5.4',
      status: 'failed',
      latencyMs: '400',
      segments: [{}, {}, {}],
      attempts: [{ errorCode: 'PROVIDER_TIMEOUT' }]
    },
    {
      providerId: 'provider-a',
      providerName: 'OpenAI',
      model: 'gpt-5.4',
      status: 'success',
      latencyMs: 31000,
      segmentCount: 1,
      finalizedByFallbackRoute: true,
      attempts: [{ errorCode: 'PROVIDER_RATE_LIMITED' }]
    },
    {
      providerId: 'provider-b',
      providerName: 'Compatible',
      model: 'deepseek-chat',
      status: 'success',
      latencyMs: 45000,
      segmentCount: 4,
      attempts: [{ cacheKind: 'adaptive' }]
    }
  ]);

  assert.equal(insights.totalRequests, 4);
  assert.equal(insights.totalSegments, 10);
  assert.equal(insights.successCount, 3);
  assert.equal(insights.failedCount, 1);
  assert.equal(insights.successRate, 75);
  assert.equal(insights.avgLatencyMs, 19125);
  assert.equal(insights.slowRequestCount, 2);
  assert.equal(insights.timeoutCount, 0);
  assert.equal(insights.rateLimitCount, 0);
  assert.equal(insights.exactCacheHitCount, 0);
  assert.equal(insights.adaptiveCacheHitCount, 0);
  assert.equal(insights.cacheHitCount, 0);
  assert.equal(insights.cacheHitRate, null);
  assert.equal(insights.batchFallbackCount, 0);
  assert.deepEqual(insights.providerBreakdown, []);
  assert.deepEqual(
    insights.attentionItems.map((item) => item.code),
    ['successRateWarning', 'slowRequestsPresent']
  );
  assert.deepEqual(
    insights.attentionItems.map((item) => item.filter),
    [
      { issue: 'failed' },
      { issue: 'slow' }
    ]
  );
});

test('runtime history integration support surfaces critical attention items', () => {
  const insights = buildHistoryInsights([
    { providerId: 'provider-a', providerName: 'Primary', model: 'm1', status: 'failed', latencyMs: 100 },
    { providerId: 'provider-a', providerName: 'Primary', model: 'm1', status: 'failed', latencyMs: 200 },
    { providerId: 'provider-a', providerName: 'Primary', model: 'm1', status: 'success', latencyMs: 300 },
    { providerId: 'provider-b', providerName: 'Fallback', model: 'm2', status: 'success', latencyMs: 100 }
  ]);

  assert.equal(insights.successRate, 50);
  assert.deepEqual(
    insights.attentionItems.map((item) => ({ severity: item.severity, code: item.code })),
    [
      { severity: 'error', code: 'successRateCritical' }
    ]
  );
});

test('runtime history integration support returns null metrics when no matching provider entries exist', () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-03-22T12:00:00.000Z');
  try {
    assert.deepEqual(buildHistoryMetrics([], 'provider-a'), {
      successRate24h: null,
      avgLatencyMs: null,
      timeoutCount24h: 0,
      rateLimitCount24h: 0,
      exactCacheHitCount24h: 0,
      adaptiveCacheHitCount24h: 0,
      batchFallbackCount24h: 0
    });
  } finally {
    Date.now = originalNow;
  }
});

test('runtime history integration support calculates provider metrics within the last 24 hours only', () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-03-22T12:00:00.000Z');
  try {
    const metrics = buildHistoryMetrics([
      { providerId: 'provider-a', status: 'success', latencyMs: 100, completedAt: '2026-03-22T11:00:00.000Z' },
      {
        providerId: 'provider-a',
        status: 'failed',
        latencyMs: '150',
        completedAt: '2026-03-22T10:00:00.000Z',
        attempts: [{ errorCode: 'PROVIDER_TIMEOUT' }]
      },
      {
        providerId: 'provider-a',
        status: 'success',
        latencyMs: 'n/a',
        completedAt: '2026-03-22T09:00:00.000Z',
        attempts: [
          { cacheKind: 'exact' },
          { cacheKind: 'adaptive' },
          { errorCode: 'PROVIDER_RATE_LIMITED' }
        ],
        finalizedByFallbackRoute: true,
        effectiveExecutionMode: 'batch'
      },
      { providerId: 'provider-b', status: 'success', latencyMs: 50, completedAt: '2026-03-22T11:00:00.000Z' },
      { providerId: 'provider-a', status: 'success', latencyMs: 40, completedAt: '2026-03-20T11:59:59.000Z' }
    ], 'provider-a');

    assert.deepEqual(metrics, {
      successRate24h: 66.7,
      avgLatencyMs: 125,
      timeoutCount24h: 1,
      rateLimitCount24h: 1,
      exactCacheHitCount24h: 1,
      adaptiveCacheHitCount24h: 1,
      batchFallbackCount24h: 1
    });
  } finally {
    Date.now = originalNow;
  }
});

test('runtime history integration support normalizes integration config and applies overrides', () => {
  const config = buildIntegrationConfig({
    integrationPreferences: {
      memoqVersion: '11.0',
      customInstallDir: 'C:\\memoQ',
      selectedInstallDir: ''
    }
  }, {
    selectedInstallDir: 'D:\\Apps\\memoQ'
  });

  assert.deepEqual(config, {
    memoqVersion: '11',
    customInstallDir: 'C:\\memoQ',
    selectedInstallDir: 'D:\\Apps\\memoQ'
  });
});

test('runtime history integration support builds concise history summaries from first two visible segments', () => {
  assert.deepEqual(buildHistorySummary({
    segments: [
      { sourceText: ' One ', targetText: '' },
      { sourceText: 'Two', targetText: ' Zwei ' },
      { sourceText: 'Three', targetText: 'Drei' }
    ]
  }), {
    segmentCount: 3,
    segmentSummary: 'One | Zwei'
  });
});
