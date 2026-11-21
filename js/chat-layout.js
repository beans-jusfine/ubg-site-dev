(() => {
 const $=s=>document.querySelector(s),layout=$('.global-chat-layout'),dm=$('#nero-dm-dock'),members=$('#global-chat-members'),room=$('#global-chat-room');
 const showDm=$('#nero-show-dms'),showMembers=$('#nero-show-members'),hideDm=$('#nero-hide-dms'),hideMembers=$('#nero-hide-members');
 const dmSplit=$('#nero-dm-splitter'),memberSplit=$('#global-chat-splitter');
 if(!layout||!dm||!members||!room)return;
 const keys={dm:'nero.chat.privatePanelVisible.v1',members:'nero.chat.membersVisible.v1',width:'nero.chat.privatePanelWidth.v1'};
 const read=(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:v==='true'}catch(e){return d}};
 function setVisible(which,on,save=true){
  const panel=which==='dm'?dm:members,split=which==='dm'?dmSplit:memberSplit,restore=which==='dm'?showDm:showMembers;
  panel.hidden=!on;if(split)split.hidden=!on;if(restore)restore.hidden=on;
  if(save){try{localStorage.setItem(keys[which],String(on))}catch(e){}}
  layout.classList.toggle('nero-dm-hidden',dm.hidden);layout.classList.toggle('nero-members-hidden',members.hidden);
 }
 setVisible('dm',read('dm',true),false);setVisible('members',read('members',true),false);
 hideDm?.addEventListener('click',()=>setVisible('dm',false));hideMembers?.addEventListener('click',()=>setVisible('members',false));
 showDm?.addEventListener('click',()=>setVisible('dm',true));showMembers?.addEventListener('click',()=>setVisible('members',true));
 try{const w=Number(localStorage.getItem(keys.width));if(w>=230&&w<=620)layout.style.setProperty('--dm-width',w+'px')}catch(e){}
 if(dmSplit&&!dmSplit.dataset.ready){dmSplit.dataset.ready='1';let drag=false;const bounds=()=>{const r=layout.getBoundingClientRect();return {r,max:Math.max(230,Math.min(620,r.width-390))}};const resize=x=>{const {r,max}=bounds(),w=Math.max(230,Math.min(max,x-r.left));layout.style.setProperty('--dm-width',w+'px');try{localStorage.setItem(keys.width,String(Math.round(w)))}catch(e){}};dmSplit.addEventListener('pointerdown',e=>{if(matchMedia('(max-width:900px)').matches)return;drag=true;dmSplit.setPointerCapture(e.pointerId);document.body.classList.add('global-chat-resizing');e.preventDefault();resize(e.clientX)});dmSplit.addEventListener('pointermove',e=>{if(drag)resize(e.clientX)});const stop=()=>{drag=false;document.body.classList.remove('global-chat-resizing')};dmSplit.addEventListener('pointerup',stop);dmSplit.addEventListener('pointercancel',stop);dmSplit.addEventListener('lostpointercapture',stop);dmSplit.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const cur=parseFloat(getComputedStyle(layout).getPropertyValue('--dm-width'))||330,{max}=bounds(),next=Math.max(230,Math.min(max,cur+(e.key==='ArrowLeft'?-16:16)));layout.style.setProperty('--dm-width',next+'px');try{localStorage.setItem(keys.width,String(next))}catch(err){}})}
})();
