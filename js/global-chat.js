(() => {
  const $ = s => document.querySelector(s), api = String(window.NERO_CONFIG?.chat || '').replace(/\/$/, '');
  const status=$('#global-chat-status'), joinPanel=$('#global-chat-join'), room=$('#global-chat-room');
  const nameInput=$('#global-chat-name'), messages=$('#global-chat-messages'), form=$('#global-chat-form'), input=$('#global-chat-input');
  const USER_KEY='nero.globalChat.username.v1', GUEST_KEY='nero.globalChat.guestId.v1', seen=new Set();
  let socket=null, joined=false, reconnectTimer=null;
  const guestId=(()=>{let id=localStorage.getItem(GUEST_KEY);if(!id){id=crypto.randomUUID?crypto.randomUUID():'guest-'+Math.random().toString(36).slice(2);localStorage.setItem(GUEST_KEY,id)}return id})();
  nameInput.value=localStorage.getItem(USER_KEY)||'';
  function setStatus(t,s){status.textContent=t;status.dataset.state=s||'offline'}
  function addMessage(m){
    if(!m||!m.id||seen.has(String(m.id)))return;seen.add(String(m.id));
    messages.querySelector('.global-chat-empty')?.remove();
    const row=document.createElement('article');row.className='global-chat-message'+(m.guestId===guestId?' mine':'');
    const meta=document.createElement('div');meta.className='global-chat-message-meta';
    const who=document.createElement('span');who.className='global-chat-message-name';who.textContent=m.username||'Guest';
    const time=document.createElement('time'),date=new Date(m.createdAt);time.dateTime=date.toISOString();time.textContent=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    meta.append(who,time);const body=document.createElement('div');body.className='global-chat-message-body';body.textContent=m.content||'';row.append(meta,body);messages.append(row);
    while(messages.children.length>120)messages.firstElementChild.remove();messages.scrollTop=messages.scrollHeight;
  }
  async function history(){const r=await fetch(api+'/messages?limit=80');if(!r.ok)throw Error('Could not load chat history');const d=await r.json();(d.messages||[]).forEach(addMessage);if(!messages.children.length){const p=document.createElement('p');p.className='global-chat-empty';p.textContent='No messages yet. Start the conversation!';messages.append(p)}}
  async function connect(username){
    clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.close()}joined=false;
    try{const check=await fetch(api+'/health',{cache:'no-store'});if(!check.ok)throw Error('Chat server is unavailable');const health=await check.json();if(!health.database){setStatus(health.databaseConfigured?'Database is starting — try again shortly':'Chat database is not connected. Add DATABASE_URL in Render.','error');return}}catch(e){setStatus(e.message||'Cannot reach chat server','error');return}
    socket=new WebSocket(api.replace(/^http/,'ws')+'/chat');setStatus('Connecting…','pending');
    socket.addEventListener('open',()=>{socket.send(JSON.stringify({type:'join',username,guestId}));history().catch(e=>setStatus(e.message,'error'))});
    socket.addEventListener('message',e=>{let d;try{d=JSON.parse(e.data)}catch{return}
      if(d.type==='ready'){joined=true;setStatus('Connected as '+username,'connected');joinPanel.hidden=true;room.hidden=false}
      else if(d.type==='message')addMessage(d.message);else if(d.type==='error')setStatus(d.message||'Chat error','error')});
    socket.addEventListener('close',()=>{const wasJoined=joined;joined=false;if(!wasJoined){setStatus('Could not connect. Check the chat server settings.','error');return}setStatus('Disconnected — reconnecting…','error');reconnectTimer=setTimeout(()=>{if(document.visibilityState!=='hidden')connect(username)},4000)});
    socket.addEventListener('error',()=>setStatus('Connection failed','error'));
  }
  $('#global-chat-join-btn').addEventListener('click',()=>{
    const username=nameInput.value.trim().replace(/\s+/g,' ');
    if(!username||username.length>24){setStatus('Enter a name (1–24 characters)','error');nameInput.focus();return}
    localStorage.setItem(USER_KEY,username);messages.replaceChildren();seen.clear();connect(username);
  });
  nameInput.addEventListener('keydown',e=>{if(e.key==='Enter')$('#global-chat-join-btn').click()});
  form.addEventListener('submit',e=>{e.preventDefault();const content=input.value.trim();if(!content||!joined||socket?.readyState!==WebSocket.OPEN)return;socket.send(JSON.stringify({type:'message',content}));input.value=''});
  document.querySelector('nav button[data-v="chat"]')?.addEventListener('click',()=>{if(!joined)nameInput.focus()});
  window.addEventListener('beforeunload',()=>socket?.close());
})();