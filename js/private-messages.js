(() => {
  const client=window.NERO_SUPABASE,$=s=>document.querySelector(s);
  const list=$('#nero-dm-conversations'),empty=$('#nero-dm-empty'),active=$('#nero-dm-active'),head=$('#nero-dm-chat-head'),messageList=$('#nero-dm-message-list'),form=$('#nero-dm-form'),input=$('#nero-dm-input'),newButton=$('#nero-dm-new');
  if(!client||!list||!form)return;
  let user=window.NERO_AUTH?.user||null,activeConversation=null,activeOther=null,realtime=null,profileCache=new Map(),conversations=[],refreshPending=false;
  const shortTime=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''};
  const fullTime=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString():''};
  const profileName=p=>p?.display_name||('@'+(p?.username||'member'));
  function avatar(p){const el=document.createElement('span');el.className='nero-dm-avatar';if(p?.avatar_path)el.style.backgroundImage='url('+client.storage.from('profile-avatars').getPublicUrl(p.avatar_path).data.publicUrl+')';else el.textContent=(p?.display_name||p?.username||'?').slice(0,1).toUpperCase();return el}
  function showMessagesView(){document.querySelector('nav button[data-v="chat"]')?.click()}
  function notice(message){messageList.replaceChildren();const p=document.createElement('p');p.className='nero-dm-muted nero-dm-center';p.textContent=message;messageList.append(p)}
  async function loadProfiles(){const {data,error}=await client.from('profiles').select('id,username,display_name,avatar_path').order('username');if(error)throw error;profileCache=new Map((data||[]).map(p=>[p.id,p]))}
  async function ensureConversation(otherId){
    if(!user?.id||!otherId||otherId===user.id)throw new Error('Choose another NERO member.');
    const pair=[String(user.id),String(otherId)].sort();
    const findExisting=()=>client.from('dm_conversations').select('id,user_one,user_two,created_at').eq('user_one',pair[0]).eq('user_two',pair[1]).maybeSingle();
    const existing=await findExisting();
    if(existing.error)throw existing.error;
    if(existing.data)return existing.data;
    const made=await client.from('dm_conversations').insert({user_one:pair[0],user_two:pair[1],created_by:user.id}).select('id,user_one,user_two,created_at').single();
    if(!made.error&&made.data)return made.data;
    // Another tab or participant may create the same pair between the lookup and insert.
    if(made.error?.code!=='23505'&&made.status!==409)throw made.error;
    const raced=await findExisting();
    if(raced.error)throw raced.error;
    if(raced.data)return raced.data;
    throw made.error||new Error('Could not create this conversation.');
  }
  function renderConversationList(latest){
    list.replaceChildren();
    if(!conversations.length){const p=document.createElement('p');p.className='nero-dm-muted';p.textContent='No private conversations yet. Start one with a member.';list.append(p);return}
    conversations.forEach(c=>{
      const otherId=c.user_one===user.id?c.user_two:c.user_one,p=profileCache.get(otherId)||{username:'member'},last=latest.get(c.id);
      const b=document.createElement('button');b.type='button';b.className='nero-dm-conversation'+(activeConversation?.id===c.id?' active':'');b.addEventListener('click',()=>openConversation(otherId));
      b.append(avatar(p));const detail=document.createElement('span');detail.className='nero-dm-conversation-detail';
      const name=document.createElement('strong');name.textContent=profileName(p);
      const preview=document.createElement('small');preview.textContent=last?((last.sender_id===user.id?'You: ':'')+last.content):'Start a conversation';
      const time=document.createElement('time');time.textContent=last?shortTime(last.created_at):'';time.title=last?fullTime(last.created_at):'';
      detail.append(name,preview);b.append(detail,time);list.append(b);
    });
  }
  async function loadConversations(){
    if(!user?.id){list.replaceChildren();const p=document.createElement('p');p.className='nero-dm-muted';p.textContent='Sign in to use direct messages.';list.append(p);return}
    const {data,error}=await client.from('dm_conversations').select('id,user_one,user_two,created_at');if(error)throw error;conversations=data||[];
    if(!conversations.length){renderConversationList(new Map());return}
    const ids=conversations.map(c=>c.id),r=await client.from('dm_messages').select('id,conversation_id,sender_id,content,created_at').in('conversation_id',ids).order('created_at',{ascending:false}).limit(500);if(r.error)throw r.error;
    const latest=new Map();(r.data||[]).forEach(m=>{if(!latest.has(m.conversation_id))latest.set(m.conversation_id,m)});
    conversations.sort((a,b)=>Date.parse(latest.get(b.id)?.created_at||b.created_at)-Date.parse(latest.get(a.id)?.created_at||a.created_at));
    renderConversationList(latest);
  }
  function renderMessage(m){
    const own=m.sender_id===user.id,row=document.createElement('article');row.className='nero-dm-message'+(own?' own':'');row.dataset.messageId=String(m.id);
    const bubble=document.createElement('div');bubble.className='nero-dm-bubble';const text=document.createElement('p');text.textContent=String(m.content||'');bubble.append(text);
    const meta=document.createElement('div');meta.className='nero-dm-message-meta';const time=document.createElement('time');time.textContent=shortTime(m.created_at)+(m.edited_at?' · edited':'');time.title=fullTime(m.created_at);meta.append(time);
    if(own){
      const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.addEventListener('click',async()=>{const next=prompt('Edit your message:',m.content);if(next===null)return;const content=next.trim();if(!content||content.length>2000)return;const {error}=await client.from('dm_messages').update({content,edited_at:new Date().toISOString()}).eq('id',m.id);if(error)alert(error.message);else await loadMessages()});
      const del=document.createElement('button');del.type='button';del.textContent='Delete';del.addEventListener('click',async()=>{if(!confirm('Delete this message?'))return;const {error}=await client.from('dm_messages').delete().eq('id',m.id);if(error)alert(error.message);else await loadMessages()});meta.append(edit,del);
    }
    bubble.append(meta);row.append(bubble);messageList.append(row);
  }
  async function loadMessages(){
    if(!activeConversation||!user?.id)return;messageList.replaceChildren();
    const {data,error}=await client.from('dm_messages').select('id,conversation_id,sender_id,content,created_at,edited_at').eq('conversation_id',activeConversation.id).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(150);
    if(error){notice(error.message);return}if(!data?.length){notice('This is the beginning of your conversation. Say hello!');return}
    data.forEach(renderMessage);messageList.scrollTop=messageList.scrollHeight;
  }
  function updateHeader(){
    head.replaceChildren();if(!activeOther)return;head.append(avatar(activeOther));
    const info=document.createElement('span');info.className='nero-dm-header-info';const name=document.createElement('strong');name.textContent=profileName(activeOther);
    const handle=document.createElement('small');handle.textContent='@'+(activeOther.username||'member');info.append(name,handle);head.append(info);
  }
  async function openConversation(otherId){
    if(!user?.id){window.NERO_ACCOUNT?.open();return}if(!profileCache.size)await loadProfiles();
    activeOther=profileCache.get(otherId);if(!activeOther)throw new Error('That member could not be found.');activeConversation=null;
    showMessagesView();empty.hidden=true;active.hidden=false;input.disabled=false;updateHeader();notice('Loading messages…');
    try{activeConversation=await ensureConversation(otherId);await Promise.all([loadMessages(),loadConversations()]);input.focus()}catch(e){notice(e.message||'Could not open this conversation.')}
  }
  async function openNewMessage(){
    if(!user?.id){window.NERO_ACCOUNT?.open();return}try{if(!profileCache.size)await loadProfiles()}catch(e){alert(e.message);return}
    const overlay=document.createElement('div');overlay.className='nero-dm-search-overlay';const dialog=document.createElement('section');dialog.className='nero-dm-search-dialog';
    const title=document.createElement('div');title.className='nero-dm-search-title';const heading=document.createElement('strong');heading.textContent='New direct message';
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close');close.addEventListener('click',()=>overlay.remove());title.append(heading,close);
    const search=document.createElement('input');search.type='search';search.placeholder='Find a member by username…';search.maxLength=24;search.autocomplete='off';
    const results=document.createElement('div');results.className='nero-dm-search-results';
    function draw(){
      results.replaceChildren();const q=search.value.trim().toLowerCase(),matches=[...profileCache.values()].filter(p=>p.id!==user.id&&(!q||p.username.toLowerCase().includes(q)||(p.display_name||'').toLowerCase().includes(q))).slice(0,30);
      if(!matches.length){const p=document.createElement('p');p.className='nero-dm-muted';p.textContent='No members found.';results.append(p)}
      matches.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='nero-dm-search-result';b.append(avatar(p));const label=document.createElement('span');label.textContent=profileName(p)+' · @'+p.username;b.append(label);b.addEventListener('click',async()=>{overlay.remove();try{await openConversation(p.id)}catch(e){alert(e.message)}});results.append(b)});
    }
    search.addEventListener('input',draw);dialog.append(title,search,results);overlay.append(dialog);overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.append(overlay);draw();search.focus();
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();const content=input.value.trim();if(!content||content.length>2000||!activeConversation||!user?.id)return;
    const send=form.querySelector('button[type="submit"]');send.disabled=true;input.disabled=true;
    try{const {error}=await client.from('dm_messages').insert({conversation_id:activeConversation.id,sender_id:user.id,content});if(error)throw error;input.value='';await Promise.all([loadMessages(),loadConversations()])}
    catch(error){alert(error.message||'Message could not be sent.')}finally{send.disabled=false;input.disabled=false;input.focus()}
  });
  newButton?.addEventListener('click',openNewMessage);
  window.addEventListener('nero:open-dm',e=>{if(e.detail?.id)openConversation(e.detail.id).catch(err=>alert(err.message))});
  function stopRealtime(){if(realtime)client.removeChannel(realtime);realtime=null}
  function startRealtime(){
    stopRealtime();if(!user?.id)return;realtime=client.channel('nero-private-messages-'+user.id);
    realtime.on('postgres_changes',{event:'*',schema:'public',table:'dm_messages'},async payload=>{
      const id=payload.new?.conversation_id||payload.old?.conversation_id;if(activeConversation?.id===id)await loadMessages();
      if(!refreshPending){refreshPending=true;setTimeout(async()=>{refreshPending=false;try{await loadConversations()}catch(e){console.warn('NERO DMs:',e.message)}},180)}
    });
    realtime.subscribe((state,error)=>{if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')console.warn('NERO DM realtime:',error?.message||state)});
  }
  async function refresh(){
    user=window.NERO_AUTH?.user||null;activeConversation=null;activeOther=null;active.hidden=true;empty.hidden=false;
    if(!user?.id){stopRealtime();conversations=[];profileCache.clear();await loadConversations();return}
    try{await loadProfiles();await loadConversations();startRealtime()}catch(e){list.replaceChildren();const p=document.createElement('p');p.className='nero-dm-muted';p.textContent=e.message||'Could not load direct messages.';list.append(p)}
  }
  window.addEventListener('nero:auth-change',refresh);if(user?.id)refresh();
})();