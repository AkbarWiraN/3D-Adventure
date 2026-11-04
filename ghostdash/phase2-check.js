var __ghostdashTest = (function () {
  function assert(ok, msg) { if (!ok) throw new Error('FAIL: ' + msg); }
  var source = require('fs').readFileSync(__dirname + '/game.js', 'utf8');
  assert(source.indexOf("state: 'BOOT'") >= 0, 'game source present');
  assert(source.includes('OrderSystem.update(dt)') && source.includes('ScoreSystem.deliver(customer.order, 1)'), 'order and delivery loop wired');
  assert(source.includes('Bag.hasOrder(customer.order.id)'), 'delivery uses order identity');
  assert(source.includes('CONFIG.wrongGive.successChance'), 'wrong-give odds configurable');
  assert(source.includes('if (this.rating < CONFIG.rating.fail) Game.finish(false)'), 'rating defeat threshold wired');
  assert(source.includes('FireflySystem.update(dt, Game.t)'), 'collectibles updated');
  assert(source.includes('Tutorial.onDelivered()') && source.includes('Tutorial.onPickup()'), 'tutorial interactions wired');
  assert(source.includes("Game.progress >= 1) Game.finish(true)"), 'dawn victory wired');
  return 'Phase 2 gameplay wiring checks passed';
})();
if (typeof module !== 'undefined') module.exports = __ghostdashTest;
if (typeof window !== 'undefined') window.__ghostdashTest = __ghostdashTest;
