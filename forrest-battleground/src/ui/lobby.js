import { CONFIG } from '../config.js';
import { api, setToken, clearToken, getUser, getToken } from '../network/rest.js';

const $ = (id) => document.getElementById(id);
export class Lobby {
  constructor() {
    this.status=$('auth-status');this.data=$('lobby-data');this.username=$('auth-username');this.password=$('auth-password');this.character=$('auth-character');
    $('btn-register')?.addEventListener('click',()=>this.auth('register'));
    $('btn-login')?.addEventListener('click',()=>this.auth('login'));
    $('btn-logout')?.addEventListener('click',()=>this.logout());
    this.character?.addEventListener('change',async()=>{if(!getUser())return;try{await api.updateMe(this.character.value);this.currentCharacter=this.character.value;}catch(e){this.status.textContent=e.message;}});
    this.timer=0;
  }
  async auth(mode){
    this.status.textContent='Menghubungkan…';
    const base=(CONFIG.backendBase||'').trim(); if(base && !confirm(`Mengirim kredensial ke server kustom ${base}. Lanjutkan hanya jika dipercaya.`))return;
    try{const r=await api[mode](this.username.value,this.password.value,this.character.value);setToken(r.data.token,r.data.user);this.currentCharacter=r.data.user.character;this.password.value='';this.status.textContent=`Masuk sebagai ${r.data.user.username||r.data.user.username_display||'akun'}`;$('btn-logout')?.classList.remove('hidden');$('btn-register')?.classList.add('hidden');$('btn-login')?.classList.add('hidden');this._syncOnlineButton();await this.refresh();clearInterval(this.timer);this.timer=setInterval(()=>this.refresh(),20000);}
    catch(e){this.status.textContent=e.message;}
  }
  // Fase 3: tombol Online hanya aktif bila ada token (auth-first WSS).
  _syncOnlineButton(){const b=$('btn-online');if(!b)return;const ok=Boolean(getToken()&&getUser());b.disabled=!ok;b.title=ok?'Masuk room forest (WSS otoritatif)':'Login dahulu untuk main online';}
  async refresh(){if(!getUser())return;try{const [profile,map,top,me]=await Promise.all([api.me(),api.mapStatus(),api.leaderboard(10),api.leaderboardMe()]);const user=profile.data.user;this.character.value=user.character;this.currentCharacter=user.character;this.data.replaceChildren();const line=(text)=>{const p=document.createElement('p');p.textContent=text;this.data.append(p);};line(`Forest Purba · pemain ${map.data.status.onlineCount}/${map.data.status.hardCap}`);line(`Peringkat: ${me.data.rank??'—'} · K/D ${me.data.kills??0}/${me.data.deaths??0}`);line('Leaderboard PvP');if(!top.data.entries.length)line('Belum ada data PvP.');for(const x of top.data.entries)line(`${x.rank}. ${x.username} — ${x.kills}/${x.deaths} (${x.kdr})`);}catch(e){this.status.textContent=`Lobi gagal dimuat: ${e.message}`;}}
  logout(){clearInterval(this.timer);this.timer=0;clearToken();this.data.textContent='';this.password.value='';this.status.textContent='Keluar. Main Solo tetap tersedia.';$('btn-logout')?.classList.add('hidden');$('btn-register')?.classList.remove('hidden');$('btn-login')?.classList.remove('hidden');this._syncOnlineButton();}
}
