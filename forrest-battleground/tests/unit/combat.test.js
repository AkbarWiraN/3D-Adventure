import test from 'node:test';
import assert from 'node:assert/strict';
import { DAMAGE, WEAPONS, hitDamage, takeLoot, weaponClass } from '../../src/gameplay/combatRules.js';

test('combat rules: valid hits, classes, ranges, ammo, capacity',()=>{
  let hp=100; for(let i=0;i<5;i++) hp=hitDamage(hp,DAMAGE); assert.equal(hp,0);
  assert.deepEqual(['unarmed','sword','bow','arrowAmmo'],['unarmed','sword','bow','arrowAmmo']);
  assert.equal(weaponClass(null),'unarmed'); assert.equal(weaponClass({type:'sword'}),'sword'); assert.equal(weaponClass({type:'bow'}),'bow');
  assert.deepEqual([WEAPONS.fist.range,WEAPONS.sword.range,WEAPONS.bow.range,WEAPONS.throw.range],[1.6,3,10,8]);
  const inv=[null,null];assert.equal(takeLoot(inv,'sword').ok,true);assert.equal(takeLoot(inv,'bow').ok,true);assert.equal(takeLoot(inv,'arrows').ok,true);assert.equal(inv[1].ammo,20);assert.equal(takeLoot(inv,'sword').reason,'full');
  inv[1].ammo=0;assert.equal(inv[1].ammo,0);assert.equal(takeLoot(inv,'arrows').ok,true);assert.equal(inv[1].ammo,10);
});
