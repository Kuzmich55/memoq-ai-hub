const test = require('node:test');
const assert = require('node:assert/strict');

const {
  bucketTmScore,
  calculatePlaceholderPenalty,
  calculateTokenSimilarity,
  createCustomTmMatcher,
  levenshteinDistance,
  matchCustomTmEntries,
  tokenizeForTmMatch
} = require('../src/asset/assetTmMatcher');

test('custom TM matcher calculates token-level Levenshtein similarity', () => {
  assert.equal(levenshteinDistance(['restart', 'service'], ['restart', 'service']), 0);
  assert.equal(levenshteinDistance(['restart', 'service'], ['restart', 'the', 'service']), 1);
  assert.equal(levenshteinDistance(['restart', 'service'], ['stop', 'service']), 1);
  assert.equal(calculateTokenSimilarity(['restart', 'service'], ['restart', 'service']), 100);
  assert.equal(calculateTokenSimilarity(['restart', 'service'], ['restart', 'the', 'service']), 67);
  assert.equal(calculateTokenSimilarity([], []), 0);
});

test('custom TM matcher tokenizes CJK and placeholders as stable tokens', () => {
  assert.deepEqual(tokenizeForTmMatch('英雄带兵 {{count}}'), ['英', '雄', '带', '兵', '{{count}}']);
  assert.deepEqual(tokenizeForTmMatch('Restart {1} service'), ['restart', '{1}', 'service']);
  assert.deepEqual(tokenizeForTmMatch('Click <b>{1}</b>'), ['click', '<b>', '{1}', '</b>']);
});

test('custom TM matcher maps memoQ-style score buckets', () => {
  assert.equal(bucketTmScore(100, true), '101%');
  assert.equal(bucketTmScore(100), '100%');
  assert.equal(bucketTmScore(95), '95-99');
  assert.equal(bucketTmScore(94), '85-94');
  assert.equal(bucketTmScore(84), '75-84');
  assert.equal(bucketTmScore(74), '<75');
});

test('custom TM matcher penalizes missing placeholders', () => {
  assert.equal(calculatePlaceholderPenalty('Restart {1} service', 'Restart {1} service'), 0);
  assert.ok(calculatePlaceholderPenalty('Restart {1} service', 'Restart service') > 0);
});

test('custom TM matcher returns top matches above the 75 threshold', () => {
  const matcher = createCustomTmMatcher([
    {
      sourceText: 'Restart service',
      targetText: 'Redemarrer le service',
      sourceLang: 'en-US',
      targetLang: 'fr-FR',
      assetName: 'sample.tmx'
    },
    {
      sourceText: 'Install the application',
      targetText: 'Installer l’application',
      sourceLang: 'en-US',
      targetLang: 'fr-FR',
      assetName: 'sample.tmx'
    }
  ]);

  const matches = matchCustomTmEntries({
    matcher,
    segment: { sourceText: 'Restart service' },
    sourceLanguage: 'en',
    targetLanguage: 'fr'
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].score, 100);
  assert.equal(matches[0].bucket, '100%');
  assert.equal(matches[0].assetName, 'sample.tmx');
});

test('custom TM matcher deduplicates repeated TM hits before limiting top matches', () => {
  const matcher = createCustomTmMatcher([
    {
      sourceText: 'quickaction',
      targetText: '快速操作',
      sourceLang: 'en',
      targetLang: 'zh-CN',
      assetName: 'sample.tmx'
    },
    {
      sourceText: 'quickaction',
      targetText: '快速操作',
      sourceLang: 'en',
      targetLang: 'zh-CN',
      assetName: 'sample.tmx'
    }
  ]);

  const matches = matchCustomTmEntries({
    matcher,
    segment: { sourceText: 'quickaction' },
    sourceLanguage: 'en-US',
    targetLanguage: 'zh-CN',
    maxMatches: 3
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].score, 100);
  assert.equal(matches[0].targetText, '快速操作');
});

test('custom TM matcher promotes exact matches to 101 only with context evidence', () => {
  const matcher = createCustomTmMatcher([{
    sourceText: 'Restart service',
    targetText: 'Redemarrer le service',
    sourceLang: 'en',
    targetLang: 'fr',
    context: { previousSource: 'Open settings' }
  }]);

  const [match] = matchCustomTmEntries({
    matcher,
    segment: {
      sourceText: 'Restart service',
      neighborContext: {
        previousSegment: { sourceText: 'Open settings', targetText: '' }
      }
    },
    sourceLanguage: 'en',
    targetLanguage: 'fr'
  });

  assert.equal(match.score, 101);
  assert.equal(match.bucket, '101%');
});
