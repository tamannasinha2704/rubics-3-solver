// Build plugin: publishes licenses.txt next to the site with the license text
// of every third-party package that ends up in the built files. Minifying
// strips the license comments from the code, so this keeps the notices that
// the MIT and OFL licenses require alongside the published copy.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Code copied into the repository rather than installed from npm. */
const VENDORED = [
  {
    name: 'cubejs',
    version: '1.3.2 (vendored in src/solver/vendor/cubejs)',
    license: 'MIT',
    file: 'src/solver/vendor/cubejs/LICENSE',
  },
];

function findLicenseFile(dir: string): string | null {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  return file ? path.join(dir, file) : null;
}

export function licensesPlugin(owner: string): Plugin {
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle() {
      const packages = new Map<string, string>(); // name -> directory
      for (const id of this.getModuleIds()) {
        const clean = id.replace(/\\/g, '/').split('?')[0];
        const match = /\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(clean);
        if (match) packages.set(match[1], clean.slice(0, match.index) + '/node_modules/' + match[1]);
      }

      const sections: string[] = [];
      for (const [name, dir] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
        const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
        const licenseFile = findLicenseFile(dir);
        if (!licenseFile) this.error(`No license file found for ${name} in ${dir}`);
        sections.push(`${name} ${pkg.version} (${pkg.license})\n\n${readFileSync(licenseFile, 'utf8').trim()}`);
      }
      for (const v of VENDORED) {
        if (!existsSync(v.file)) this.error(`Missing ${v.file}`);
        sections.push(`${v.name} ${v.version} (${v.license})\n\n${readFileSync(v.file, 'utf8').trim()}`);
      }

      const rule = '\n\n' + '='.repeat(78) + '\n\n';
      const source =
        `Cube Coach\nCopyright (c) ${new Date().getFullYear()} ${owner}. Released under the MIT License.\n\n` +
        'This website includes the open-source software and fonts listed below.\n' +
        'Their copyright notices and license terms follow.' +
        rule +
        sections.join(rule) +
        '\n';
      this.emitFile({ type: 'asset', fileName: 'licenses.txt', source });
    },
  };
}
