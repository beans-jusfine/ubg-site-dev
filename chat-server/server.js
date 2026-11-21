const http=require('node:http'),express=require('express'),{Pool}=require('pg'),WebSocket=require('ws');
const PORT=Number(process.env.PORT||10000),DATABASE_URL=process.env.DATABASE_URL,app=express();
const allowed=o=>!o||o==='https://ubg-site-dev.pages.dev'||o==='https://nero-ubg.us.ci'||o==='https://ubg-site.pages.dev'||/^https:\/\/[a-z0-9-]+\.ubg-site-dev\.pages\.dev$/.test(o)||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
app.use((req,res,next)=>{const o=req.headers.origin;if(allowed(o)){res.setHeader('Access-Control-Allow-Origin',o||'*');res.setHeader('Vary','Origin')}res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS')return res.sendStatus(204);next()});
const pool=DATABASE_URL?new Pool({connectionString:DATABASE_URL,max:8,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,...(process.env.PGSSLMODE==='require'?{ssl:{rejectUnauthorized:false}}:{})}):null;
let dbReady=false;
async function initDb(){if(!pool)return;await pool.query("CREATE TABLE IF NOT EXISTS chat_messages(id BIGSERIAL PRIMARY KEY,guest_id VARCHAR(80) NOT NULL,username VARCHAR(24) NOT NULL,content VARCHAR(500) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at DESC);");dbReady=true;console.log('NERO Chat database ready')}
function format(r){return{id:String(r.id),guestId:r.guest_id,username:r.username,content:r.content,createdAt:r.created_at}}
app.get('/',(_q,s)=>s.json({service:'NERO Chat API',ok:true,database:dbReady,websocket:'/chat',health:'/health'}));
app.get('/health',(_q,s)=>s.json({ok:true,databaseConfigured:Boolean(DATABASE_URL),database:dbReady}));
app.get('/messages',async(q,s)=>{if(!dbReady)return s.status(503).json({error:'Chat database is not configured yet'});const limit=Math.max(1,Math.min(100,parseInt(q.query.limit,10)||80));try{const r=await pool.query('SELECT id,guest_id,username,content,created_at FROM chat_messages ORDER BY id DESC LIMIT $1',[limit]);s.json({messages:r.rows.reverse().map(format)})}catch(e){console.error('History query:',e.message);s.status(500).json({error:'Could not load messages'})}});
const server=http.createServer(app),wss=new WebSocket.Server({noServer:true,maxPayload:4096}),rates=new Map();
server.on('upgrade',(req,sock,head)=>{if(!allowed(req.headers.origin)||req.url!=='/chat'){sock.write('HTTP/1.1 403 Forbidden\r\n\r\n');sock.destroy();return}if(!dbReady){sock.write('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 15\r\n\r\n');sock.destroy();return}wss.handleUpgrade(req,sock,head,ws=>wss.emit('connection',ws,req))});
function error(ws,msg){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'error',message:msg}))}
wss.on('connection',(ws,req)=>{ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);ws.on('message',async raw=>{
 let d;try{d=JSON.parse(raw.toString())}catch{return error(ws,'Invalid message')}
 if(d.type==='join'){const username=String(d.username||'').trim().replace(/\s+/g,' '),guestId=String(d.guestId||'').slice(0,80);if(!username||username.length>24||/[\u0000-\u001f\u007f]/.test(username)||!guestId)return error(ws,'Choose a valid display name (1–24 characters)');ws.username=username;ws.guestId=guestId;ws.ip=req.socket.remoteAddress||'unknown';ws.joined=true;ws.send(JSON.stringify({type:'ready',username}));return}
 if(d.type!=='message'||!ws.joined)return;const content=String(d.content||'').trim();if(!content||content.length>500)return error(ws,'Messages must be 1–500 characters');
 const now=Date.now(),recent=(rates.get(ws.ip)||[]).filter(t=>now-t<5000);if(recent.length>=5)return error(ws,'Slow down a little before sending again');recent.push(now);rates.set(ws.ip,recent);
 try{const r=await pool.query('INSERT INTO chat_messages(guest_id,username,content) VALUES($1,$2,$3) RETURNING id,guest_id,username,content,created_at',[ws.guestId,ws.username,content]);const packet=JSON.stringify({type:'message',message:format(r.rows[0])});for(const c of wss.clients)if(c.readyState===WebSocket.OPEN&&c.joined)c.send(packet)}catch(e){console.error('Message save:',e.message);error(ws,'Message could not be saved. Try again')}
 });ws.on('close',()=>ws.joined=false)});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);
server.listen(PORT,async()=>{console.log('NERO Chat listening on '+PORT);try{await initDb()}catch(e){console.error('Database initialization failed:',e.message)}});
process.on('SIGTERM',async()=>{clearInterval(heartbeat);server.close();if(pool)await pool.end()});
