const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseCustomTmAsset } = require('../src/asset/assetGlossaryParser');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'memoq-ai-hub-real-tmx-'));
}

test('custom TMX parsing handles large escaped-context files beyond glossary preview limits', () => {
  const tempDir = createTempDir();
  try {
    const customTmPath = path.join(tempDir, 'large-context.tmx');
    const units = [];
    for (let index = 0; index < 1005; index += 1) {
      units.push([
        `<tu tuid="tu-${index}">`,
        `<tuv xml:lang="zh-CN"><prop type="x-context-pre">&lt;seg&gt;Context ${index}&lt;/seg&gt;</prop><seg>源文 ${index}</seg></tuv>`,
        `<tuv xml:lang="ko"><seg>번역 ${index}</seg></tuv>`,
        '</tu>'
      ].join(''));
    }
    fs.writeFileSync(customTmPath, `<tmx version="1.4"><body>${units.join('')}</body></tmx>`, 'utf8');

    const parsed = parseCustomTmAsset({
      id: 'asset-large-tmx',
      type: 'custom_tm',
      name: 'large-context.tmx',
      fileName: 'large-context.tmx',
      storedPath: customTmPath,
      sha256: 'hash-large-tmx'
    });

    assert.equal(parsed.parseInfo.parsingMode, 'tmx');
    assert.equal(parsed.rowCount, 2010);
    assert.equal(parsed.entries[0].sourceLang, 'zh-CN');
    assert.equal(parsed.entries[0].targetLang, 'ko');
    assert.equal(parsed.entries[0].context.previousSource, 'Context 0');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
