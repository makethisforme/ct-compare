// Extracts <script id="core"> from cta-drafter.html and runs it in a sandbox.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCore() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'cta-drafter.html'), 'utf8');
  const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('core script not found');
  const sandbox = {};
  const fn = vm.runInThisContext('(function (globalThis) {' + m[1] + '\n})');
  fn(sandbox);
  return sandbox.CTACore;
}
module.exports = { loadCore };
