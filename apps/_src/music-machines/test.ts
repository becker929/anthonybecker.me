import { writeFileSync } from 'node:fs';
import { parse, toId, nextRhythm, Rhythm, RuleId, onsets, writeMidi, parseMidi, buildZip, unzipStored, resize, euclid } from './src/rhythm';

const ok = (c: boolean, m: string) => {
  if (!c) throw new Error('FAIL ' + m);
  console.log('ok', m);
};
const cycle = (start: Rhythm, rule: RuleId) => {
  const seen = new Set<string>();
  let r = start;
  while (!seen.has(toId(r))) {
    seen.add(toId(r));
    r = nextRhythm(r, rule);
  }
  return { seen, closes: toId(r) === toId(start) };
};

// ids
ok(toId(parse('x...x...x...x...')!) === '16.8888', 'four on the floor id');
ok(toId(parse('x..x..x...x.x...')!) === '16.9228', 'son clave id');
for (const id of ['1.8', '5.a8', '13.fff8', '128.' + 'a5'.repeat(16), '7.00']) ok(toId(parse(id)!) === id, 'round trip ' + id);
ok(parse('5.a9') === null && parse('129.0') === null && parse('16.888') === null && parse('hello') === null, 'rejects bad ids');

// exhaustive rules
const z = (len: number): Rhythm => ({ len, v: 0n });
for (const rule of ['count', 'gray'] as RuleId[]) {
  const c = cycle(z(10), rule);
  ok(c.seen.size === 1024 && c.closes, `${rule} visits all 1024 patterns of 10 steps`);
}
{
  const c = cycle(parse('xxxx........')!, 'density');
  ok(c.seen.size === 495 && c.closes, 'density visits C(12,4)=495');
  let r = parse('x.x.x.......')!;
  ok(onsets(nextRhythm(r, 'density')) === 3, 'density keeps count');
}
{
  const counts: Record<number, number> = { 6: 14, 8: 36, 12: 352, 16: 4116 };
  for (const n of [6, 8, 12, 16]) {
    const c = cycle({ len: n, v: (1n << BigInt(n)) - 1n }, 'necklace');
    ok(c.seen.size === counts[n] && c.closes, `necklace count for ${n} steps = ${counts[n]}`);
    // no two visited are rotations of each other
    const canon = new Set<string>();
    for (const id of c.seen) {
      let r = parse(id)!;
      let best = r.v;
      for (let i = 0; i < n; i++) {
        r = nextRhythm(r, 'rotate');
        if (r.v < best) best = r.v;
      }
      canon.add(best.toString());
    }
    ok(canon.size === c.seen.size, `necklaces distinct under rotation (${n})`);
  }
  ok(toId(nextRhythm(parse('..x...x.')!, 'necklace')).length > 0, 'necklace from non-canonical input');
}
ok(cycle(parse('16.9228')!, 'rotate').seen.size === 16, 'rotate orbit');
ok(toId(euclid(3, 8)) === toId(parse('x..x..x.')!), 'euclid(3,8) is tresillo');
ok(cycle(z(16), 'euclid').seen.size === 17, 'euclid sweep 0..16');
ok(onsets(nextRhythm({ len: 128, v: 0n }, 'mutate')) === 1, 'mutate flips one');
ok(nextRhythm({ len: 128, v: 5n }, 'random').len === 128, 'random keeps length');
ok(toId(nextRhythm({ len: 128, v: (1n << 128n) - 1n }, 'count')) === '128.' + '0'.repeat(32), 'count wraps at 128 steps');
ok(toId(resize(parse('16.9228')!, 8)) === '8.92' && toId(resize(parse('8.92')!, 16)) === '16.9200', 'resize');

// midi + zip
import { emphasisMask } from './src/rhythm';
ok(toId({ len: 16, v: emphasisMask('back', 16) }) === '16.0808', 'backbeat map id');
ok(toId({ len: 20, v: emphasisMask('down', 20) }) === '20.80008', 'downbeat map over 20 steps');
ok(emphasisMask('none', 16) === 0n, 'none is empty');
for (const id of ['16.9228', '128.' + 'a5'.repeat(16), '7.00', '13.fff8', '16.0001']) {
  const r = parse(id)!;
  const z2 = buildZip([{ name: 'a.mid', data: writeMidi([{ r, mask: emphasisMask('beat', r.len) }], 120, 76, false, 't') }, { name: 'b.mid', data: new Uint8Array([1, 2, 3]) }]);
  ok(toId(parseMidi(unzipStored(z2)!)!) === id, 'midi+zip round trip ' + id);
}
{
  const r = parse('16.9228')!;
  const m = emphasisMask('back', 16);
  const map = parseMidi(writeMidi([{ r, mask: m }], 120, 76, true, 'm'))!;
  ok(toId(map) === '16.0808', 'emphasis map keeps empty steps');
  const h = [{ r, mask: m, tag: 'hearts=3' }, { r: parse('12.a50')!, mask: emphasisMask('down', 12), tag: 'hearts=0' }, { r: parse('8.ff')!, mask: 0n, tag: 'hearts=1' }];
  writeFileSync('/tmp/hist.mid', writeMidi(h, 108, 76, false, '3 rhythms'));
  writeFileSync('/tmp/map.mid', writeMidi(h, 108, 76, true, 'Emphasis map, 3 rhythms'));
  writeFileSync('/tmp/one.zip', buildZip([{ name: 'hist.mid', data: writeMidi(h, 108, 76, false, 'x') }, { name: 'map.mid', data: writeMidi(h, 108, 76, true, 'y') }, { name: 'h.txt', data: new TextEncoder().encode('\u2665\u2665') }]));
}
console.log('all passed');
