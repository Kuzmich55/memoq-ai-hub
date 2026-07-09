const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPrompt
} = require('../src/provider/providerPromptBuilder');

test('provider prompt payload separates memoQ TM hints from uploaded TM matches and bucket guidance', () => {
  const result = buildPrompt({
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    sourceText: 'Restart service',
    tmSource: 'Restart service',
    tmTarget: 'Redemarrez le service',
    customTmMatches: [{
      sourceText: 'Restart service',
      targetText: 'Redemarrer le service',
      score: 95,
      bucket: '95-99',
      scoreType: 'AI Hub TM score',
      assetName: 'sample.tmx'
    }],
    profile: {
      useBestFuzzyTm: true,
      useCustomTm: true,
      customTmMatchBuckets: ['95-99']
    },
    requestType: 'Plaintext'
  });

  const segmentPayload = result.payload.segments[0];
  assert.equal(segmentPayload.tmHints.sourceText, 'Restart service');
  assert.equal(segmentPayload.tmHints.targetText, 'Redemarrez le service');
  assert.deepEqual(segmentPayload.customTmMatches.selectedBuckets, ['95-99']);
  assert.equal(segmentPayload.customTmMatches.matches[0].targetText, 'Redemarrer le service');
  assert.match(segmentPayload.customTmMatches.guidance, /memoQ tmHints are the official project best fuzzy reference/);
});

test('provider prompt payload omits memoQ TM hints when disabled without removing uploaded TM matches', () => {
  const result = buildPrompt({
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    sourceText: 'Restart service',
    tmSource: 'Restart service',
    tmTarget: 'Redemarrez le service',
    customTmMatches: [{
      sourceText: 'Restart service',
      targetText: 'Redemarrer le service',
      score: 100,
      bucket: '100%',
      scoreType: 'AI Hub TM score',
      assetName: 'sample.tmx'
    }],
    profile: {
      useBestFuzzyTm: false,
      useCustomTm: true,
      customTmMatchBuckets: ['100%']
    },
    requestType: 'Plaintext'
  });

  const segmentPayload = result.payload.segments[0];
  assert.equal(segmentPayload.tmHints.available, false);
  assert.equal(segmentPayload.tmHints.sourceText, '');
  assert.equal(segmentPayload.customTmMatches.available, true);
  assert.equal(segmentPayload.customTmMatches.matches[0].bucket, '100%');
});
