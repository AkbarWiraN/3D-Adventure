import * as THREE from 'three';
import { getWorld } from '../shared/world.js';
import { terrainHeight } from '../shared/terrain.js';
import { on, emit } from '../core/bus.js';
import { WEAPONS, DAMAGE, takeLoot, weaponClass, canAttack } from './combatRules.js';

const PICKUP=2.5;
export class SoloCombat {
  constructor(session){this.s=session;this.items=[];this.bots=[];this.tracers=[];this.inventory=[null,null];this.slot=0;this.cooldown=0;this._off=[];this.root=new THREE.Group();session.scene.add(this.root);const world=getWorld(),spots=world.loot;spots.forEach((p,i)=>this.addLoot(p.x,p.z,['bow','sword','arrows'][i%3],p.id));const geo=new THREE.CapsuleGeometry(.38,1.0,3,6);for(let i=0;i<4;i++){const p=world.spawns[(i*11)%world.spawns.length],mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x785c36}));mesh.position.set(p.x+4,.9,p.z+3);this.root.add(mesh);this.bots.push({mesh,hp:100,alive:true,hitAt:0,home:mesh.position.clone(),state:'patrol',phase:i*1.7});}this._off=[on('input:attack',()=>this.attack()),on('input:interact',()=>this.pickup()),on('input:drop',()=>this.drop()),on('input:throw',()=>this.drop(true)),on('input:slot',i=>{this.slot=i;this.updateHud()}),on('input:aim',v=>this.aim(!!v))];this.updateHud();this.updatePrompt();}

  updatePrompt(){const p=this.s.player.position,item=this.items.filter(i=>i.active&&Math.hypot(i.x-p.x,i.z-p.z)<=PICKUP).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];this.s.hud.setPrompt(item?`Ambil ${item.type==='bow'?'Busur':item.type==='sword'?'Pedang':'Anak panah'}`:null);}
  addLoot(x,z,type,id){const colors={bow:0x9d642e,sword:0xc7cbd0,arrows:0xd6c48a},mesh=new THREE.Mesh(new THREE.BoxGeometry(.7,.16,.16),new THREE.MeshStandardMaterial({color:colors[type]||0xd6c48a}));mesh.position.set(x,terrainHeight(x,z)+.25,z);mesh.userData.lootId=id;this.root.add(mesh);this.items.push({id,type,x,z,mesh,active:true});}
  aim(on){this.s.cameraRig.setAiming(on);this.s.player.setAiming(on);this.s.hud.setCrosshair(on);}
  update(dt){this.cooldown=Math.max(0,this.cooldown-dt);for(const t of [...this.tracers]){t.life-=dt;t.line.material.opacity=Math.max(0,t.life/.18);if(t.life<=0){this.root.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();this.tracers.splice(this.tracers.indexOf(t),1);}}const p=this.s.player.position;for(const b of this.bots){if(!b.alive){if(Date.now()>=b.respawn){b.alive=true;b.hp=100;b.mesh.visible=true;b.mesh.position.copy(b.home);}continue;}b.mesh.position.y=terrainHeight(b.mesh.position.x,b.mesh.position.z)+0.9;const d=b.mesh.position.distanceTo(p);b.state=this.s.player.dead?'patrol':d<2?'attack':d<17?'chase':'patrol';if(b.state==='patrol'){b.mesh.position.x=b.home.x+Math.sin(performance.now()*.0006+b.phase)*2;b.mesh.position.z=b.home.z+Math.cos(performance.now()*.0006+b.phase)*2;}else{b.mesh.lookAt(p.x,b.mesh.position.y,p.z);if(d>1.6)b.mesh.position.lerp(new THREE.Vector3(p.x,b.mesh.position.y,p.z),Math.min(.25,dt*.35));if(d<1.7&&Date.now()-b.hitAt>1400){b.hitAt=Date.now();if(this.s.player.takeDamage(DAMAGE,Date.now())){this.s.hud.setHp(this.s.player.hp);this.s.hud.toast('Kamu terkena serangan');}if(this.s.player.dead)this.die();}}}this.updatePrompt();}
  pickup(){const p=this.s.player.position,item=this.items.filter(i=>i.active&&Math.hypot(i.x-p.x,i.z-p.z)<=PICKUP).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];if(!item)return this.s.hud.toast('Tidak ada loot di dekatmu');const result=takeLoot(this.inventory,item.type);if(!result.ok)return this.s.hud.toast(result.reason==='full'?'Inventori penuh · jatuhkan senjata dahulu':'Ambil busur terlebih dahulu');item.active=false;item.mesh.visible=false;if(!result.ammo)this.slot=result.slot;this.updateHud();this.s.hud.toast(result.ammo?'Anak panah +10':`${item.type==='bow'?'Busur':'Pedang'} diambil`);}
  attack(){
    if(this.cooldown>0||this.s.player.dead)return;
    const held=this.inventory[this.slot],weapon=weaponClass(held),rule=WEAPONS[weapon==='unarmed'?'fist':weapon];
    if(weapon==='bow'&&held.ammo<=0)return this.s.hud.toast('Anak panah habis');
    this.cooldown=rule.cooldown;if(weapon==='bow')held.ammo--;
    const origin=this.s.player.position.clone().add(new THREE.Vector3(0,1,0)),dir=new THREE.Vector3(...Object.values(this.s.cameraRig.aimDirection())),ray=new THREE.Raycaster(origin,dir,0,rule.range);this.root.updateMatrixWorld(true);this.s.structures.updateMatrixWorld(true);
    const bots=this.bots.filter(b=>b.alive),hits=ray.intersectObjects(bots.map(b=>b.mesh),false),hit=hits[0];
    const wall=ray.intersectObjects(this.s.structures.children,true)[0];
    const target=hit&&(!wall||wall.distance>=hit.distance)?bots.find(b=>b.mesh===hit.object):null;
    if(weapon==='bow'){
      const from=this.s.player.position.clone().add(new THREE.Vector3(0,1,0)),to=target?hit.point:from.clone().addScaledVector(dir,rule.range),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([from,to]),new THREE.LineBasicMaterial({color:target?0xffe08a:0xd8d2b5,transparent:true,opacity:1}));
      this.tracers.push({line,life:.18});this.root.add(line);
    }
    if(target){target.hp=Math.max(0,target.hp-DAMAGE);this.s.hud.toast('Kena!');if(!target.hp){target.alive=false;target.mesh.visible=false;target.respawn=Date.now()+8000;this.s.hud.addKillFeed('Bot dikalahkan');}}
    this.updateHud();
  }

  drop(throwing=false){const item=this.inventory[this.slot];if(!item)return;const p=this.s.player.position,y=this.s.player.yaw,d=throwing?WEAPONS.throw.range:1.2,x=p.x+Math.sin(y)*d,z=p.z+Math.cos(y)*d;this.addLoot(x,z,item.type,`drop-${crypto.randomUUID()}`);this.inventory[this.slot]=null;this.updateHud();if(throwing){const hit=this.bots.find(b=>b.alive&&Math.hypot(b.mesh.position.x-x,b.mesh.position.z-z)<1.2);if(hit){hit.hp=Math.max(0,hit.hp-DAMAGE);this.s.hud.toast('Lemparan kena!');if(!hit.hp){hit.alive=false;hit.mesh.visible=false;hit.respawn=Date.now()+8000;this.s.hud.addKillFeed('Bot dikalahkan');}}}this.s.hud.toast(throwing?'Senjata dilempar':'Senjata dijatuhkan');}
  die(){if(this.s._respawnAt)return;this.s.input.enable(false);this.s._respawnAt=Date.now()+3000;emit('input:death');}
  respawn(){if(!this.s.player.dead)return;this.s._spawn();this.s.player.hp=100;this.s.player.dead=false;this.s.player.invulnUntil=Date.now()+2000;this.inventory=[null,null];this.updateHud();this.s.input.enable(!this.s.paused);this.s.hud.show(true);document.getElementById('screen-death')?.classList.add('hidden');this.s.hud.toast('Respawn · HP 100');}
  updateHud(){const item=this.inventory[this.slot];this.s.hud.setWeapon(item?.type==='bow'?'Busur':item?.type==='sword'?'Pedang':'Tangan Kosong',item?.ammo??null);}
  dispose(){this._off.forEach(off=>off());this.s.scene.remove(this.root);this.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose()});this.tracers.length=0;}
}
