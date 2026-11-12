import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_VERSION, versionLabel } from './version';

const root = process.cwd();
const pkg = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
) as { version: string };

describe('app version', () => {
  it('comes from package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('renders with a v prefix', () => {
    expect(versionLabel()).toBe(`v${pkg.version}`);
    expect(versionLabel('0.5')).toBe('v0.5');
  });

  it('has a changelog entry for the current version', () => {
    const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
    expect(changelog).toContain(`## v${pkg.version}`);
  });
});
