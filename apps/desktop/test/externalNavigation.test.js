const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeExternalHttpsUrl,
  normalizeUpdateArtifactName
} = require('../src/shared/externalNavigation');

test('external navigation accepts HTTPS URLs without embedded credentials', () => {
  assert.equal(
    normalizeExternalHttpsUrl(' https://example.com/releases/v1.2.3 '),
    'https://example.com/releases/v1.2.3'
  );
  assert.equal(normalizeExternalHttpsUrl('', { allowEmpty: true }), '');
});

test('external navigation rejects unsafe schemes and embedded credentials', () => {
  assert.throws(() => normalizeExternalHttpsUrl('http://example.com/release'), /must use HTTPS/);
  assert.throws(() => normalizeExternalHttpsUrl('file:///C:/Windows/System32/calc.exe'), /must use HTTPS/);
  assert.throws(() => normalizeExternalHttpsUrl('https://user:secret@example.com/release'), /must not include credentials/);
  assert.throws(() => normalizeExternalHttpsUrl('not a url'), /valid HTTPS URL/);
});

test('update artifact names stay within the configured download directory', () => {
  assert.equal(normalizeUpdateArtifactName('memoQ-AI-Hub-Setup.exe'), 'memoQ-AI-Hub-Setup.exe');
  assert.throws(() => normalizeUpdateArtifactName('../memoQ-AI-Hub-Setup.exe'), /plain file name/);
  assert.throws(() => normalizeUpdateArtifactName('nested/memoQ-AI-Hub-Setup.exe'), /plain file name/);
  assert.throws(() => normalizeUpdateArtifactName('nested\\memoQ-AI-Hub-Setup.exe'), /plain file name/);
  assert.throws(() => normalizeUpdateArtifactName('memoQ-AI-Hub-Setup.exe.'), /plain file name/);
  assert.throws(() => normalizeUpdateArtifactName('CON.exe'), /plain file name/);
});
