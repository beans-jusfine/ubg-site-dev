(() => {
  const $=s=>document.querySelector(s),status=$('#global-chat-status'),joinPanel=$('#global-chat-join'),room=$('#global-chat-room'),messages=$('#global-chat-messages'),form=$('#global-chat-form'),input=$('#global-chat-input'),fileInput=$('#global-chat-file'),attachButton=$('#global-chat-attach');
  const seen=new Set(),typingUsers=new Map(),typingTimers=new Map();let client=window.NERO_SUPABASE,channel=null,joined=false,user=null,profile=null,typingActive=false,typingSendTimer=null,typingClearTimer=null;
  const norm=s=>String(s||'').toLowerCase();
  function setStatus(t,state='offline'){status.textContent=t;status.dataset.state=state}
  const chatNavButton=document.querySelector('nav button[data-v="chat"]');
  const chatView=document.querySelector('#chat-view');
  const mentionBadge=document.createElement('span');
  mentionBadge.className='nero-mention-badge';
  mentionBadge.hidden=true;
  mentionBadge.setAttribute('aria-label','Unread mentions');
  if(chatNavButton){chatNavButton.style.position='relative';chatNavButton.append(mentionBadge)}
  const mentionToast=document.createElement('div');
  mentionToast.className='nero-mention-toast';
  mentionToast.setAttribute('role','status');
  mentionToast.setAttribute('aria-live','polite');
  mentionToast.hidden=true;
  document.body.append(mentionToast);
  let unreadMentions=0,mentionToastTimer=null,audioContext=null;
  const mentionStorageKey=()=> 'nero.unread.mentions.'+(user?.id||'');
  function renderMentionBadge(){
    mentionBadge.textContent=unreadMentions>99?'99+':String(unreadMentions);
    mentionBadge.hidden=unreadMentions===0;
    if(chatNavButton)chatNavButton.setAttribute('aria-label',unreadMentions?('Global chat, '+unreadMentions+' unread mentions'):'Global chat');
    document.title=unreadMentions?'('+unreadMentions+') NERO':'NERO';
  }
  function loadMentionCount(){
    try{unreadMentions=Math.max(0,Number(localStorage.getItem(mentionStorageKey())||0)||0)}catch(e){unreadMentions=0}
    renderMentionBadge();
  }
  function clearMentionCount(){
    unreadMentions=0;
    try{localStorage.removeItem(mentionStorageKey())}catch(e){}
    renderMentionBadge();
    mentionToast.hidden=true;
  }
  function unlockMentionAudio(){
    try{
      const AudioCtor=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtor)return;
      if(!audioContext)audioContext=new AudioCtor();
      if(audioContext.state==='suspended')audioContext.resume();
    }catch(e){}
  }
  window.addEventListener('pointerdown',unlockMentionAudio,{once:true,capture:true});
  window.addEventListener('keydown',unlockMentionAudio,{once:true,capture:true});
  function playMentionDing(){
    try{
      unlockMentionAudio();
      if(!audioContext||audioContext.state!=='running')return;
      const now=audioContext.currentTime;
      [880,1174.66].forEach((frequency,index)=>{
        const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
        oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,now+index*.09);
        gain.gain.setValueAtTime(.0001,now+index*.09);
        gain.gain.exponentialRampToValueAtTime(.13,now+index*.09+.012);
        gain.gain.exponentialRampToValueAtTime(.0001,now+index*.09+.19);
        oscillator.connect(gain);gain.connect(audioContext.destination);
        oscillator.start(now+index*.09);oscillator.stop(now+index*.09+.2);
      });
    }catch(e){}
  }
  function notifyMention(from){
    if(chatView?.classList.contains('on'))return;
    unreadMentions++;
    try{localStorage.setItem(mentionStorageKey(),String(unreadMentions))}catch(e){}
    renderMentionBadge();
    mentionToast.textContent=(from||'Someone')+' mentioned you';mentionToast.hidden=false;if(mentionToastTimer)clearTimeout(mentionToastTimer);mentionToastTimer=setTimeout(()=>{mentionToast.hidden=true},3600);playMentionDing();
  }
  chatNavButton?.addEventListener('click',clearMentionCount,true);
  const emojiButton=document.createElement('button');emojiButton.type='button';emojiButton.id='global-chat-emoji';emojiButton.className='ghost global-chat-emoji';emojiButton.textContent='☺';emojiButton.title='Choose emoji';emojiButton.setAttribute('aria-label','Choose emoji');attachButton.before(emojiButton);
  const emojiPicker=document.createElement('div');emojiPicker.className='global-chat-emoji-picker';emojiPicker.hidden=true;emojiPicker.innerHTML='<div class="global-chat-emoji-top"><strong>Emoji</strong><input id="gc-emoji-search" type="search" placeholder="Search emoji…" aria-label="Search emoji"></div><div class="global-chat-emoji-cats"></div><div class="global-chat-emoji-grid"></div>';form.append(emojiPicker);
  const emojiSearch=emojiPicker.querySelector('input'),emojiCats=emojiPicker.querySelector('.global-chat-emoji-cats'),emojiGrid=emojiPicker.querySelector('.global-chat-emoji-grid');
  const emojiGroups=[
    ['Smileys','😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😍 🥰 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 🫡 😐 😑 😏 🙄 😬 😴 🥱 🤯 🥳 😎 🤓 😕 😟 🙁 ☹️ 😮 😲 😳 🥺 😦 😨 😰 😥 😢 😭 😱 😖 😞 😩 😫 🥹 😤 😡 🤬'],
    ['People','👋 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 👏 🙌 🫶 🙏 💪 💅 🤳 👀 🧠'],
    ['Animals','🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🦈 🐊 🐘 🦒 🐕 🐈 🦜 🐇 🦝 🦦 🦔'],
    ['Food','🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥝 🍅 🥑 🥦 🥒 🌶️ 🌽 🥕 🧄 🥔 🍞 🧀 🥚 🍳 🥞 🥓 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🥟 🍤 🍚 🍦 🍰 🎂 🍩 🍪 🍫 🍿'],
    ['Activities','⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🏒 🥅 ⛳ 🎣 🥊 🥋 🛹 🛼 🎿 🏆 🥇 🥈 🥉 🎮 🕹️ 🎲 🎯 🎤 🎧 🎹 🥁 🎸 🎻'],
    ['Travel','🚗 🚕 🚌 🏎️ 🚓 🚑 🚒 🚲 🛴 🚦 ⚓ ⛵ 🚢 ✈️ 🚁 🚀 🛸 🌍 🌎 🌏 🌕 🌙 ⭐ 🌟 ✨ ⚡ 💥 🔥 🌈 ☀️ 🌧️ ❄️ 🌊'],
    ['Objects','⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 📷 📸 📹 🎥 📞 📺 ⏰ 🔋 🔌 💡 💸 💵 💳 💎 🔧 🔨 ⚙️ 🧪 🔬 📚 📖 📝 ✏️ 📌 📁 🗑️ 🔒 🔑 🎁 🎈 🎉 🧸'],
    ['Symbols','❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💞 💓 💗 💖 💘 💝 💯 💬 💭 ☮️ ☯️ ✡️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ ✅ ❌ ➕ ➖ ✖️ ♾️ 🔔 🔕 🚫 ⚠️ ❗ ❓ ♻️']
  ].map(([name,list])=>({name,items:[...new Set(list.split(/\s+/))]}));
  const emojiSearchNames={'😀':'grinning face','😃':'smiley face','😄':'smile','😁':'beaming','😆':'laughing','😅':'sweat smile','😂':'joy laugh','🤣':'rolling laughing','🥲':'smiling tear','😊':'blush','😉':'wink','😍':'heart eyes','🥰':'hearts','😘':'kiss','😋':'yum','😜':'tongue wink','🤔':'thinking','😴':'sleep','🥳':'party','😎':'sunglasses cool','😭':'crying sad','😡':'angry mad','🤬':'swearing','👍':'thumbs up like','👎':'thumbs down dislike','👏':'clap','🙌':'raised hands','🙏':'pray thanks','💪':'strong muscle','👋':'wave hello','❤️':'red heart love','💔':'broken heart','🔥':'fire hot lit','✨':'sparkles stars','⭐':'star','💯':'hundred perfect','🎉':'party popper celebrate','🎂':'birthday cake','🍕':'pizza','🍔':'burger hamburger','🍟':'fries','🍎':'apple','🍓':'strawberry','🐶':'dog puppy','🐱':'cat kitten','🐸':'frog','🦊':'fox','🐼':'panda','🚀':'rocket','💻':'laptop computer','📱':'phone mobile','🎮':'video game controller','⚽':'soccer ball','🏀':'basketball','☀️':'sun sunny','🌈':'rainbow','💀':'skull dead','🤡':'clown','👀':'eyes look','💬':'speech bubble chat'};
  let emojiGroup=0;
  function renderEmoji(){emojiCats.replaceChildren();emojiGroups.forEach((g,i)=>{const b=document.createElement('button');b.type='button';b.textContent=g.name;b.className=i===emojiGroup?'active':'';b.addEventListener('click',()=>{emojiGroup=i;emojiSearch.value='';renderEmoji()});emojiCats.append(b)});
    const q=emojiSearch.value.trim().toLowerCase(),items=q?emojiGroups.flatMap(g=>g.items).filter(e=>e.toLowerCase().includes(q)||(emojiSearchNames[e]||'').includes(q)):emojiGroups[emojiGroup].items;emojiGrid.replaceChildren();
    items.forEach(e=>{const b=document.createElement('button');b.type='button';b.textContent=e;b.title=e;b.setAttribute('aria-label','Insert '+e);b.addEventListener('click',()=>{const a=input.selectionStart??input.value.length,z=input.selectionEnd??a;input.setRangeText(e,a,z,'end');input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));emojiPicker.hidden=true});emojiGrid.append(b)});
    if(!items.length){const empty=document.createElement('span');empty.className='global-chat-emoji-empty';empty.textContent='No matching emoji';emojiGrid.append(empty)}}
  emojiButton.addEventListener('click',()=>{emojiPicker.hidden=!emojiPicker.hidden;if(!emojiPicker.hidden){renderEmoji();emojiSearch.focus()}});
  emojiSearch.addEventListener('input',renderEmoji);document.addEventListener('pointerdown',e=>{if(!emojiPicker.contains(e.target)&&!emojiButton.contains(e.target))emojiPicker.hidden=true});renderEmoji();
  const typingIndicator=document.createElement('div');typingIndicator.className='global-chat-typing';typingIndicator.setAttribute('aria-live','polite');typingIndicator.hidden=true;room.insertBefore(typingIndicator,form);
  function renderTyping(){const names=[...typingUsers.values()];typingIndicator.hidden=!names.length;typingIndicator.textContent=names.length===1?names[0]+' is typing…':names.length===2?names.join(' and ')+' are typing…':names.length>2?'Several people are typing…':''}
  function stopTyping(){if(typingClearTimer)clearTimeout(typingClearTimer);typingClearTimer=null;if(typingActive&&channel&&joined)channel.send({type:'broadcast',event:'typing',payload:{userId:user?.id,username:profile?.username,typing:false}});typingActive=false}
  function announceTyping(){if(!joined||!channel||!profile)return;if(!typingActive){typingActive=true;channel.send({type:'broadcast',event:'typing',payload:{userId:user.id,username:profile.username,typing:true}})}else{if(typingSendTimer)clearTimeout(typingSendTimer);typingSendTimer=setTimeout(()=>{if(joined&&typingActive)channel.send({type:'broadcast',event:'typing',payload:{userId:user.id,username:profile.username,typing:true}})},650)}if(typingClearTimer)clearTimeout(typingClearTimer);typingClearTimer=setTimeout(stopTyping,1800)}

  function addMessage(m){if(!m?.id||seen.has(String(m.id)))return;seen.add(String(m.id));messages.querySelector('.global-chat-empty')?.remove();
    const row=document.createElement('article');row.className='global-chat-message'+(m.user_id===user?.id?' mine':'');const meta=document.createElement('div');meta.className='global-chat-message-meta';
    const who=document.createElement('span');who.className='global-chat-message-name';who.textContent='@'+(m.username||'user');const time=document.createElement('time'),date=new Date(m.created_at);time.dateTime=date.toISOString();time.textContent=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});meta.append(who,time);row.append(meta);
    if(m.image_path){const img=document.createElement('img');img.className='global-chat-image';img.src=client.storage.from('chat-images').getPublicUrl(m.image_path).data.publicUrl;img.alt='Image shared by '+m.username;img.loading='lazy';img.addEventListener('click',()=>window.open(img.src,'_blank','noopener'));row.append(img)}
    if(m.content){const body=document.createElement('div');body.className='global-chat-message-body';const re=/@([a-z0-9_]{3,24})/gi;let last=0,match;while((match=re.exec(m.content))){body.append(document.createTextNode(m.content.slice(last,match.index)));const span=document.createElement('span');span.className='global-chat-mention';span.textContent=match[0];if(norm(match[1])===norm(profile?.username))span.classList.add('self');body.append(span);last=re.lastIndex}body.append(document.createTextNode(m.content.slice(last)));row.append(body)}
    messages.append(row);while(messages.children.length>120)messages.firstElementChild.remove();messages.scrollTop=messages.scrollHeight}
  async function history(){const {data,error}=await client.from('chat_messages').select('id,user_id,username,content,image_path,created_at').order('id',{ascending:false}).limit(80);if(error)throw error;(data||[]).reverse().forEach(addMessage);if(!messages.children.length){const p=document.createElement('p');p.className='global-chat-empty';p.textContent='No messages yet. Start the conversation!';messages.append(p)}}
  async function disconnect(){stopTyping();joined=false;if(channel){await client.removeChannel(channel);channel=null}for(const timer of typingTimers.values())clearTimeout(timer);typingTimers.clear();typingUsers.clear();renderTyping();room.hidden=true;joinPanel.hidden=false;messages.replaceChildren();seen.clear()}
  async function connect(){if(!client||!user||!profile){setStatus('Sign in to use chat');return}if(channel)await client.removeChannel(channel);joined=false;messages.replaceChildren();seen.clear();setStatus('Connecting…','pending');
    channel=client.channel('nero-global-chat');
    channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},p=>addMessage(p.new));channel.on('broadcast',{event:'typing'},({payload})=>{if(!payload?.userId||payload.userId===user?.id||!payload.username)return;const id=payload.userId;if(payload.typing){typingUsers.set(id,payload.username);const old=typingTimers.get(id);if(old)clearTimeout(old);typingTimers.set(id,setTimeout(()=>{typingUsers.delete(id);typingTimers.delete(id);renderTyping()},2200))}else{const old=typingTimers.get(id);if(old)clearTimeout(old);typingTimers.delete(id);typingUsers.delete(id)}renderTyping()});
    channel.on('broadcast',{event:'mention'},({payload})=>{if(payload?.to===norm(profile.username)){setStatus(payload.from+' mentioned you','connected');status.classList.add('mentioned');notifyMention(payload.from)}});
    channel.subscribe(async state=>{if(state==='SUBSCRIBED'){joined=true;joinPanel.hidden=true;room.hidden=false;setStatus('Connected as @'+profile.username,'connected');try{await history()}catch(e){setStatus('Could not load messages: '+e.message,'error')}}
      else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){joined=false;setStatus('Chat connection failed. Refresh and try again.','error')}})}
  form.addEventListener('submit',async e=>{e.preventDefault();const content=input.value.trim();if(!content||!joined||!user||!profile)return;input.disabled=true;
    try{const {error}=await client.from('chat_messages').insert({guest_id:user.id,user_id:user.id,username:profile.username,content});if(error)throw error;
      const targets=new Set(Array.from(content.matchAll(/@([a-z0-9_]{3,24})/gi),m=>m[1].toLowerCase()));for(const target of targets)await channel.send({type:'broadcast',event:'mention',payload:{to:target,from:'@'+profile.username}});input.value=''
    }catch(err){setStatus(err.message||'Message could not be sent','error')}finally{input.disabled=false;input.focus()}});
  attachButton.addEventListener('click',()=>fileInput.click());fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];fileInput.value='';if(!file)return;if(!joined||!user||!profile){setStatus('Sign in before sharing an image','error');return}
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){setStatus('Use a JPG, PNG, WEBP, or GIF image','error');return}if(file.size>2*1024*1024){setStatus('Images must be 2 MB or smaller','error');return}
    attachButton.disabled=true;setStatus('Uploading image…','pending');try{const path=user.id+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const {error:up}=await client.storage.from('chat-images').upload(path,file,{contentType:file.type,upsert:false});if(up)throw up;
      const {error}=await client.from('chat_messages').insert({guest_id:user.id,user_id:user.id,username:profile.username,content:'',image_path:path});if(error)throw error;setStatus('Image sent','connected')
    }catch(err){setStatus(err.message||'Image upload failed','error')}finally{attachButton.disabled=false}});
  input.addEventListener('input',()=>{if(input.value.trim())announceTyping();else stopTyping();});input.addEventListener('blur',stopTyping);
  window.addEventListener('nero:auth-change',async e=>{user=e.detail?.user||null;profile=e.detail?.profile||null;if(user&&profile){loadMentionCount();await connect()}else{clearMentionCount();await disconnect();setStatus('Sign in to use chat')}});
  if(window.NERO_AUTH?.user&&window.NERO_AUTH?.profile){user=window.NERO_AUTH.user;profile=window.NERO_AUTH.profile;loadMentionCount();connect()}else setStatus('Sign in to use chat');
  document.querySelector('nav button[data-v="chat"]')?.addEventListener('click',()=>{if(!user)window.NERO_ACCOUNT?.open()});
  window.addEventListener('beforeunload',()=>{if(channel)client.removeChannel(channel)});
})();