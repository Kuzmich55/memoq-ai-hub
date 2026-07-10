import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activateOnKeyboard,
  buildDashboardChecklist,
  getPageScrollPosition,
  getShellNavigationMode,
  normalizePageScrollPositions,
  normalizePageKey,
  readShellState,
  resolveDirtyNavigationKind,
  updatePageScrollPosition,
  writeShellState
} from '../src/renderer/src/uiBehavior.mjs';

function createStorage(initialValue = null) {
  const values = new Map(initialValue == null ? [] : [['memoq-ai-hub.shell', initialValue]]);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}

test('shell state restores only valid pages and persists navigation preference', () => {
  const storage = createStorage(JSON.stringify({ activePage: 'assets', navCollapsed: true, pageScrollPositions: { assets: 412.4, retired: 9 } }));
  assert.deepEqual(readShellState(storage), {
    activePage: 'assets',
    navCollapsed: true,
    pageScrollPositions: { assets: 412 }
  });

  writeShellState(storage, { activePage: 'retired-page', navCollapsed: false });
  assert.deepEqual(readShellState(storage), { activePage: 'dashboard', navCollapsed: false, pageScrollPositions: {} });
  assert.equal(normalizePageKey('providers'), 'providers');
  assert.equal(normalizePageKey('mapping'), 'dashboard');
  assert.deepEqual(normalizePageScrollPositions({ dashboard: -2, history: 90.7, logs: '24' }), { history: 91, logs: 24 });

  const positions = updatePageScrollPosition({ dashboard: 12 }, 'assets', 338.6);
  assert.deepEqual(positions, { dashboard: 12, assets: 339 });
  assert.equal(getPageScrollPosition(positions, 'assets'), 339);
  assert.equal(getPageScrollPosition(positions, 'retired-page'), 0);
});

test('shell navigation changes from persistent to compact to drawer by viewport width', () => {
  assert.equal(getShellNavigationMode(1366), 'expanded');
  assert.equal(getShellNavigationMode(1024), 'compact');
  assert.equal(getShellNavigationMode(768), 'drawer');
  assert.equal(getShellNavigationMode(767), 'drawer');
});

test('keyboard activation accepts Enter and Space and ignores unrelated keys', () => {
  let activationCount = 0;
  let prevented = false;
  assert.equal(activateOnKeyboard({ key: 'Enter', preventDefault: () => { prevented = true; } }, () => { activationCount += 1; }), true);
  assert.equal(prevented, true);
  assert.equal(activateOnKeyboard({ key: ' ', preventDefault() {} }, () => { activationCount += 1; }), true);
  assert.equal(activateOnKeyboard({ key: 'ArrowDown' }, () => { activationCount += 1; }), false);
  assert.equal(activationCount, 2);
});

test('dirty navigation identifies the editor that must be resolved', () => {
  assert.equal(resolveDirtyNavigationKind({ activePage: 'providers', navigationKind: 'page', currentProviderDirty: true }), 'provider');
  assert.equal(resolveDirtyNavigationKind({ activePage: 'builder', navigationKind: 'page', currentProfileDirty: true }), 'profile');
  assert.equal(resolveDirtyNavigationKind({ activePage: 'history', navigationKind: 'page', currentProviderDirty: true }), '');
  assert.equal(resolveDirtyNavigationKind({ navigationKind: 'provider', currentProviderDirty: true }), 'provider');
  assert.equal(resolveDirtyNavigationKind({ navigationKind: 'profile', currentProfileDirty: false }), '');
});

test('dashboard checklist presents the full five-step product journey', () => {
  const translate = (key, values = {}) => `${key}:${values.step ?? values.count ?? ''}`;
  const checklist = buildDashboardChecklist([
    { key: 'install-plugin', completed: true },
    { key: 'provider-hub', count: 1 },
    { key: 'asset-hub', count: 0, optional: true },
    { key: 'context-builder', count: 2 },
    { key: 'history', count: 0 }
  ], translate);

  assert.deepEqual(checklist.map((item) => item.key), [
    'install-plugin',
    'provider-hub',
    'asset-hub',
    'context-builder',
    'history'
  ]);
  assert.equal(checklist[0].title, 'dashboard.checklistInstallTitle:1');
  assert.equal(checklist[2].subtitle, 'dashboard.checklistAssetsOptional:');
  assert.equal(checklist[3].subtitle, 'dashboard.checklistProfileCount:2');
});
