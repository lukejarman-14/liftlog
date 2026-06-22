import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const configPath = resolve('ios/App/App/capacitor.config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const packageClassList = Array.isArray(config.packageClassList)
  ? config.packageClassList
  : [];

if (!packageClassList.includes('HealthKitPlugin')) {
  config.packageClassList = ['HealthKitPlugin', ...packageClassList];
  writeFileSync(configPath, `${JSON.stringify(config, null, '\t')}\n`);
  console.log('Patched iOS Capacitor config: added HealthKitPlugin');
}

if (process.platform === 'darwin') {
  const result = spawnSync('xattr', ['-cr', resolve('ios/App/App')], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    throw new Error('Failed to strip macOS extended attributes from iOS resources');
  }
}
