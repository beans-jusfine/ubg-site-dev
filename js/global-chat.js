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
  const gifButton=document.createElement('button');gifButton.type='button';gifButton.id='global-chat-gif';gifButton.className='ghost global-chat-gif';gifButton.textContent='GIF';gifButton.title='Send a GIF';gifButton.setAttribute('aria-label','Choose a GIF');attachButton.before(gifButton);
  const emojiPicker=document.createElement('div');emojiPicker.className='global-chat-emoji-picker';emojiPicker.hidden=true;emojiPicker.innerHTML='<div class="global-chat-picker-top"><strong>Emoji</strong><input id="gc-emoji-search" type="search" placeholder="Search emoji" aria-label="Search emoji"></div><div class="global-chat-emoji-cats"></div><div class="global-chat-emoji-grid"></div>';form.append(emojiPicker);
  const emojiSearch=emojiPicker.querySelector('input'),emojiCats=emojiPicker.querySelector('.global-chat-emoji-cats'),emojiGrid=emojiPicker.querySelector('.global-chat-emoji-grid');
  const emojiGroups=[
    ['Smileys','😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😍 🥰 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 🫡 😐 😑 😏 🙄 😬 😴 🥱 🤯 🥳 😎 🤓 😕 😟 🙁 ☹️ 😮 😲 😳 🥺 😦 😨 😰 😥 😢 😭 😱 😖 😞 😩 😫 🥹 😤 😡 🤬'],
    ['People','👋 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 👏 🙌 🫶 🙏 💪 💅 🤳 👀 🧠 🧑‍💻 🧑‍🎓 🧑‍🚀'],
    ['Animals','🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🦈 🐊 🐘 🦒 🐕 🐈 🦜 🐇 🦝 🦦 🦔'],
    ['Food','🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥝 🍅 🥑 🥦 🥒 🌶️ 🌽 🥕 🧄 🥔 🍞 🧀 🥚 🍳 🥞 🥓 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🥟 🍤 🍚 🍦 🍰 🎂 🍩 🍪 🍫 🍿'],
    ['Activities','⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🏒 🥅 ⛳ 🎣 🥊 🥋 🛹 🛼 🎿 🏆 🥇 🥈 🥉 🎮 🕹️ 🎲 🎯 🎤 🎧 🎹 🥁 🎸 🎻'],
    ['Travel','🚗 🚕 🚌 🏎️ 🚓 🚑 🚒 🚲 🛴 🚦 ⚓ ⛵ 🚢 ✈️ 🚁 🚀 🛸 🌍 🌎 🌏 🌕 🌙 ⭐ 🌟 ✨ ⚡ 💥 🔥 🌈 ☀️ 🌧️ ❄️ 🌊'],
    ['Objects','⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 📷 📸 📹 🎥 📞 📺 ⏰ 🔋 🔌 💡 💸 💵 💳 💎 🔧 🔨 ⚙️ 🧪 🔬 📚 📖 📝 ✏️ 📌 📁 🗑️ 🔒 🔑 🎁 🎈 🎉 🧸'],
    ['Symbols','❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💞 💓 💗 💖 💘 💝 💯 💬 💭 ☮️ ☯️ ✡️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ ✅ ❌ ➕ ➖ ✖️ ♾️ 🔔 🔕 🚫 ⚠️ ❗ ❓ ♻️']
  ].map(([name,list])=>({name,items:[...new Set(list.split(/\s+/))]}));
  const emojiSearchNames={'😀':'grinning face','😃':'smiley face','😄':'smile','😁':'beaming','😆':'laughing','😅':'sweat smile','😂':'joy laugh tears','🤣':'rolling laughing','🥲':'smiling tear','😊':'blush happy','😉':'wink','😍':'heart eyes love','🥰':'hearts','😘':'kiss','😋':'yum','😜':'tongue wink','🤔':'thinking','😴':'sleep','🥳':'party','😎':'sunglasses cool','😭':'crying sad','😡':'angry mad','🤬':'swearing','👍':'thumbs up like','👎':'thumbs down dislike','👏':'clap','🙌':'raised hands','🙏':'pray thanks please','💪':'strong muscle','👋':'wave hello','❤️':'red heart love','💔':'broken heart','🔥':'fire hot lit','✨':'sparkles stars','⭐':'star','💯':'hundred perfect','🎉':'party popper celebrate','🎂':'birthday cake','🍕':'pizza','🍔':'burger hamburger','🍟':'fries','🍎':'apple','🍓':'strawberry','🐶':'dog puppy','🐱':'cat kitten','🐸':'frog','🦊':'fox','🐼':'panda','🚀':'rocket','💻':'laptop computer','📱':'phone mobile','🎮':'video game controller','⚽':'soccer ball','🏀':'basketball','☀️':'sun sunny','🌈':'rainbow','💀':'skull dead','🤡':'clown','👀':'eyes look','💬':'speech bubble chat','🤯':'mind blown shock','🥺':'pleading puppy eyes','😤':'huff frustrated','😈':'devil mischievous','💀':'skull dead','🫡':'salute','🫶':'heart hands','🧠':'brain','🍿':'popcorn','☕':'coffee','🥑':'avocado','🐍':'snake','🦄':'unicorn','🌙':'moon night','⚡':'lightning bolt','💎':'gem diamond','🔒':'lock','🎯':'target'};
  const emojiRecentKey=()=> 'nero.chat.emoji.recent.'+(user?.id||'guest');
  let emojiRecent=[];try{emojiRecent=JSON.parse(localStorage.getItem(emojiRecentKey())||'[]')}catch(e){}
  let emojiGroup=emojiRecent.length?-1:0;
  function rememberEmoji(value){emojiRecent=[value,...emojiRecent.filter(x=>x!==value)].slice(0,32);try{localStorage.setItem(emojiRecentKey(),JSON.stringify(emojiRecent))}catch(e){}}
  function insertEmoji(value){const a=input.selectionStart??input.value.length,z=input.selectionEnd??a;input.setRangeText(value,a,z,'end');input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));rememberEmoji(value);emojiPicker.hidden=true;emojiAutocomplete.hidden=true}
  function renderEmoji(){emojiCats.replaceChildren();const tabs=[{name:'Recent',items:emojiRecent},...emojiGroups];tabs.forEach((g,i)=>{const b=document.createElement('button');b.type='button';b.textContent=g.name;b.className=i===emojiGroup+1?'active':'';b.addEventListener('click',()=>{emojiGroup=i-1;emojiSearch.value='';renderEmoji()});emojiCats.append(b)});
    const q=emojiSearch.value.trim().toLowerCase(),source=emojiGroup<0?emojiRecent:emojiGroups[emojiGroup].items,items=q?[...new Set([...emojiRecent,...emojiGroups.flatMap(g=>g.items)])].filter(e=>e.toLowerCase().includes(q)||(emojiSearchNames[e]||'').includes(q)):source;emojiGrid.replaceChildren();
    items.forEach(e=>{const b=document.createElement('button');b.type='button';b.textContent=e;b.title=emojiSearchNames[e]||e;b.setAttribute('aria-label','Insert '+(emojiSearchNames[e]||e));b.addEventListener('click',()=>insertEmoji(e));emojiGrid.append(b)});
    if(!items.length){const empty=document.createElement('span');empty.className='global-chat-emoji-empty';empty.textContent='No matching emoji';emojiGrid.append(empty)}}
  emojiButton.addEventListener('click',()=>{gifPicker.hidden=true;emojiPicker.hidden=!emojiPicker.hidden;if(!emojiPicker.hidden){renderEmoji();emojiSearch.focus()}});
  emojiSearch.addEventListener('input',renderEmoji);
  const emojiAutocomplete=document.createElement('div');emojiAutocomplete.className='global-chat-emoji-autocomplete';emojiAutocomplete.hidden=true;form.append(emojiAutocomplete);
  let autocompleteMatches=[],autocompleteIndex=0;
  function renderEmojiAutocomplete(){const m=input.value.match(/:([a-z0-9_+-]{2,24})$/i);if(!m){emojiAutocomplete.hidden=true;return}const q=m[1].toLowerCase();autocompleteMatches=Object.entries(emojiSearchNames).filter(([emoji,name])=>name.split(/[ -]/).some(w=>w.startsWith(q))||name.includes(q)).slice(0,7);autocompleteIndex=0;emojiAutocomplete.replaceChildren();if(!autocompleteMatches.length){emojiAutocomplete.hidden=true;return}autocompleteMatches.forEach(([emoji,name],i)=>{const b=document.createElement('button');b.type='button';b.className=i===0?'active':'';b.innerHTML='<span></span><small></small>';b.children[0].textContent=emoji;b.children[1].textContent=':'+name.replace(/ /g,'_')+':';b.addEventListener('click',()=>{input.value=input.value.replace(/:[a-z0-9_+-]{2,24}$/i,emoji);input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));emojiAutocomplete.hidden=true});emojiAutocomplete.append(b)});emojiAutocomplete.hidden=false}
  function chooseAutocomplete(){if(!autocompleteMatches.length)return false;const [emoji]=autocompleteMatches[autocompleteIndex];input.value=input.value.replace(/:[a-z0-9_+-]{2,24}$/i,emoji);input.focus();emojiAutocomplete.hidden=true;input.dispatchEvent(new Event('input',{bubbles:true}));return true}
  input.addEventListener('input',renderEmojiAutocomplete);input.addEventListener('keydown',e=>{if(emojiAutocomplete.hidden)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();autocompleteIndex=(autocompleteIndex+(e.key==='ArrowDown'?1:-1)+autocompleteMatches.length)%autocompleteMatches.length;[...emojiAutocomplete.children].forEach((b,i)=>b.classList.toggle('active',i===autocompleteIndex))}else if((e.key==='Tab'||e.key==='Enter')&&chooseAutocomplete()){e.preventDefault()}else if(e.key==='Escape')emojiAutocomplete.hidden=true});
  document.addEventListener('pointerdown',e=>{if(!emojiPicker.contains(e.target)&&!emojiButton.contains(e.target))emojiPicker.hidden=true;if(!emojiAutocomplete.contains(e.target)&&e.target!==input)emojiAutocomplete.hidden=true});renderEmoji();
  const gifPicker=document.createElement('div');gifPicker.className='global-chat-gif-picker';gifPicker.hidden=true;gifPicker.innerHTML='<div class="global-chat-picker-top"><strong>GIFs</strong><input id="gc-gif-search" type="search" placeholder="Search KLIPY" aria-label="Search KLIPY GIFs"></div><div class="global-chat-gif-results"></div><div class="global-chat-klipy-credit">Powered by KLIPY</div>';form.append(gifPicker);
  const gifSearch=gifPicker.querySelector('input'),gifResults=gifPicker.querySelector('.global-chat-gif-results');let gifRequest=0,gifDebounce=null;
  function gifKey(){return window.NERO_CONFIG?.klipyApiKey||''}
  function gifImageUrl(item){return item?.file?.hd?.gif?.url||item?.file?.md?.gif?.url||item?.file?.sm?.gif?.url||item?.file?.hd?.webp?.url||item?.file?.md?.webp?.url||item?.preview_url||item?.url||''}
  function gifItems(payload){const data=payload?.data;return Array.isArray(data?.data)?data.data:Array.isArray(data?.items)?data.items:Array.isArray(data)?data:[]}
  async function loadGifs(query=''){const key=gifKey();if(!key){gifResults.innerHTML='<p class="global-chat-gif-message">Add your KLIPY app key to <code>config.js</code> to enable GIF search.</p>';return}const id=++gifRequest;gifResults.innerHTML='<p class="global-chat-gif-message">Loading GIFs…</p>';const endpoint=query?'search':'trending',params=new URLSearchParams({page:'1',per_page:'24',customer_id:String(user?.id||'nero-guest'),locale:'en_US',content_filter:'high',format_filter:'gif,webp'});if(query)params.set('q',query);try{const response=await fetch('https://api.klipy.com/api/v1/'+encodeURIComponent(key)+'/gifs/'+endpoint+'?'+params.toString());if(!response.ok)throw new Error('KLIPY returned HTTP '+response.status);const payload=await response.json();if(id!==gifRequest)return;const items=gifItems(payload);gifResults.replaceChildren();items.filter(x=>x?.type!=='ad').forEach(item=>{const url=gifImageUrl(item);if(!/^https:\/\/static(?:\d+)?\.klipy\.com\//i.test(url))return;const b=document.createElement('button');b.type='button';b.className='global-chat-gif-item';const img=document.createElement('img');img.src=url;img.alt=item.title||'GIF';img.loading='lazy';const label=document.createElement('span');label.textContent=item.title||'GIF';b.append(img,label);b.addEventListener('click',()=>sendGif(item,url));gifResults.append(b)});if(!gifResults.children.length)gifResults.innerHTML='<p class="global-chat-gif-message">No GIFs found. Try another search.</p>'}catch(error){if(id===gifRequest)gifResults.textContent=error.message||'Could not load GIFs.'}}
  async function sendGif(item,url){if(!joined||!user||!profile){setStatus('Sign in before sending a GIF','error');return}const safeUrl=String(url||'');if(!/^https:\/\/static(?:\d+)?\.klipy\.com\//i.test(safeUrl))return;const payload={url:safeUrl,slug:String(item.slug||''),title:String(item.title||'GIF').slice(0,120)};const content='NERO_GIF|'+JSON.stringify(payload);try{gifButton.disabled=true;const {error}=await client.from('chat_messages').insert({guest_id:user.id,user_id:user.id,username:profile.username,content});if(error)throw error;if(payload.slug){const key=gifKey();if(key)fetch('https://api.klipy.com/api/v1/'+encodeURIComponent(key)+'/gifs/share/'+encodeURIComponent(payload.slug),{method:'POST'}).catch(()=>{})}gifPicker.hidden=true;setStatus('GIF sent','connected')}catch(error){setStatus(error.message||'GIF could not be sent','error')}finally{gifButton.disabled=false}}
  gifButton.addEventListener('click',()=>{emojiPicker.hidden=true;gifPicker.hidden=!gifPicker.hidden;if(!gifPicker.hidden){gifSearch.focus();if(!gifResults.children.length)loadGifs(gifSearch.value.trim())}});
  gifSearch.addEventListener('input',()=>{if(gifDebounce)clearTimeout(gifDebounce);gifDebounce=setTimeout(()=>loadGifs(gifSearch.value.trim()),350)});
  document.addEventListener('pointerdown',e=>{if(!gifPicker.contains(e.target)&&!gifButton.contains(e.target))gifPicker.hidden=true});
  const typingIndicator=document.createElement('div');typingIndicator.className='global-chat-typing';typingIndicator.setAttribute('aria-live','polite');typingIndicator.hidden=true;room.insertBefore(typingIndicator,form);
  function renderTyping(){const names=[...typingUsers.values()];typingIndicator.hidden=!names.length;typingIndicator.textContent=names.length===1?names[0]+' is typing…':names.length===2?names.join(' and ')+' are typing…':names.length>2?'Several people are typing…':''}
  function stopTyping(){if(typingClearTimer)clearTimeout(typingClearTimer);typingClearTimer=null;if(typingActive&&channel&&joined)channel.send({type:'broadcast',event:'typing',payload:{userId:user?.id,username:profile?.username,typing:false}});typingActive=false}
  function announceTyping(){if(!joined||!channel||!profile)return;if(!typingActive){typingActive=true;channel.send({type:'broadcast',event:'typing',payload:{userId:user.id,username:profile.username,typing:true}})}else{if(typingSendTimer)clearTimeout(typingSendTimer);typingSendTimer=setTimeout(()=>{if(joined&&typingActive)channel.send({type:'broadcast',event:'typing',payload:{userId:user.id,username:profile.username,typing:true}})},650)}if(typingClearTimer)clearTimeout(typingClearTimer);typingClearTimer=setTimeout(stopTyping,1800)}

  function addMessage(m){if(!m?.id||seen.has(String(m.id)))return;seen.add(String(m.id));messages.querySelector('.global-chat-empty')?.remove();
    const row=document.createElement('article');row.className='global-chat-message'+(m.user_id===user?.id?' mine':'');const meta=document.createElement('div');meta.className='global-chat-message-meta';
    const who=document.createElement('span');who.className='global-chat-message-name';who.textContent='@'+(m.username||'user');const time=document.createElement('time'),date=new Date(m.created_at);time.dateTime=date.toISOString();time.textContent=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});meta.append(who,time);row.append(meta);
    if(m.image_path){const img=document.createElement('img');img.className='global-chat-image';img.src=client.storage.from('chat-images').getPublicUrl(m.image_path).data.publicUrl;img.alt='Image shared by '+m.username;img.loading='lazy';img.addEventListener('click',()=>window.open(img.src,'_blank','noopener'));row.append(img)}
    if(m.content){if(m.content.startsWith('NERO_GIF|')){try{const gif=JSON.parse(m.content.slice(9));if(/^https:\/\/static(?:\d+)?\.klipy\.com\//i.test(gif.url)){const img=document.createElement('img');img.className='global-chat-image global-chat-gif-message-image';img.src=gif.url;img.alt=gif.title||'GIF shared by '+m.username;img.loading='lazy';img.addEventListener('click',()=>window.open(img.src,'_blank','noopener'));row.append(img)}}catch(e){}}else{const body=document.createElement('div');body.className='global-chat-message-body';if(/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u.test(m.content)&&[...m.content].filter(c=>/\p{Extended_Pictographic}/u.test(c)).length<=27)body.classList.add('global-chat-wumboji');const re=/@([a-z0-9_]{3,24})/gi;let last=0,match;while((match=re.exec(m.content))){body.append(document.createTextNode(m.content.slice(last,match.index)));const span=document.createElement('span');span.className='global-chat-mention';span.textContent=match[0];if(norm(match[1])===norm(profile?.username))span.classList.add('self');body.append(span);last=re.lastIndex}body.append(document.createTextNode(m.content.slice(last)));row.append(body)}}
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
  input.addEventListener('input',()=>{if(input.value.trim())announceTyping();else stopTyping();renderEmojiAutocomplete()});input.addEventListener('blur',stopTyping);
  window.addEventListener('nero:auth-change',async e=>{user=e.detail?.user||null;profile=e.detail?.profile||null;if(user&&profile){loadMentionCount();await connect()}else{clearMentionCount();await disconnect();setStatus('Sign in to use chat')}});
  if(window.NERO_AUTH?.user&&window.NERO_AUTH?.profile){user=window.NERO_AUTH.user;profile=window.NERO_AUTH.profile;loadMentionCount();connect()}else setStatus('Sign in to use chat');
  document.querySelector('nav button[data-v="chat"]')?.addEventListener('click',()=>{if(!user)window.NERO_ACCOUNT?.open()});
  window.addEventListener('beforeunload',()=>{if(channel)client.removeChannel(channel)});
})();