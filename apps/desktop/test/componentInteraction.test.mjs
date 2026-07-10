import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(testDir, '..');

async function loadRendererComponent(modulePath) {
  const server = await createServer({
    configFile: path.join(desktopRoot, 'vite.renderer.config.mjs'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });
  try {
    return await server.ssrLoadModule(modulePath);
  } finally {
    await server.close();
  }
}

test('selectable profile row exposes listbox semantics and responds to keyboard activation', async () => {
  const { CollapsibleItemList, ProfileListRow } = await loadRendererComponent('/src/components/CollapsibleSidePanel.jsx');
  let activationCount = 0;
  let preventedCount = 0;
  const entry = {
    id: 'profile-1',
    label: 'Production profile',
    isSelected: true,
    tags: []
  };
  const row = ProfileListRow({
    entry,
    compact: false,
    onClick: () => { activationCount += 1; }
  });

  assert.equal(row.props.role, 'option');
  assert.equal(row.props.tabIndex, 0);
  assert.equal(row.props['aria-selected'], true);

  row.props.onKeyDown({ key: 'Enter', preventDefault: () => { preventedCount += 1; } });
  row.props.onKeyDown({ key: ' ', preventDefault: () => { preventedCount += 1; } });
  row.props.onKeyDown({ key: 'ArrowDown', preventDefault: () => { preventedCount += 1; } });
  assert.equal(activationCount, 2);
  assert.equal(preventedCount, 2);

  const list = CollapsibleItemList({
    entries: [entry],
    collapsed: false,
    emptyText: 'No profiles',
    onSelect() {},
    renderExpandedItem: () => row
  });
  assert.equal(list.props.role, 'listbox');
});
