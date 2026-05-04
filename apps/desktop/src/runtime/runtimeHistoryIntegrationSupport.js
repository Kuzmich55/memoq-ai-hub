const {
  buildHistorySummary
} = require('./runtimeHistoryBuilder');
const {
  hasHistoryFallback,
  SLOW_HISTORY_LATENCY_MS
} = require('./runtimeHistory');
const {
  ensureIntegrationPreferences
} = require('./runtimeState');

function buildHistoryMetrics(historyEntries, providerId) {
  const threshold = Date.now() - (24 * 60 * 60 * 1000);
  const scoped = historyEntries.filter((entry) => (
    entry.providerId === providerId
    && entry.completedAt
    && new Date(entry.completedAt).getTime() >= threshold
  ));
  if (!scoped.length) {
    return {
      successRate24h: null,
      avgLatencyMs: null,
      timeoutCount24h: 0,
      rateLimitCount24h: 0,
      exactCacheHitCount24h: 0,
      adaptiveCacheHitCount24h: 0,
      batchFallbackCount24h: 0
    };
  }
  const successes = scoped.filter((entry) => entry.status === 'success').length;
  const latencies = scoped.map((entry) => Number(entry.latencyMs)).filter((value) => Number.isFinite(value));
  const attempts = scoped.flatMap((entry) => (Array.isArray(entry.attempts) ? entry.attempts : []));
  return {
    successRate24h: Number(((successes / scoped.length) * 100).toFixed(1)),
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
    timeoutCount24h: attempts.filter((attempt) => String(attempt?.errorCode || '').trim().toUpperCase() === 'PROVIDER_TIMEOUT').length,
    rateLimitCount24h: attempts.filter((attempt) => String(attempt?.errorCode || '').trim().toUpperCase() === 'PROVIDER_RATE_LIMITED').length,
    exactCacheHitCount24h: attempts.filter((attempt) => String(attempt?.cacheKind || '').trim().toLowerCase() === 'exact').length,
    adaptiveCacheHitCount24h: attempts.filter((attempt) => String(attempt?.cacheKind || '').trim().toLowerCase() === 'adaptive').length,
    batchFallbackCount24h: scoped.filter((entry) => entry.finalizedByFallbackRoute === true && entry.effectiveExecutionMode === 'batch').length
  };
}

function roundPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(1));
}

function average(values = []) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) {
    return null;
  }
  return Math.round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length);
}

function percentile(values = [], percentileValue = 95) {
  const finiteValues = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!finiteValues.length) {
    return null;
  }

  const index = Math.ceil((percentileValue / 100) * finiteValues.length) - 1;
  return finiteValues[Math.max(0, Math.min(finiteValues.length - 1, index))];
}

function normalizeLatency(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
}

function normalizeSegmentCount(entry = {}) {
  const explicit = Number(entry.segmentCount);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  return Array.isArray(entry.segments) ? entry.segments.length : 0;
}

function collectAttempts(entry = {}) {
  return Array.isArray(entry.attempts) ? entry.attempts : [];
}

function isTimeoutAttempt(attempt = {}) {
  const errorCode = String(attempt?.errorCode || '').trim().toUpperCase();
  return errorCode === 'PROVIDER_TIMEOUT' || errorCode === 'TRANSLATION_TIMEOUT';
}

function isRateLimitAttempt(attempt = {}) {
  return String(attempt?.errorCode || '').trim().toUpperCase() === 'PROVIDER_RATE_LIMITED';
}

function isBatchFallback(entry = {}) {
  return hasHistoryFallback(entry);
}

function buildBreakdownKey(entry = {}) {
  const providerId = String(entry.providerId || '').trim();
  const providerName = String(entry.providerName || '').trim();
  const model = String(entry.model || '').trim();
  return `${providerId || providerName || 'unknown-provider'}::${model || 'unknown-model'}`;
}

