(() => {
  const $ = s => document.querySelector(s);
  const cfg = window.NERO_CONFIG || {};
  const status = $('#global-chat-status'), joinPanel = $('#global-chat-join'), room = $('#global-chat-room');
  const nameInput = $('#global-chat-name'), messages = $('#global-chat-messages'), form = $('#global-chat-form'), input = $('#global-chat-input');
  const fileInput = $('#global-chat-file'), attachButton = $('#global-chat-attach'), usersList = $('#global-chat-users');
  const USER_KEY='nero.globalChat.username.v1', GUEST_KEY='nero.globalChat.guestId.v1';
  const seen = new Set(), online = new Map();
  let client, channel, joined = false, currentName = '', guestId = localStorage.getItem(GUEST_KEY);
  if (!guestId) { guestId = crypto.randomUUID ? crypto.randomUUID() : 'guest-' + Math.random().toString(36).slice(2); localStorage.setItem(GUEST_KEY, guestId); }
  nameInput.value = localStorage.getItem(USER_KEY) || '';
  const handle = name => String(name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0,24);
  function setStatus(text, state) { status.textContent=text; status.dataset.state=state||'offline'; }
  function renderOnline() {
    usersList.replaceChildren();
    for (const [key, name] of online) { if (key === handle(currentName)) continue; const option=document.createElement('option'); option.value='@'+key; option.label=name; usersList.append(option); }
  }
  function rememberPresence() {
    online.clear();
    const state = channel?.presenceState() || {};
    for (const entries of Object.values(state)) for (const entry of entries) if (entry?.handle && entry?.username) online.set(entry.handle, entry.username);
    renderOnline();
  }
  function addMessage(m) {
    if (!m || !m.id || seen.has(String(m.id))) return;
    seen.add(String(m.id));
    messages.querySelector('.global-chat-empty')?.remove();
    const row=document.createElement('article'); row.className='global-chat-message'+(m.guest_id===guestId?' mine':'');
    const meta=document.createElement('div'); meta.className='global-chat-message-meta';
    const who=document.createElement('span'); who.className='global-chat-message-name'; who.textContent=m.username||'Guest';
    const time=document.createElement('time'), date=new Date(m.created_at); time.dateTime=date.toISOString(); time.textContent=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    meta.append(who,time); row.append(meta);
    if (m.image_path) { const img=document.createElement('img'); img.className='global-chat-image'; img.src=client.storage.from('chat-images').getPublicUrl(m.image_path).data.publicUrl; img.alt='Image shared by '+(m.username||'a guest'); img.loading='lazy'; img.addEventListener('click',()=>window.open(img.src,'_blank','noopener')); row.append(img); }
    if (m.content) {
      const body=document.createElement('div'); body.className='global-chat-message-body'; const re=/@([a-z0-9_-]{1,24})/gi; let last=0,match;
      while ((match=re.exec(m.content))) { body.append(document.createTextNode(m.content.slice(last,match.index))); const span=document.createElement('span'); span.className='global-chat-mention'; span.textContent=match[0]; if(match[1].toLowerCase()===handle(currentName))span.classList.add('self'); body.append(span); last=re.lastIndex; }
      body.append(document.createTextNode(m.content.slice(last))); row.append(body);
    }
    messages.append(row); while(messages.children.length>120)messages.firstElementChild.remove(); messages.scrollTop=messages.scrollHeight;
  }
  async function loadHistory() {
    const {data,error}=await client.from('chat_messages').select('id,guest_id,username,content,image_path,created_at').order('id',{ascending:false}).limit(80);
    if(error)throw error; (data||[]).reverse().forEach(addMessage);
    if(!messages.children.length){const p=document.createElement('p');p.className='global-chat-empty';p.textContent='No messages yet. Start the conversation!';messages.append(p);}
  }
  async function connect(username) {
    if(!window.supabase?.createClient){setStatus('Chat library failed to load. Refresh and try again.','error');return;}
    if(!cfg.supabaseUrl||!cfg.supabaseKey){setStatus('Supabase is not configured.','error');return;}
    if(channel){await client.removeChannel(channel);channel=null;}
    joined=false;currentName=username;setStatus('Connecting…','pending');
    client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
    channel=client.channel('nero-global-chat',{config:{presence:{key:guestId}}});
    channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},payload=>addMessage(payload.new));
    channel.on('presence',{event:'sync'},rememberPresence);
    channel.on('broadcast',{event:'mention'},({payload})=>{if(payload?.to===handle(currentName)){setStatus(payload.from+' mentioned you','connected');status.classList.add('mentioned');}});
    channel.subscribe(async state=>{
      if(state==='SUBSCRIBED'){
        joined=true;joinPanel.hidden=true;room.hidden=false;setStatus('Connected as '+username,'connected');
        await channel.track({username,handle:handle(username),guestId});
        try{await loadHistory();}catch(e){setStatus('Could not load messages: '+e.message,'error');}
      } else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){joined=false;setStatus('Chat connection failed. Check Supabase Realtime settings.','error');}
    });
  }
  $('#global-chat-join-btn').addEventListener('click',()=>{
    const username=nameInput.value.trim().replace(/\s+/g,' ');
    if(!username||username.length>24){setStatus('Enter a name (1–24 characters)','error');nameInput.focus();return;}
    if(/[\u0000-\u001f\u007f]/.test(username)){setStatus('That name contains unsupported characters','error');return;}
    localStorage.setItem(USER_KEY,username);messages.replaceChildren();seen.clear();connect(username);
  });
  nameInput.addEventListener('keydown',e=>{if(e.key==='Enter')$('#global-chat-join-btn').click();});
  form.addEventListener('submit',async e=>{
    e.preventDefault();const content=input.value.trim();if(!content||!joined)return;
    input.disabled=true;
    try{
      const {error}=await client.from('chat_messages').insert({guest_id:guestId,username:currentName,content});
      if(error)throw error;
      const targets=new Set(Array.from(content.matchAll(/@([a-z0-9_-]{1,24})/gi),m=>m[1].toLowerCase()));
      for(const target of targets)await channel.send({type:'broadcast',event:'mention',payload:{to:target,from:currentName}});
      input.value='';
    }catch(err){setStatus(err.message||'Message could not be sent','error');}
    finally{input.disabled=false;input.focus();}
  });
  attachButton.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];fileInput.value='';if(!file)return;
    if(!joined){setStatus('Join chat before sharing an image','error');return;}
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){setStatus('Use a JPG, PNG, WEBP, or GIF image','error');return;}
    if(file.size>2*1024*1024){setStatus('Images must be 2 MB or smaller','error');return;}
    attachButton.disabled=true;setStatus('Uploading image…','pending');
    try{
      const path=guestId+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const {error:uploadError}=await client.storage.from('chat-images').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const {error}=await client.from('chat_messages').insert({guest_id:guestId,username:currentName,content:'',image_path:path});
      if(error)throw error;setStatus('Image sent','connected');
    }catch(err){setStatus(err.message||'Image upload failed','error');}
    finally{attachButton.disabled=false;}
  });
  input.addEventListener('input',()=>{
    if(input.value.includes('@')){const match=input.value.match(/@([a-z0-9_-]*)$/i);if(match){renderOnline();}}
  });
  document.querySelector('nav button[data-v="chat"]')?.addEventListener('click',()=>{if(!joined)nameInput.focus();});
  window.addEventListener('beforeunload',()=>{if(channel)client.removeChannel(channel);});
})();
