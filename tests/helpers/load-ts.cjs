const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

const root = path.join(__dirname, '../..');
// Main-process dependencies are installed under src-electron/.
const electronRequire = require('node:module').createRequire(path.join(root, 'src-electron/package.json'));

function transpile(file, format) {
  return esbuild.transformSync(fs.readFileSync(path.join(root, file), 'utf8'), { loader: 'ts', format }).code;
}

// Evaluates a TS module as CommonJS in its own context; `globals` may supply `require`.
function loadTs(file, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(transpile(file, 'cjs'), { module, exports: module.exports, ...globals });
  return module.exports;
}

// Strips imports and exports so several modules can share one context, with dependencies as globals.
function stripModule(file) {
  return transpile(file, 'esm')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export (\{.*\}|default |const |class |function |let |var )/gm, '$1')
    .replace(/^export \{[\s\S]*?\};?\r?\n/gm, '');
}

module.exports = { root, electronRequire, loadTs, stripModule };
