(() => {
  const cfg=window.NERO_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.supabaseUrl||!cfg.supabaseKey)return;
  const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.NERO_SUPABASE=client;window.NERO_AUTH={user:null,profile:null};
  const style=document.createElement('style');style.textContent=`
    #nero-account-button{display:flex;align-items:center;justify-content:center;gap:7px}
    #nero-account-button .nero-account-label{font-size:11px;max-width:95px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #nero-auth-overlay{position:fixed;inset:0;z-index:2000;display:none;place-items:center;padding:18px;background:#000b;backdrop-filter:blur(12px)}
    #nero-auth-overlay.open{display:grid}.nero-auth-card{width:min(100%,420px);padding:24px;border:1px solid var(--line);border-radius:18px;background:var(--panel);color:var(--text);box-shadow:0 24px 90px #0009}
    .nero-auth-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.nero-auth-head h2{font-size:20px;margin:0}
    .nero-auth-close{border:0;background:transparent;color:var(--mute);font-size:25px;cursor:pointer}
    .nero-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border:1px solid var(--line);border-radius:11px;margin-bottom:16px}
    .nero-auth-tabs button{border:0;border-radius:8px;padding:9px;background:transparent;color:var(--mute);cursor:pointer}.nero-auth-tabs button.active{background:var(--bg);color:var(--text)}
    .nero-auth-field{display:block;margin:12px 0;font-size:12px;color:var(--mute)}.nero-auth-field input{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);font:inherit}
    .nero-auth-submit{width:100%;margin-top:10px}.nero-auth-message{min-height:20px;margin:12px 0 0;font-size:12px;color:var(--mute);overflow-wrap:anywhere}
    .nero-auth-message.error{color:#f87171}.nero-auth-message.success{color:#4ade80}
    .nero-auth-profile{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--line);border-radius:12px;margin-bottom:14px}
    .nero-auth-avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--bg);font-weight:800;font-size:18px}
    .nero-auth-profile small{display:block;color:var(--mute);margin-top:3px}.nero-auth-card[hidden]{display:none}
    @media(max-width:600px){.nero-auth-card{padding:19px}}
  `;document.head.appendChild(style);
  const nav=document.querySelector('nav'),settings=nav?.querySelector('button[data-v="settings"]');
  const accountButton=document.createElement('button');accountButton.id='nero-account-button';accountButton.type='button';accountButton.title='Account';accountButton.setAttribute('aria-label','Account');accountButton.innerHTML='<i data-lucide="user-round"></i><span class="nero-account-label">Account</span>';if(settings)nav.insertBefore(accountButton,settings);
  const overlay=document.createElement('div');overlay.id='nero-auth-overlay';overlay.innerHTML=`
    <section class="nero-auth-card" role="dialog" aria-modal="true" aria-labelledby="nero-auth-title">
      <div class="nero-auth-head"><h2 id="nero-auth-title">NERO account</h2><button class="nero-auth-close" id="nero-auth-close" aria-label="Close">×</button></div>
      <div id="nero-auth-form-view"><div class="nero-auth-tabs"><button type="button" id="nero-auth-login-tab" class="active">Sign in</button><button type="button" id="nero-auth-signup-tab">Create account</button></div>
        <form id="nero-auth-form"><label class="nero-auth-field" id="nero-auth-username-wrap" hidden>Username<input id="nero-auth-username" type="text" minlength="3" maxlength="24" autocomplete="username" placeholder="letters, numbers, underscore"></label>
          <label class="nero-auth-field" id="nero-auth-login-username-wrap">Username<input id="nero-auth-login-username" type="text" autocomplete="username" required minlength="3" maxlength="24" placeholder="Your NERO username"></label>
          <label class="nero-auth-field">Password<input id="nero-auth-password" type="password" autocomplete="current-password" required minlength="8" maxlength="72" placeholder="At least 8 characters"></label>
          <label class="nero-auth-field" id="nero-auth-confirm-wrap" hidden>Confirm password<input id="nero-auth-confirm" type="password" autocomplete="new-password" minlength="8" maxlength="72" placeholder="Enter password again"></label>
          <button class="btn nero-auth-submit" id="nero-auth-submit" type="submit">Sign in</button></form><p class="nero-auth-message" id="nero-auth-message" role="status"></p></div>
      <div id="nero-auth-account-view" hidden><div class="nero-auth-profile"><div class="nero-auth-avatar" id="nero-auth-avatar">N</div><div><strong id="nero-auth-profile-name"></strong><small id="nero-auth-profile-email"></small></div></div>
        <p class="nero-auth-message" id="nero-auth-account-message"></p>
        <button class="ghost" id="nero-profile-edit-toggle" type="button" style="width:100%;margin-bottom:9px">Edit profile</button>
        <div id="nero-profile-editor" hidden>
          <label class="nero-auth-field">Display name<input id="nero-profile-display-name" maxlength="32" placeholder="How people see you"></label>
          <label class="nero-auth-field">Bio<input id="nero-profile-bio" maxlength="160" placeholder="A little about you"></label>
          <label class="nero-auth-field">Profile picture<input id="nero-profile-avatar-file" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <button class="btn nero-auth-submit" id="nero-profile-save" type="button">Save profile</button>
        </div>
        <button class="ghost" id="nero-auth-signout" type="button" style="width:100%">Sign out</button></div>
    </section>`;document.body.appendChild(overlay);
  const $=s=>document.querySelector(s);let mode='login',busy=false;
  function message(t,type=''){const el=$('#nero-auth-message');el.textContent=t;el.className='nero-auth-message '+type}
  function setMode(next){mode=next;$('#nero-auth-login-tab').classList.toggle('active',mode==='login');$('#nero-auth-signup-tab').classList.toggle('active',mode==='signup');$('#nero-auth-username-wrap').hidden=mode!=='signup';$('#nero-auth-username').required=mode==='signup';$('#nero-auth-login-username-wrap').hidden=mode!=='login';$('#nero-auth-login-username').required=mode==='login';$('#nero-auth-password').autocomplete=mode==='signup'?'new-password':'current-password';$('#nero-auth-confirm-wrap').hidden=mode!=='signup';$('#nero-auth-login-username').value='';$('#nero-auth-submit').textContent=mode==='signup'?'Create account':'Sign in';$('#nero-auth-title').textContent=mode==='signup'?'Create your NERO account':'Sign in to NERO';message('')}
  function show(open=true){overlay.classList.toggle('open',open);if(open){if(window.NERO_AUTH.user)renderAccount();else{$('#nero-auth-form-view').hidden=false;$('#nero-auth-account-view').hidden=true;$('#nero-auth-login-username').focus()}}}
  async function ensureProfile(user){if(!user)return null;let {data,error}=await client.from('profiles').select('id,username,display_name,bio,avatar_path').eq('id',user.id).maybeSingle();if(error)throw error;if(data)return data;
    const username=String(user.user_metadata?.username||'').trim();if(!/^[A-Za-z0-9_]{3,24}$/.test(username))return null;
    const made=await client.from('profiles').insert({id:user.id,username}).select('id,username,display_name,bio,avatar_path').single();if(made.error&&made.error.code!=='23505')throw made.error;if(made.data)return made.data;
    const retry=await client.from('profiles').select('id,username').eq('id',user.id).maybeSingle();if(retry.error)throw retry.error;return retry.data}
  function renderAccount(){const u=window.NERO_AUTH.user,p=window.NERO_AUTH.profile;accountButton.querySelector('.nero-account-label').textContent=u?(p?'@'+p.username:'Account'):'Account';
    if(!u)return;$('#nero-auth-form-view').hidden=true;$('#nero-auth-account-view').hidden=false;$('#nero-auth-profile-name').textContent=p?(p.display_name||'@'+p.username):'Profile setup needed';$('#nero-auth-profile-email').textContent='NERO account';$('#nero-auth-avatar').textContent=(p?.display_name||p?.username||'N').slice(0,1).toUpperCase();if(p?.avatar_path){$('#nero-auth-avatar').style.backgroundImage='url('+client.storage.from('profile-avatars').getPublicUrl(p.avatar_path).data.publicUrl+')';$('#nero-auth-avatar').style.backgroundSize='cover';$('#nero-auth-avatar').style.backgroundPosition='center';$('#nero-auth-avatar').textContent=''}else{$('#nero-auth-avatar').style.backgroundImage='none'}$('#nero-auth-account-message').textContent=p?'Your NERO account is active.':'Your account needs a valid username. Please contact support.'}
  async function refresh(u){window.NERO_AUTH.user=u||null;window.NERO_AUTH.profile=null;if(u){try{window.NERO_AUTH.profile=await ensureProfile(u)}catch(e){console.error('NERO profile:',e)}}
    renderAccount();window.dispatchEvent(new CustomEvent('nero:auth-change',{detail:{user:window.NERO_AUTH.user,profile:window.NERO_AUTH.profile}}))}
  accountButton.addEventListener('click',()=>show(true));$('#nero-auth-close').onclick=()=>show(false);overlay.addEventListener('click',e=>{if(e.target===overlay)show(false)});
  $('#nero-auth-login-tab').onclick=()=>setMode('login');$('#nero-auth-signup-tab').onclick=()=>setMode('signup');
  $('#nero-auth-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;const btn=$('#nero-auth-submit');btn.disabled=true;
    const password=$('#nero-auth-password').value,username=(mode==='signup'?$('#nero-auth-username').value:$('#nero-auth-login-username').value).trim();
    try{if(mode==='signup'){if(!/^[A-Za-z0-9_]{3,24}$/.test(username))throw new Error('Username must be 3–24 characters using letters, numbers, or underscores.');if(password.length<8)throw new Error('Password must be at least 8 characters.');if(password!==$('#nero-auth-confirm').value)throw new Error('Your passwords do not match.');
      const check=await client.from('profiles').select('id').ilike('username',username).limit(1);if(check.error)throw check.error;if(check.data?.length)throw new Error('That username is already taken.');
      const email=username.toLowerCase()+'@accounts.nero.invalid';const {data,error}=await client.auth.signUp({email,password,options:{data:{username}}});if(error)throw error;
      if(data.session){await refresh(data.user);show(false);return}message('Account created. Sign in with your username and password.','success');
    }else{if(!/^[A-Za-z0-9_]{3,24}$/.test(username))throw new Error('Enter a valid NERO username.');const email=username.toLowerCase()+'@accounts.nero.invalid';const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;await refresh(data.user);show(false)}}
    catch(err){const detail=err?.code==='email_provider_disabled'?'NERO signups are disabled in Supabase. Enable the Email provider in Authentication → Sign In / Providers.':(err.message||'Could not complete account request');message(detail,'error')}finally{busy=false;btn.disabled=false}});
  $('#nero-profile-edit-toggle').addEventListener('click',()=>{const panel=$('#nero-profile-editor');panel.hidden=!panel.hidden;const p=window.NERO_AUTH.profile||{};$('#nero-profile-display-name').value=p.display_name||'';$('#nero-profile-bio').value=p.bio||''});
  $('#nero-profile-save').addEventListener('click',async()=>{const u=window.NERO_AUTH.user,p=window.NERO_AUTH.profile;if(!u||!p)return;const btn=$('#nero-profile-save');btn.disabled=true;try{let avatar_path=p.avatar_path||null;const file=$('#nero-profile-avatar-file').files?.[0];if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024)throw new Error('Use a JPG, PNG, or WEBP image under 2 MB.');const path=u.id+'/'+crypto.randomUUID()+'.'+file.name.split('.').pop().toLowerCase();const {error:uploadError}=await client.storage.from('profile-avatars').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;avatar_path=path}
    const updates={display_name:$('#nero-profile-display-name').value.trim(),bio:$('#nero-profile-bio').value.trim(),avatar_path};const {error}=await client.from('profiles').update(updates).eq('id',u.id);if(error)throw error;await refresh(u);$('#nero-profile-editor').hidden=true;$('#nero-auth-account-message').textContent='Profile updated.'}catch(e){$('#nero-auth-account-message').textContent=e.message||'Could not update profile'}finally{btn.disabled=false}});
  $('#nero-auth-signout').onclick=async()=>{const {error}=await client.auth.signOut();if(error){$('#nero-auth-account-message').textContent=error.message;return}await refresh(null);show(false)};
  client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>refresh(session?.user||null),0)});
  $('#global-chat-join')?.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'Sign in to NERO to join the conversation'}),Object.assign(document.createElement('p'),{className:'hint',textContent:'Create an account or sign in to send messages, share images, and use @mentions.'}),Object.assign(document.createElement('button'),{className:'btn',id:'global-chat-account-btn',type:'button',textContent:'Sign in / Create account'}));
  $('#global-chat-account-btn')?.addEventListener('click',()=>show(true));
  client.auth.getSession().then(({data,error})=>{if(error)console.error(error);refresh(data?.session?.user||null)});
  window.NERO_ACCOUNT={open:()=>show(true),refresh};
})();