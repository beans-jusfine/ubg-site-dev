(() => {
  const client=window.NERO_SUPABASE,$=s=>document.querySelector(s);
  const list=$('#nero-dm-conversations'),empty=$('#nero-dm-empty'),active=$('#nero-dm-active'),head=$('#nero-dm-chat-head'),messageList=$('#nero-dm-message-list'),form=$('#nero-dm-form'),input=$('#nero-dm-input'),newButton=$('#nero-dm-new');
  if(!client||!list||!form)return;
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.id='nero-dm-file';fileInput.hidden=true;fileInput.setAttribute('aria-label','Choose a file to send');
  const attachButton=document.createElement('button');attachButton.type='button';attachButton.className='ghost global-chat-attach';attachButton.textContent='＋';attachButton.title='Attach a file';attachButton.setAttribute('aria-label','Attach a file');
  const emojiButton=document.createElement('button');emojiButton.type='button';emojiButton.className='ghost global-chat-emoji';emojiButton.textContent='☺';emojiButton.title='Choose emoji';emojiButton.setAttribute('aria-label','Choose emoji');
  const gifButton=document.createElement('button');gifButton.type='button';gifButton.className='ghost global-chat-gif';gifButton.textContent='GIF';gifButton.title='Send a GIF';gifButton.setAttribute('aria-label','Choose a GIF');
  form.insertBefore(attachButton,input);form.insertBefore(gifButton,input);form.insertBefore(emojiButton,input);form.append(fileInput);
  let user=window.NERO_AUTH?.user||null,activeConversation=null,activeOther=null,realtime=null,profileCache=new Map(),conversations=[],hiddenConversationIds=new Set(),refreshPending=false;
  const shortTime=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''};
  const fullTime=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString():''};
  const emojiData=window.NERO_CHAT_EMOJI_DATA||{groups:[],aliases:{},names:{}};
  const emojiRecentKey=()=> 'nero.chat.emoji.recent.'+(user?.id||'guest');
  let emojiRecent=[];try{emojiRecent=JSON.parse(localStorage.getItem(emojiRecentKey())||'[]')}catch(e){}
  const emojiPicker=document.createElement('div');emojiPicker.className='global-chat-emoji-picker';emojiPicker.hidden=true;emojiPicker.innerHTML='<div class="global-chat-picker-top"><strong>Emoji</strong><input type="search" placeholder="Search emoji" aria-label="Search emoji"></div><div class="global-chat-emoji-cats"></div><div class="global-chat-emoji-grid"></div>';form.append(emojiPicker);
  const emojiSearch=emojiPicker.querySelector('input'),emojiCats=emojiPicker.querySelector('.global-chat-emoji-cats'),emojiGrid=emojiPicker.querySelector('.global-chat-emoji-grid');let emojiGroup=emojiRecent.length?-1:0;
  function rememberDmEmoji(value){emojiRecent=[value,...emojiRecent.filter(x=>x!==value)].slice(0,32);try{localStorage.setItem(emojiRecentKey(),JSON.stringify(emojiRecent))}catch(e){}}
  function insertDmEmoji(value){const a=input.selectionStart??input.value.length,z=input.selectionEnd??a;input.setRangeText(value,a,z,'end');input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));rememberDmEmoji(value);emojiPicker.hidden=true}
  function renderDmEmoji(){
    emojiCats.replaceChildren();const groups=[{name:'Recent',items:emojiRecent},...emojiData.groups];
    groups.forEach((group,i)=>{const b=document.createElement('button');b.type='button';b.textContent=group.name;b.className=(i===emojiGroup+1?'active':'');b.addEventListener('click',()=>{emojiGroup=i-1;emojiSearch.value='';renderDmEmoji()});emojiCats.append(b)});
    const q=emojiSearch.value.trim().toLowerCase().replace(/^:|:$/g,'');
    const source=emojiGroup<0?emojiRecent:(emojiData.groups[emojiGroup]?.items||[]);
    const all=[...new Set([...emojiRecent,...emojiData.groups.flatMap(g=>g.items)])];
    const items=q?all.filter(e=>e.toLowerCase().includes(q)||String(emojiData.names[e]||'').toLowerCase().includes(q)||Object.entries(emojiData.aliases).some(([alias,value])=>value===e&&alias.includes(q))):source;
    emojiGrid.replaceChildren();items.forEach(e=>{const b=document.createElement('button');b.type='button';b.textContent=e;b.title=emojiData.names[e]||e;b.setAttribute('aria-label','Insert '+b.title);b.addEventListener('click',()=>insertDmEmoji(e));emojiGrid.append(b)});
    if(!items.length){const p=document.createElement('span');p.className='global-chat-emoji-empty';p.textContent='No matching emoji';emojiGrid.append(p)}
  }
  emojiButton.addEventListener('click',()=>{gifPicker.hidden=true;emojiPicker.hidden=!emojiPicker.hidden;if(!emojiPicker.hidden){renderDmEmoji();emojiSearch.focus()}});
  emojiSearch.addEventListener('input',renderDmEmoji);
  const gifPicker=document.createElement('div');gifPicker.className='global-chat-gif-picker';gifPicker.hidden=true;gifPicker.innerHTML='<div class="global-chat-picker-top"><strong>GIFs</strong><input type="search" placeholder="Search KLIPY" aria-label="Search KLIPY GIFs"></div><div class="global-chat-gif-results"></div><div class="global-chat-klipy-credit">Powered by KLIPY</div>';form.append(gifPicker);
  const gifSearch=gifPicker.querySelector('input'),gifResults=gifPicker.querySelector('.global-chat-gif-results');let gifRequest=0,gifDebounce=null;
  const gifFavoriteKey=()=> 'nero.chat.gif.favorites.'+(user?.id||'guest');
  function readGifFavorites(){try{const x=JSON.parse(localStorage.getItem(gifFavoriteKey())||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
  function toggleGifFavorite(item,url){const favorites=readGifFavorites(),index=favorites.findIndex(x=>x.url===url);if(index>=0)favorites.splice(index,1);else favorites.unshift({url,slug:item.slug||'',title:item.title||'GIF'});try{localStorage.setItem(gifFavoriteKey(),JSON.stringify(favorites.slice(0,100)))}catch(e){}}
  function gifKey(){return window.NERO_CONFIG?.klipyApiKey||''}
  function isKlipyUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&/^static\d*\.klipy\.com$/i.test(u.hostname)}catch(e){return false}}
  function gifImageUrl(item){return item?.file?.hd?.gif?.url||item?.file?.md?.gif?.url||item?.file?.sm?.gif?.url||item?.file?.hd?.webp?.url||item?.file?.md?.webp?.url||item?.preview_url||item?.url||''}
  function gifItems(payload){const data=payload?.data;return Array.isArray(data?.data)?data.data:Array.isArray(data?.items)?data.items:Array.isArray(data)?data:[]}
  async function sendDmContent(content){if(!activeConversation||!user?.id)throw new Error('Open a conversation first.');const {error}=await client.from('dm_messages').insert({conversation_id:activeConversation.id,sender_id:user.id,content});if(error)throw error;await Promise.all([loadMessages(),loadConversations()])}
  async function sendDmGif(item,url){const safeUrl=String(url||'');if(!isKlipyUrl(safeUrl))return;const payload={url:safeUrl,slug:String(item.slug||''),title:String(item.title||'GIF').slice(0,120)};try{gifButton.disabled=true;await sendDmContent('NERO_GIF|'+JSON.stringify(payload));gifPicker.hidden=true;if(payload.slug&&gifKey())fetch('https://api.klipy.com/api/v1/'+encodeURIComponent(gifKey())+'/gifs/share/'+encodeURIComponent(payload.slug),{method:'POST'}).catch(()=>{})}catch(e){alert(e.message||'GIF could not be sent.')}finally{gifButton.disabled=false}}
  function renderGifFavorites(){gifResults.replaceChildren();const favorites=readGifFavorites();if(!favorites.length){gifResults.textContent='No saved GIFs yet.';return}favorites.forEach(item=>{const b=document.createElement('div');b.className='global-chat-gif-item';const img=document.createElement('img');img.src=item.url;img.alt=item.title||'GIF';const label=document.createElement('span');label.textContent=item.title||'GIF';b.append(img,label);b.addEventListener('click',()=>sendDmGif(item,item.url));gifResults.append(b)})}
  const gifFavoritesButton=document.createElement('button');gifFavoritesButton.type='button';gifFavoritesButton.className='global-chat-gif-favorites';gifFavoritesButton.textContent='★ Favorites';gifFavoritesButton.addEventListener('click',renderGifFavorites);gifPicker.querySelector('.global-chat-picker-top').append(gifFavoritesButton);
  async function loadDmGifs(query=''){const key=gifKey();if(!key){gifResults.textContent='KLIPY is not configured.';return}const id=++gifRequest;gifResults.textContent='Loading GIFs…';const endpoint=query?'search':'trending',params=new URLSearchParams({page:'1',per_page:'24',customer_id:String(user?.id||'nero'),locale:'en_US',content_filter:'high',format_filter:'gif,webp'});if(query)params.set('q',query);try{const response=await fetch('https://api.klipy.com/api/v1/'+encodeURIComponent(key)+'/gifs/'+endpoint+'?'+params.toString());if(!response.ok)throw new Error('KLIPY returned HTTP '+response.status);const payload=await response.json();if(id!==gifRequest)return;gifResults.replaceChildren();gifItems(payload).filter(x=>x?.type!=='ad').forEach(item=>{const url=gifImageUrl(item);if(!isKlipyUrl(url))return;const b=document.createElement('div');b.className='global-chat-gif-item';const img=document.createElement('img');img.src=url;img.alt=item.title||'GIF';img.loading='lazy';const label=document.createElement('span');label.textContent=item.title||'GIF';b.append(img,label);b.addEventListener('click',()=>sendDmGif(item,url));const star=document.createElement('button');star.type='button';star.className='global-chat-gif-star';star.textContent=readGifFavorites().some(x=>x.url===url)?'★':'☆';star.addEventListener('click',e=>{e.stopPropagation();toggleGifFavorite(item,url);star.textContent=readGifFavorites().some(x=>x.url===url)?'★':'☆'});b.append(star);gifResults.append(b)});if(!gifResults.children.length)gifResults.textContent='No GIFs found. Try another search.'}catch(e){if(id===gifRequest)gifResults.textContent=e.message||'Could not load GIFs.'}}
  gifButton.addEventListener('click',()=>{emojiPicker.hidden=true;gifPicker.hidden=!gifPicker.hidden;if(!gifPicker.hidden){gifSearch.focus();if(!gifResults.children.length)loadDmGifs(gifSearch.value.trim())}});
  gifSearch.addEventListener('input',()=>{if(gifDebounce)clearTimeout(gifDebounce);gifDebounce=setTimeout(()=>loadDmGifs(gifSearch.value.trim()),350)});
  document.addEventListener('pointerdown',e=>{if(!emojiPicker.contains(e.target)&&!emojiButton.contains(e.target))emojiPicker.hidden=true;if(!gifPicker.contains(e.target)&&!gifButton.contains(e.target))gifPicker.hidden=true});
  attachButton.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];fileInput.value='';if(!file)return;if(!activeConversation||!user?.id)return;if(file.size>10*1024*1024){alert('Files must be 10 MB or smaller.');return}const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-140)||'attachment';const path=activeConversation.id+'/'+user.id+'/'+crypto.randomUUID()+'-'+safeName;attachButton.disabled=true;try{const {error:uploadError}=await client.storage.from('dm-attachments').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(uploadError)throw uploadError;const payload={path,name:file.name.slice(0,160),type:file.type||'application/octet-stream',size:file.size};await sendDmContent('NERO_FILE|'+JSON.stringify(payload))}catch(e){alert(e.message||'File could not be sent.')}finally{attachButton.disabled=false}});
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
    if(!conversations.length){const p=document.createElement('p');p.className='nero-dm-muted';p.textContent='No direct messages yet. Search for a member to start or reopen a conversation.';list.append(p);return}
    conversations.forEach(c=>{
      const otherId=c.user_one===user.id?c.user_two:c.user_one,p=profileCache.get(otherId)||{username:'member'},last=latest.get(c.id);
      const row=document.createElement('div');row.className='nero-dm-conversation-row';
      const b=document.createElement('button');b.type='button';b.className='nero-dm-conversation'+(activeConversation?.id===c.id?' active':'');b.addEventListener('click',()=>openConversation(otherId));
      const detail=document.createElement('span');detail.className='nero-dm-conversation-detail';
      const name=document.createElement('strong');name.textContent=profileName(p);
      const preview=document.createElement('small');preview.textContent=last?((last.sender_id===user.id?'You: ':'')+messagePreview(last.content)):'Start a conversation';
      const time=document.createElement('time');time.textContent=last?shortTime(last.created_at):'';time.title=last?fullTime(last.created_at):'';
      detail.append(name,preview);b.append(avatar(p),detail,time);
      const hide=document.createElement('button');hide.type='button';hide.className='nero-dm-hide';hide.textContent='×';hide.title='Hide this direct message';hide.setAttribute('aria-label','Hide direct messages with '+(p.username||'this member'));
      const hideConversation=async e=>{e.preventDefault();e.stopPropagation();hide.disabled=true;try{const {error}=await client.from('dm_hidden_conversations').insert({user_id:user.id,conversation_id:c.id});if(error&&error.code!=='23505')throw error;hiddenConversationIds.add(c.id);conversations=conversations.filter(item=>item.id!==c.id);renderConversationList(latest)}catch(error){hide.disabled=false;alert(error.message||'Could not hide this conversation.')}};
      hide.addEventListener('click',hideConversation);
      row.append(b,hide);list.append(row);
    });
  }
  async function loadConversations(){
    if(!user?.id){list.replaceChildren();const p=document.createElement('p');p.className='nero-dm-muted';p.textContent='Sign in to use direct messages.';list.append(p);return}
    const [conversationResult,hiddenResult]=await Promise.all([
      client.from('dm_conversations').select('id,user_one,user_two,created_at'),
      client.from('dm_hidden_conversations').select('conversation_id').eq('user_id',user.id)
    ]);
    if(conversationResult.error)throw conversationResult.error;if(hiddenResult.error)throw hiddenResult.error;
    hiddenConversationIds=new Set((hiddenResult.data||[]).map(item=>item.conversation_id));
    conversations=(conversationResult.data||[]).filter(c=>!hiddenConversationIds.has(c.id));
    if(!conversations.length){renderConversationList(new Map());return}
    const ids=conversations.map(c=>c.id),r=await client.from('dm_messages').select('id,conversation_id,sender_id,content,created_at').in('conversation_id',ids).order('created_at',{ascending:false}).limit(500);if(r.error)throw r.error;
    const latest=new Map();(r.data||[]).forEach(m=>{if(!latest.has(m.conversation_id))latest.set(m.conversation_id,m)});
    conversations.sort((a,b)=>Date.parse(latest.get(b.id)?.created_at||b.created_at)-Date.parse(latest.get(a.id)?.created_at||a.created_at));
    renderConversationList(latest);
  }
  function parseDmPayload(content,prefix){if(!String(content||'').startsWith(prefix))return null;try{return JSON.parse(String(content).slice(prefix.length))}catch(e){return null}}
  function messagePreview(content){const gif=parseDmPayload(content,'NERO_GIF|');if(gif)return 'GIF';const file=parseDmPayload(content,'NERO_FILE|');if(file)return '📎 '+(file.name||'File');return String(content||'')}
  async function renderMessage(m){
    const own=m.sender_id===user.id,row=document.createElement('article');row.className='nero-dm-message'+(own?' own':'');row.dataset.messageId=String(m.id);
    const bubble=document.createElement('div');bubble.className='nero-dm-bubble';
    const gif=parseDmPayload(m.content,'NERO_GIF|'),file=parseDmPayload(m.content,'NERO_FILE|');
    if(gif&&isKlipyUrl(gif.url)){const img=document.createElement('img');img.className='nero-dm-media-image';img.src=gif.url;img.alt=gif.title||'GIF';img.loading='lazy';bubble.append(img)}
    else if(file&&typeof file.path==='string'&&file.path.startsWith(activeConversation.id+'/'+m.sender_id+'/')){
      const {data,error}=await client.storage.from('dm-attachments').createSignedUrl(file.path,3600);
      if(!error&&data?.signedUrl){
        if(String(file.type||'').startsWith('image/')){const img=document.createElement('img');img.className='nero-dm-media-image';img.src=data.signedUrl;img.alt=file.name||'Image attachment';img.loading='lazy';bubble.append(img)}
        const link=document.createElement('a');link.className='nero-dm-file-link';link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='📎 '+(file.name||'Download file');link.download=file.name||'';bubble.append(link);
        const size=document.createElement('small');size.className='nero-dm-file-size';size.textContent=(Number(file.size||0)/1048576).toFixed(file.size>=1048576?1:2)+' MB';bubble.append(size);
      }else{const p=document.createElement('p');p.textContent='Attachment unavailable';bubble.append(p)}
    }else{const text=document.createElement('p');text.textContent=String(m.content||'');bubble.append(text)}
    const meta=document.createElement('div');meta.className='nero-dm-message-meta';const time=document.createElement('time');time.textContent=shortTime(m.created_at)+(m.edited_at?' · edited':'');time.title=fullTime(m.created_at);meta.append(time);
    if(own){
      if(!gif&&!file){const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.addEventListener('click',async()=>{const next=prompt('Edit your message:',m.content);if(next===null)return;const content=next.trim();if(!content||content.length>2000)return;const {error}=await client.from('dm_messages').update({content,edited_at:new Date().toISOString()}).eq('id',m.id);if(error)alert(error.message);else await loadMessages()});meta.append(edit)}
      const del=document.createElement('button');del.type='button';del.textContent='Delete';del.addEventListener('click',async()=>{if(!confirm('Delete this message?'))return;const {error}=await client.from('dm_messages').delete().eq('id',m.id);if(error)alert(error.message);else await loadMessages()});meta.append(del);
    }
    bubble.append(meta);row.append(bubble);messageList.append(row);
  }
  async function loadMessages(){
    if(!activeConversation||!user?.id)return;messageList.replaceChildren();
    const {data,error}=await client.from('dm_messages').select('id,conversation_id,sender_id,content,created_at,edited_at').eq('conversation_id',activeConversation.id).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(150);
    if(error){notice(error.message);return}if(!data?.length){notice('This is the beginning of your conversation. Say hello!');return}
    for(const message of data)await renderMessage(message);messageList.scrollTop=messageList.scrollHeight;
  }
  function updateHeader(){
    head.replaceChildren();if(!activeOther)return;head.append(avatar(activeOther));
    const info=document.createElement('span');info.className='nero-dm-header-info';const name=document.createElement('strong');name.textContent=profileName(activeOther);
    const handle=document.createElement('small');handle.textContent='@'+(activeOther.username||'member');info.append(name,handle);head.append(info);
  }
  async function openConversation(otherId){
    if(!user?.id){window.NERO_ACCOUNT?.open();return}if(!profileCache.size)await loadProfiles();
    activeOther=profileCache.get(otherId);if(!activeOther)throw new Error('That member could not be found.');activeConversation=null;
    showMessagesView();empty.hidden=true;active.hidden=false;input.disabled=false;attachButton.disabled=false;emojiButton.disabled=false;gifButton.disabled=false;updateHeader();notice('Loading messages…');
    try{
      activeConversation=await ensureConversation(otherId);
      const {error:unhideError}=await client.from('dm_hidden_conversations').delete().eq('user_id',user.id).eq('conversation_id',activeConversation.id);
      if(unhideError)throw unhideError;
      hiddenConversationIds.delete(activeConversation.id);
      await Promise.all([loadMessages(),loadConversations()]);input.focus()
    }catch(e){notice(e.message||'Could not open this conversation.')}
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