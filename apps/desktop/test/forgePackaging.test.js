const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const forgeConfig = require('../forge.config');

test('forge packaging collects transitive runtime dependencies for discovered desktop modules', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'memoq-forge-packaging-'));
  const buildDir = path.join(tempRoot, '.vite', 'build');

  try {
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, 'backgroundWorker.js'), "require('express');\n", 'utf8');

    const packageNames = forgeConfig.__testables.collectRuntimePackageNames(tempRoot);

    assert.equal(packageNames.includes('express'), true);
    assert.equal(packageNames.includes('mime-db'), true);
    assert.equal(packageNames.includes('electron'), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('forge packaging resolves hoisted ESM-only package roots without a CommonJS export', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'memoq-esm-package-'));
  const packageName = 'memoq-esm-only-fixture';
  const fixtureDir = path.join(tempRoot, 'node_modules', packageName);

  try {
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'package.json'), JSON.stringify({
      name: packageName,
      version: '1.0.0',
      type: 'module',
      exports: './index.js'
    }), 'utf8');
    fs.writeFileSync(path.join(fixtureDir, 'index.js'), 'export default true;\n', 'utf8');

    const packageDir = forgeConfig.__testables.resolvePackageDirectory(packageName, {
      nodeModulesPaths: [],
      resolutionPaths: [tempRoot]
    });
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
    );

    assert.equal(packageJson.name, packageName);
    assert.equal(fs.realpathSync(packageDir), fs.realpathSync(fixtureDir));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('forge packaging treats bundled parser entrypoints as self-contained', () => {
  const xlsxDir = forgeConfig.__testables.resolvePackageDirectory('xlsx');
  const parserDir = forgeConfig.__testables.resolvePackageDirectory('fast-xml-parser');

  assert.deepEqual(forgeConfig.__testables.getPackageDependencyNames(xlsxDir), []);
  assert.deepEqual(forgeConfig.__testables.getPackageDependencyNames(parserDir), []);
});

test('forge packaging keeps only runtime files for heavyweight dependencies', () => {
  const shouldCopy = forgeConfig.__testables.shouldCopyRuntimePackagePath;

  assert.equal(shouldCopy('sql.js', 'dist/sql-wasm.js'), true);
  assert.equal(shouldCopy('sql.js', 'dist/sql-asm-debug.js'), false);
  assert.equal(shouldCopy('xlsx', 'xlsx.js'), true);
  assert.equal(shouldCopy('xlsx', 'dist/xlsx.full.min.js'), false);
  assert.equal(shouldCopy('openai', 'resources/responses/responses.js'), true);
  assert.equal(shouldCopy('openai', 'resources/responses/responses.d.ts'), false);
  assert.equal(shouldCopy('openai', 'src/resources/responses/responses.ts'), false);
});
