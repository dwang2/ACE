import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { install, update } from '../lib/installer.js';

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'ace-test-'));
}

describe('install', () => {
  it('copies all files into an empty directory', () => {
    const dest = tmpDir();
    after(() => rmSync(dest, { recursive: true }));

    const results = install(dest);

    assert.ok(results.length > 0, 'should copy at least one file');
    assert.ok(results.every(r => r.status === 'copied'), 'all should be copied');
    assert.ok(existsSync(join(dest, '.claude', 'agents', 'architect.md')));
    assert.ok(existsSync(join(dest, 'kb', 'USAGE.md')));
    assert.ok(existsSync(join(dest, '.github', 'workflows', 'ci.yml')));
  });

  it('skips existing files by default', () => {
    const dest = tmpDir();
    after(() => rmSync(dest, { recursive: true }));

    const agentPath = join(dest, '.claude', 'agents', 'architect.md');
    mkdirSync(join(dest, '.claude', 'agents'), { recursive: true });
    writeFileSync(agentPath, 'custom content');

    install(dest);

    assert.equal(readFileSync(agentPath, 'utf8'), 'custom content');
    const skipped = install(dest).filter(r => r.path === '.claude/agents/architect.md' && r.status === 'skipped');
    assert.equal(skipped.length, 1);
  });

  it('overwrites existing files when force is true', () => {
    const dest = tmpDir();
    after(() => rmSync(dest, { recursive: true }));

    const agentPath = join(dest, '.claude', 'agents', 'architect.md');
    mkdirSync(join(dest, '.claude', 'agents'), { recursive: true });
    writeFileSync(agentPath, 'custom content');

    install(dest, { force: true });

    assert.notEqual(readFileSync(agentPath, 'utf8'), 'custom content');
  });

  it('skips .github/workflows/ci.yml when includeCi is false', () => {
    const dest = tmpDir();
    after(() => rmSync(dest, { recursive: true }));

    install(dest, { includeCi: false });

    assert.ok(!existsSync(join(dest, '.github', 'workflows', 'ci.yml')));
    const skipped = install(dest, { includeCi: false })
      .find(r => r.path === '.github/workflows/ci.yml');
    assert.equal(skipped?.status, 'skipped');
  });
});

describe('update', () => {
  it('warns about locally modified files and skips them', () => {
    const dest = tmpDir();
    after(() => rmSync(dest, { recursive: true }));

    install(dest);

    const agentPath = join(dest, '.claude', 'agents', 'developer.md');
    writeFileSync(agentPath, 'my customizations');

    const results = update(dest);
    const warned = results.find(r => r.path === '.claude/agents/developer.md');
    assert.equal(warned?.status, 'warned');
    assert.equal(readFileSync(agentPath, 'utf8'), 'my customizations');
  });

  it('updates unmodified files', () => {
    const dest = tmpDir();
    after(() => rmSync(dest, { recursive: true }));

    install(dest);

    const results = update(dest);
    const unmodified = results.filter(r => r.status === 'updated');
    assert.ok(unmodified.length > 0, 'should update at least one unmodified file');
  });

  it('overwrites locally modified files when force is true', () => {
    const dest = tmpDir();
    after(() => rmSync(dest, { recursive: true }));

    install(dest);

    const agentPath = join(dest, '.claude', 'agents', 'developer.md');
    writeFileSync(agentPath, 'my customizations');

    update(dest, { force: true });

    assert.notEqual(readFileSync(agentPath, 'utf8'), 'my customizations');
  });

  it('copies files that are missing from the destination', () => {
    const dest = tmpDir();
    after(() => rmSync(dest, { recursive: true }));

    const results = update(dest);
    const copied = results.filter(r => r.status === 'copied');
    assert.ok(copied.length > 0, 'should copy missing files');
  });
});
