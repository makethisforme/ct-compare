const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');
const C = loadCore();

const ex = (id) => C.EXAMPLES.find((e) => e.id === id);
const statusOf = (res, startsWith) => res.lines.find((l) => l.text.startsWith(startsWith)).status;

test('normalizeLabel drops notes, case, punctuation', () => {
  assert.equal(C.normalizeLabel('Sinotubular junction (graft)'), 'sinotubular junction');
  assert.equal(C.normalizeLabel('  Mid  Ascending Aorta (mechanical) '), 'mid ascending aorta');
});

test('every spec label and synonym maps to its landmark', () => {
  const cases = {
    sinus: ['Sinus of Valsalva', 'Sinus of Valsalva (mechanical)', 'Aortic root at the sinus', 'Aortic root'],
    stj: ['Sinotubular junction', 'Sinotubular junction (graft)', 'STJ'],
    midAsc: ['Mid ascending aorta', 'Mid ascending aorta (graft)', 'Ascending aorta'],
    proxBrachio: ['Ascending proximal to the brachiocephalic', 'Distal ascending aorta'],
    arch: ['Top of the aortic arch proximal to left subclavian', 'Aortic arch', 'Arch'],
    proxDesc: ['Proximal descending distal to left subclavian', 'Proximal descending thoracic aorta'],
    midDesc: ['Mid descending thoracic aorta'],
    diaphragm: ['Aorta at the diaphragm', 'Distal descending thoracic aorta at the hiatus'],
    suprarenal: ['Suprarenal aorta'],
    infrarenal: ['Infrarenal aorta'],
  };
  for (const [key, labels] of Object.entries(cases)) {
    for (const l of labels) {
      const m = C.matchLandmark(l);
      assert.ok(m, `no match for ${l}`);
      assert.equal(m.key, key, l);
      assert.equal(m.via, 'known', l);
    }
  }
  assert.equal(C.matchLandmark('Impression'), null);
  assert.equal(C.matchLandmark('Heart'), null);
});

test('parseLine handles value forms', () => {
  let p = C.parseLine('Sinus of Valsalva (mechanical): 28 x 28 x 28(29 x 25)');
  assert.equal(p.kind, 'measure');
  assert.deepEqual(p.dims, [28, 28, 28]);
  assert.equal(p.paren, '29 x 25');
  p = C.parseLine('Mid ascending aorta:26');
  assert.equal(p.kind, 'measure');
  assert.deepEqual(p.dims, [26]);
  p = C.parseLine('Sinotubular junction: 40 x 38 mm');
  assert.equal(p.unit, 'mm');
  assert.equal(p.valueNorm, '40 x 38');
  p = C.parseLine('Mid ascending aorta: 4.6 cm');
  assert.equal(p.unit, 'cm');
  assert.deepEqual(p.dims, [4.6]);
  p = C.parseLine('Mid ascending aorta: 44, unchanged compared with February 17, 2025');
  assert.equal(p.rest, ', unchanged compared with February 17, 2025');
  p = C.parseLine('Sinus of Valsalva: Status post aortic valve replacement.');
  assert.equal(p.kind, 'text');
  assert.equal(p.key, 'sinus');
  assert.equal(C.parseLine('The cross-sectional diameters of the aorta are in mm as follows (prior values in parentheses):').kind, 'header');
  assert.equal(C.parseLine('').kind, 'blank');
});

for (const id of ['pair1', 'C', 'D', 'A', 'B', 'E', 'F', 'G']) {
  test(`example ${id} produces expected output`, () => {
    const e = ex(id);
    const res = C.merge({ current: e.current, prior: e.prior, priorStudy: '' });
    assert.equal(res.text, e.expected);
  });
}

test('CRLF input parses the same as LF', () => {
  const e = ex('D');
  const res = C.merge({ current: e.current.replace(/\n/g, '\r\n'), prior: e.prior.replace(/\n/g, '\r\n') });
  assert.equal(res.text, e.expected);
});

test('flags: 3 mm red, <3 green, no prior amber, left as dictated amber', () => {
  const d = C.merge({ current: ex('D').current, prior: ex('D').prior });
  assert.equal(statusOf(d, 'Ascending proximal'), 'red'); // 33 vs 28
  assert.equal(statusOf(d, 'Mid descending'), 'green'); // 22 vs 21
  assert.equal(statusOf(d, 'Suprarenal'), 'amber');
  const a = C.merge({ current: ex('A').current, prior: ex('A').prior });
  assert.equal(statusOf(a, 'Aorta at the diaphragm'), 'red'); // 28 vs 25 = 3
  assert.equal(statusOf(a, 'Mid ascending'), 'amber');
  assert.equal(statusOf(a, 'Mid descending'), 'green'); // 29 vs 28x27, max 28
  assert.ok(d.summary.red >= 1);
});

