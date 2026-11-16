import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, startPositions } from '../src/sim/mapgen.js';
import { Rng } from '../src/core/rng.js';
import { G } from '../src/data/terrain.js';

test('three starts have equal pair distances within tile rounding',()=>{
 for(const [w,h] of [[48,48],[64,64],[96,96],[128,64],[64,96]]) for(let seed=1;seed<=8;seed++) {
  const s=startPositions(w,h,3,new Rng(seed));
  const ds=s.map((p,i)=>Math.hypot(p.x-s[(i+1)%3].x,p.y-s[(i+1)%3].y));
  assert.ok(Math.max(...ds)-Math.min(...ds)<=1.5,`${w}x${h} seed ${seed}: ${ds}`);
  assert.ok(s.every(p=>p.x>=6&&p.y>=6&&p.x<w-6&&p.y<h-6));
  const radii=s.map(p=>Math.hypot(p.x-(w-1)/2,p.y-(h-1)/2));
  assert.ok(Math.max(...radii)-Math.min(...radii)<=1.5,'equal access to map centre');
 }
});

test('two and four starts retain their original corners and random stream',()=>{
 for(const n of [2,4]) for(const size of [48,64,96]) for(let seed=1;seed<=8;seed++) {
  const actualRng=new Rng(seed), expectedRng=new Rng(seed);
  const m=Math.max(6,Math.min(10,Math.floor(size/5)));
  const corners=[[m,m],[size-1-m,size-1-m],[size-1-m,m],[m,size-1-m]];
  const order=expectedRng.chance(0.5)?[0,1,2,3]:[2,3,0,1];
  assert.deepEqual(startPositions(size,size,n,actualRng),order.slice(0,n).map(k=>({x:corners[k][0],y:corners[k][1]})));
  assert.equal(actualRng.next(),expectedRng.next());
 }
});

test('each three-house start retains its rock plateau and nearby spice',()=>{
 for(const size of [48,64,96]) for(let seed=1;seed<=8;seed++) {
  const {map,starts}=generateMap({w:size,h:size,players:3,seed});
  for(const s of starts) {
   for(let dy=-6;dy<=6;dy++) for(let dx=-6;dx<=6;dx++) assert.equal(map.ground[map.idx(s.x+dx,s.y+dy)],G.ROCK);
   assert.ok(map.spice.some((v,i)=>v>0&&Math.hypot(map.xOf(i)-s.x,map.yOf(i)-s.y)<=15),`spice near ${JSON.stringify(s)}`);
  }
 }
});
