export const DAMAGE=20;
export const WEAPONS=Object.freeze({fist:{range:1.6,cooldown:.8},sword:{range:3,cooldown:.8},bow:{range:10,cooldown:1.4},throw:{range:8,cooldown:1}});
export const weaponClass=(item)=>!item?'unarmed':item.type==='arrows'?'arrowAmmo':item.type;
export const hitDamage=(hp,damage=DAMAGE)=>Math.max(0,hp-damage);

/** Gerbang serangan murni (tanpa THREE) supaya bisa diuji: cooldown, mati, amunisi. */
export function canAttack({weapon='unarmed',cooldown=0,dead=false,ammo=0}={}){
  if(dead)return {ok:false,reason:'dead'};
  if(cooldown>0)return {ok:false,reason:'cooldown'};
  if(weapon==='bow'&&ammo<=0)return {ok:false,reason:'no-ammo'};
  return {ok:true,reason:null};
}

/** Cek jarak terhadap range senjata (dipakai sama persis oleh klien & nanti server). */
export function inWeaponRange(weapon,dist){const r=WEAPONS[weapon==='unarmed'?'fist':weapon];return Boolean(r)&&dist<=r.range;}
export function takeLoot(inventory,type){if(type==='arrows'){const bow=inventory.find(x=>x?.type==='bow');if(!bow)return {ok:false,reason:'bow-required'};bow.ammo=Math.min(30,bow.ammo+10);return {ok:true,ammo:true};}const slot=inventory.findIndex(x=>!x);if(slot<0)return {ok:false,reason:'full'};inventory[slot]={type,ammo:type==='bow'?10:null};return {ok:true,slot};}