test('cm units are red', () => {
  const r = C.merge({ current: 'Mid ascending aorta: 46', prior: 'Mid ascending aorta: 4.5 cm' });
  assert.equal(r.lines[0].status, 'red');
  assert.equal(r.text, 'Mid ascending aorta: 46 (4.5 cm)');
});

test('duplicate prior landmark is red, first used', () => {
  const r = C.merge({ current: 'Aortic arch: 30', prior: 'Aortic arch: 29\nTop of the aortic arch proximal to left subclavian: 28' });
  assert.equal(r.text, 'Aortic arch: 30 (29)');
  assert.equal(r.lines[0].status, 'red');
});

test('deleted sinus: prior sinus listed as unused, not attached elsewhere', () => {
  const prior = 'Aortic root at the sinus: 39 x 38 x 36 mm\nSinotubular junction: 40';
  const r = C.merge({ current: 'Sinotubular junction: 41', prior });
  assert.equal(r.text, 'Sinotubular junction: 41 (40)');
  assert.deepEqual(r.unused, ['Aortic root at the sinus']);
});

test('prior study rewrites header', () => {
  const r = C.merge({ current: ex('D').current, prior: ex('D').prior, priorStudy: 'CTA 08/16/2024' });
  assert.equal(r.lines[0].text, 'The cross-sectional diameters of the aorta are in mm as follows (prior values from CTA 08/16/2024 in parentheses):');
  const r2 = C.merge({ current: 'The cross-sectional diameters of the aorta are in mm as follows:', prior: '', priorStudy: 'CTA 1/1/2020' });
  assert.equal(r2.text, 'The cross-sectional diameters of the aorta are in mm as follows (prior values from CTA 1/1/2020 in parentheses):');
});

test('prior pasted inside surrounding report text', () => {
  const prior = 'FINDINGS:\nHeart: Normal size.\nMid ascending aorta: 45\nIMPRESSION: Stable.';
  const r = C.merge({ current: 'Mid ascending aorta: 46', prior });
  assert.equal(r.text, 'Mid ascending aorta: 46 (45)');
  assert.deepEqual(r.unused, []);
});

test('empty inputs do not throw', () => {
  assert.equal(C.merge({ current: '', prior: '' }).text, '');
  assert.equal(C.merge({ current: 'Mid ascending aorta: 40', prior: '' }).lines[0].status, 'amber');
});

test('fallback match is amber', () => {
  const r = C.merge({ current: 'Descending thoracic aorta mid portion: 25', prior: 'Mid descending thoracic aorta: 24' });
  assert.equal(r.text, 'Descending thoracic aorta mid portion: 25 (24)');
});

test('numbers-only uses prior labels, keeps notes, skips with -', () => {
  const prior = ex('D').prior;
  const r = C.buildFromNumbers('27x27x27 28 29 33 27 26 22 20', prior);
  assert.equal(r.error, null);
  const lines = r.text.split('\n');
  assert.equal(lines[0], 'The cross-sectional diameters of the aorta are in mm as follows (prior values in parentheses):');
  assert.equal(lines[2], 'Sinus of Valsalva (mechanical): 27 x 27 x 27');
  assert.equal(lines[3], 'Sinotubular junction (graft): 28');
  const skip = C.buildFromNumbers('- 28 29 33 27 26 22 20', prior);
  assert.ok(!skip.text.includes('Sinus'));
  assert.equal(skip.error, null);
});

test('numbers-only carries text-only prior lines without using a number', () => {
  const r = C.buildFromNumbers('30 30 36 31 29 24 22', ex('pair1').prior);
  assert.equal(r.error, null);
  assert.equal(r.text.split('\n')[0], 'Sinus of Valsalva: Status post aortic valve replacement.');
});

test('numbers-only with empty prior uses 10-line template', () => {
  const r = C.buildFromNumbers('28 x 27 x 25, 27, 29, 25, 22, 21, 19, 20, 17, 13', '');
  assert.equal(r.error, null);
  assert.equal(r.text, ex('E').current);
});

test('numbers-only count mismatch errors', () => {
  const r = C.buildFromNumbers('1 2 3', '');
  assert.match(r.error, /Expected 10 numbers, got 3/);
});

test('PIN check', () => {
  assert.equal(C.checkPin('147258'), true);
  assert.equal(C.checkPin('000000'), false);
});
