/* Teacher panel: watch every server's chat live, mute a
   student, hide a message, clear the room, and see who has finished what. */
const $=s=>document.querySelector(s);
let me=null, ws=null;

async function api(path, body){
  const r=await fetch('/api'+path,{method:body?'POST':'GET',
    headers:{'Content-Type':'application/json'},credentials:'same-origin',
    body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({ok:false,error:'Server did not answer'}));
  if(!r.ok||!j.ok) throw new Error(j.error||('Error '+r.status));
  return j;
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

$('#login').onclick=async()=>{
  try{ me=(await api('/login',{username:$('#u').value.trim(),password:$('#p').value})).user;
       if(me.role!=='teacher') throw new Error('That is a student account');
       start(); }catch(e){ $('#msg').textContent=e.message; }
};
$('#reg').onclick=async()=>{
  try{ me=(await api('/teacher/register',{teacherCode:$('#tc').value.trim(),
        username:$('#u2').value.trim(),password:$('#p2').value})).user; start(); }
  catch(e){ $('#msg').textContent=e.message; }
};
$('#out').onclick=async()=>{ await api('/logout',{}); location.reload(); };
$('#clear').onclick=async()=>{ if(confirm('Clear the chat in every server?')){ await api('/teacher/clear',{}); refresh(); } };
/* clearing one room at a time, from the server list */
window.clearRoom=async(id,name)=>{
  if(!confirm('Clear the chat in '+name+'?')) return;
  await api('/teacher/clear',{server:id}); refresh();
};

async function start(){
  $('#authCard').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#who').textContent='Signed in as '+me.display;
  await refresh();
  connect();
}
async function refresh(){
  const d=await api('/teacher/overview');
  $('#servers').innerHTML = (d.servers||[]).map(sv=>
    `<div class="row" style="margin:4px 0"><b>${esc(sv.em||'')} ${esc(sv.name)}</b>
      <span class="code">${sv.count} in room</span>
      <button class="ghost" onclick="clearRoom('${esc(sv.id)}','${esc(sv.name)}')">Clear chat</button>
     </div>`).join('') || '<p class="note">No servers configured.</p>';
  $('#students').innerHTML = d.students.map(s=>{
    const p=s.progress||{};
    const done=['m1','puzzles','m2','m3'].filter(k=>p[k]).join(', ')||'—';
    const muted = s.muted_until && new Date(s.muted_until)>new Date();
    return `<tr><td>${esc(s.display)}</td><td class="note">${esc(s.username)}</td>
      <td>${esc(done)}</td>
      <td><button class="${muted?'':'ghost'}" onclick="mute(${s.id},${muted?0:15})">
        ${muted?'Muted — unmute':'Mute 15 min'}</button></td></tr>`;
  }).join('') || '<tr><td colspan="4" class="note">No students have signed up yet.</td></tr>';
  $('#log').innerHTML = d.messages.map(m=>line(m)).join('');
  $('#log').scrollTop=$('#log').scrollHeight;
}
function line(m){
  // the room is worth showing: one log now carries every server at once
  const where = m.server ? `<span class="code">${esc(m.server)}</span> ` : '';
  return `<div class="msg ${m.hidden?'hidden-msg':''}" data-id="${m.id}">
    <div>${where}<b>${esc(m.display)}</b> ${esc(m.text)}</div>
    <div><small>${new Date(m.created_at).toLocaleTimeString()}</small>
      ${m.hidden?'':`<button class="ghost" onclick="hide(${m.id})">Hide</button>`}</div></div>`;
}
window.mute=async(id,mins)=>{ await api('/teacher/mute',{userId:id,minutes:mins}); refresh(); };
window.hide=async(id)=>{ await api('/teacher/hide',{id}); refresh(); };

/* live feed: the teacher joins the same socket and simply listens */
function connect(){
  const proto=location.protocol==='https:'?'wss':'ws';
  ws=new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage=e=>{
    let m; try{ m=JSON.parse(e.data); }catch(err){ return; }
    if(m.t==='chat'){
      $('#log').insertAdjacentHTML('beforeend',
        line({id:m.id,display:m.from,text:m.text,created_at:new Date().toISOString()}));
      $('#log').scrollTop=$('#log').scrollHeight;
    }
    if(m.t==='clear'||m.t==='unsay') refresh();
  };
  ws.onclose=()=>setTimeout(connect,4000);
}
(async()=>{ try{ me=(await api('/me')).user; if(me.role==='teacher') start(); }catch(e){} })();
