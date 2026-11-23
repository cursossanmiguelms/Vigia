#!/usr/bin/env node
/* Comprueba la sintaxis de todos los archivos JS del proyecto sin ejecutarlos. */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directories = [join(root, 'mockup', 'js'), join(root, 'tests'), join(root, 'scripts')];

function collect(directory) {
  let files = [];
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return files;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files = files.concat(collect(path));
    } else if (extname(path) === '.js') {
      files.push(path);
    }
  }
  return files;
}

const files = directories.flatMap(collect);
let failures = 0;

for (const file of files) {
  try {
    new Script(readFileSync(file, 'utf8'), { filename: relative(root, file) });
    console.log(`ok   ${relative(root, file)}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${relative(root, file)}: ${error.message}`);
  }
}

console.log(`${files.length} archivos JS revisados, ${failures} con errores.`);
process.exitCode = failures ? 1 : 0;
