const {
  formatTimestampForLocalDisplay,
  parseDateInputToEpochMs,
  parseTimestampToEpochMs
} = require('../shared/timeFormatting');

const SLOW_HISTORY_LATENCY_MS = 30000;
const HISTORY_ISSUE_FILTERS = new Set(['failed', 'timeout', 'rate_limit', 'fallback', 'slow']);

function parseTimeMs(value) {
  const parsed = parseTimestampToEpochMs(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseLocalFilterDate(value, endOfDay = false) {
  const parsed = parseDateInputToEpochMs(value, { endOfDay });
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatLocalTimestamp(value) {
  return formatTimestampForLocalDisplay(value, { fallback: '' });
}

function getHistoryAttempts(entry = {}) {
  return Array.isArray(entry.attempts) ? entry.attempts : [];
}

function getHistoryAttemptErrorCode(attempt = {}) {
  return String(attempt?.errorCode || '').trim().toUpperCase();
}

function isHistoryTimeoutAttempt(attempt = {}) {
  const errorCode = getHistoryAttemptErrorCode(attempt);
  return errorCode === 'PROVIDER_TIMEOUT' || errorCode === 'TRANSLATION_TIMEOUT';
}

function isHistoryRateLimitAttempt(attempt = {}) {
  return getHistoryAttemptErrorCode(attempt) === 'PROVIDER_RATE_LIMITED';
}

function hasHistoryFallback(entry = {}) {
  if (entry.finalizedByFallbackRoute === true) {
    return true;
  }
  if (Array.isArray(entry.throughput?.fallbackReasons) && entry.throughput.fallbackReasons.length > 0) {
    return true;
  }
  return getHistoryAttempts(entry).some((attempt) => attempt?.finalizedByFallbackRoute === true);
}

function matchesHistoryIssue(entry = {}, issue = '') {
  const normalizedIssue = String(issue || '').trim().toLowerCase();
  if (!normalizedIssue || !HISTORY_ISSUE_FILTERS.has(normalizedIssue)) {
    return true;
  }

  if (normalizedIssue === 'failed') {
    return String(entry?.status || '').trim().toLowerCase() === 'failed';
  }

  if (normalizedIssue === 'timeout') {
    return getHistoryAttempts(entry).some(isHistoryTimeoutAttempt);
  }

  if (normalizedIssue === 'rate_limit') {
    return getHistoryAttempts(entry).some(isHistoryRateLimitAttempt);
  }

  if (normalizedIssue === 'fallback') {
    return hasHistoryFallback(entry);
  }

  if (normalizedIssue === 'slow') {
    const latencyMs = Number(entry?.latencyMs);
    return Number.isFinite(latencyMs) && latencyMs > SLOW_HISTORY_LATENCY_MS;
  }

  return true;
}

function filterHistoryEntries(historyEntries, filters = {}) {
  const dateFromMs = parseLocalFilterDate(filters.dateFrom);
  const dateToMs = parseLocalFilterDate(filters.dateTo, true);
  return historyEntries.filter((entry) => {
    const keyword = String(filters.search || '').trim().toLowerCase();
    if (filters.projectId && entry.projectId !== filters.projectId) return false;
    if (filters.subject && entry.subject !== filters.subject) return false;
    if (filters.provider) {
      const providerFilter = String(filters.provider).trim().toLowerCase();
      const providerId = String(entry.providerId || '').trim().toLowerCase();
      const providerName = String(entry.providerName || '').trim().toLowerCase();
      if (providerFilter && providerFilter !== providerId && providerFilter !== providerName) return false;
    }
    if (filters.model && entry.model !== filters.model) return false;
    if (filters.status && entry.status !== filters.status) return false;
    if (filters.issue && !matchesHistoryIssue(entry, filters.issue)) return false;
    const submittedAtMs = parseTimeMs(entry.submittedAt);
    if (Number.isFinite(dateFromMs) && Number.isFinite(submittedAtMs) && submittedAtMs < dateFromMs) return false;
    if (Number.isFinite(dateToMs) && Number.isFinite(submittedAtMs) && submittedAtMs > dateToMs) return false;
    return keyword ? JSON.stringify(entry).toLowerCase().includes(keyword) : true;
  });
}

module.exports = {
  HISTORY_ISSUE_FILTERS,
  SLOW_HISTORY_LATENCY_MS,
  parseTimeMs,
  parseLocalFilterDate,
  formatLocalTimestamp,
  filterHistoryEntries,
  hasHistoryFallback,
  matchesHistoryIssue
};