function buildHistoryInsights(historyEntries = []) {
  const entries = Array.isArray(historyEntries) ? historyEntries : [];
  const totalRequests = entries.length;
  const totalSegments = entries.reduce((sum, entry) => sum + normalizeSegmentCount(entry), 0);
  const successCount = entries.filter((entry) => String(entry?.status || '').trim().toLowerCase() === 'success').length;
  const failedCount = Math.max(0, totalRequests - successCount);
  const latencies = entries
    .map((entry) => normalizeLatency(entry?.latencyMs))
    .filter((value) => value !== null);
  const attempts = entries.flatMap((entry) => collectAttempts(entry));
  const exactCacheHitCount = attempts.filter((attempt) => String(attempt?.cacheKind || '').trim().toLowerCase() === 'exact').length;
  const adaptiveCacheHitCount = attempts.filter((attempt) => String(attempt?.cacheKind || '').trim().toLowerCase() === 'adaptive').length;
  const cacheHitCount = exactCacheHitCount + adaptiveCacheHitCount;
  const timeoutCount = attempts.filter(isTimeoutAttempt).length;
  const rateLimitCount = attempts.filter(isRateLimitAttempt).length;
  const batchFallbackCount = entries.filter(isBatchFallback).length;
  const successRate = totalRequests ? roundPercent((successCount / totalRequests) * 100) : null;
  const cacheHitRate = totalRequests ? roundPercent((Math.min(cacheHitCount, totalRequests) / totalRequests) * 100) : null;
  const avgLatencyMs = average(latencies);
  const p95LatencyMs = percentile(latencies, 95);
  const breakdownMap = new Map();

  for (const entry of entries) {
    const key = buildBreakdownKey(entry);
    const current = breakdownMap.get(key) || {
      key,
      providerId: String(entry.providerId || '').trim(),
      providerName: String(entry.providerName || '').trim() || 'Unknown provider',
      model: String(entry.model || '').trim() || 'Unknown model',
      requestCount: 0,
      segmentCount: 0,
      successCount: 0,
      failedCount: 0,
      fallbackCount: 0,
      latencyValues: []
    };
    const latency = normalizeLatency(entry?.latencyMs);
    current.requestCount += 1;
    current.segmentCount += normalizeSegmentCount(entry);
    if (String(entry?.status || '').trim().toLowerCase() === 'success') {
      current.successCount += 1;
    } else {
      current.failedCount += 1;
    }
    if (isBatchFallback(entry)) {
      current.fallbackCount += 1;
    }
    if (latency !== null) {
      current.latencyValues.push(latency);
    }
    breakdownMap.set(key, current);
  }

  const providerBreakdown = Array.from(breakdownMap.values())
    .map((item) => ({
      key: item.key,
      providerId: item.providerId,
      providerName: item.providerName,
      model: item.model,
      requestCount: item.requestCount,
      segmentCount: item.segmentCount,
      successRate: item.requestCount ? roundPercent((item.successCount / item.requestCount) * 100) : null,
      avgLatencyMs: average(item.latencyValues),
      failedCount: item.failedCount,
      fallbackCount: item.fallbackCount
    }))
    .sort((a, b) => (
      b.requestCount - a.requestCount
      || (a.successRate ?? 101) - (b.successRate ?? 101)
      || String(a.providerName).localeCompare(String(b.providerName))
      || String(a.model).localeCompare(String(b.model))
    ));

  const attentionItems = [];
  if (totalRequests > 0 && successRate !== null && successRate < 75) {
    attentionItems.push({ key: 'success-rate-critical', severity: 'error', code: 'successRateCritical', values: { value: successRate }, filter: { issue: 'failed' } });
  } else if (totalRequests > 0 && successRate !== null && successRate < 90) {
    attentionItems.push({ key: 'success-rate-warning', severity: 'warning', code: 'successRateWarning', values: { value: successRate }, filter: { issue: 'failed' } });
  }

  if (p95LatencyMs !== null && p95LatencyMs > SLOW_HISTORY_LATENCY_MS) {
    attentionItems.push({ key: 'p95-latency-high', severity: 'warning', code: 'p95LatencyHigh', values: { value: p95LatencyMs }, filter: { issue: 'slow' } });
  }

  if (timeoutCount > 0) {
    attentionItems.push({ key: 'timeouts-present', severity: 'warning', code: 'timeoutsPresent', values: { count: timeoutCount }, filter: { issue: 'timeout' } });
  }

  if (rateLimitCount > 0) {
    attentionItems.push({ key: 'rate-limits-present', severity: 'warning', code: 'rateLimitsPresent', values: { count: rateLimitCount }, filter: { issue: 'rate_limit' } });
  }

  if (batchFallbackCount > 0) {
    attentionItems.push({ key: 'batch-fallbacks-present', severity: 'info', code: 'batchFallbacksPresent', values: { count: batchFallbackCount }, filter: { issue: 'fallback' } });
  }

  const weakestBreakdown = providerBreakdown
    .filter((item) => item.requestCount >= 3 && item.successRate !== null)
    .sort((a, b) => a.successRate - b.successRate || b.requestCount - a.requestCount)[0];
  if (weakestBreakdown && weakestBreakdown.successRate < 90) {
    attentionItems.push({
      key: `weak-provider-${weakestBreakdown.key}`,
      severity: weakestBreakdown.successRate < 75 ? 'error' : 'warning',
      code: 'weakProvider',
      values: {
        provider: weakestBreakdown.providerName,
        model: weakestBreakdown.model,
        value: weakestBreakdown.successRate
      },
      filter: {
        provider: weakestBreakdown.providerName,
        model: weakestBreakdown.model
      },
      providerId: weakestBreakdown.providerId,
      model: weakestBreakdown.model
    });
  }

  return {
    totalRequests,
    totalSegments,
    successCount,
    failedCount,
    successRate,
    avgLatencyMs,
    p95LatencyMs,
    timeoutCount,
    rateLimitCount,
    exactCacheHitCount,
    adaptiveCacheHitCount,
    cacheHitCount,
    cacheHitRate,
    batchFallbackCount,
    providerBreakdown,
    attentionItems: attentionItems.slice(0, 5)
  };
}

function buildIntegrationConfig(state, overrides = {}) {
  const preferences = ensureIntegrationPreferences({
    ...(state?.integrationPreferences || {}),
    ...overrides
  });

  return {
    memoqVersion: preferences.memoqVersion,
    customInstallDir: preferences.customInstallDir,
    selectedInstallDir: preferences.selectedInstallDir
  };
}

module.exports = {
  buildHistoryInsights,
  buildHistoryMetrics,
  buildHistorySummary,
  buildIntegrationConfig
};
