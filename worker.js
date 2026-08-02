const SESSION_DAYS = 180;
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8",...headers}});
const nowIso = () => new Date().toISOString();
const VAPID = {
  publicKey: "BMAaXRg_wjoBgePq8r7Qv0PPCYNGvPtYVsW2RsgoS_IWrr9cA2BBEG4MOKfdIrU60tpHiGUdfYs3hkHqbHmYhYM",
  jwk: {kty:"EC",crv:"P-256",x:"wBpdGD_COgGB4-ryvtC_Q88Jg0a8-1hWxbZGyChL8hY",y:"rr9cA2BBEG4MOKfdIrU60tpHiGUdfYs3hkHqbHmYhYM",d:"mq3eyUS0KpUz0oZenpIZvOTY3X3PezMdiLAXswXISzI",ext:true},
  subject: "mailto:admin@giatsay334.vn"
};
const b64u = bytes => {let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const utf8b64u = value => b64u(new TextEncoder().encode(JSON.stringify(value)));
async function vapidJwt(endpoint){
  const aud=new URL(endpoint).origin,exp=Math.floor(Date.now()/1000)+60*60*12;
  const unsigned=utf8b64u({typ:'JWT',alg:'ES256'})+'.'+utf8b64u({aud,exp,sub:VAPID.subject});
  const key=await crypto.subtle.importKey('jwk',VAPID.jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(unsigned)));
  return unsigned+'.'+b64u(sig);
}
async function sendEmptyPush(env,sub,eventId=''){
  const sentAt=nowIso();
  try{
    const token=await vapidJwt(sub.endpoint);
    const headers={
      TTL:'120',
      Urgency:'high',
      Topic:'gs334-order',
      Authorization:`vapid t=${token}, k=${VAPID.publicKey}`
    };
    const r=await fetch(sub.endpoint,{method:'POST',headers,body:new Uint8Array(0)});
    const responseText=await r.text().catch(()=>"");
    const apnsId=r.headers.get('apns-id')||'';
    await env.DB.prepare('INSERT INTO push_delivery_logs(id,event_id,endpoint,status,ok,apns_id,response,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(uuid(),eventId,sub.endpoint,r.status,r.ok?1:0,apnsId,responseText.slice(0,500),sentAt).run();
    if(r.status===404||r.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(sub.endpoint).run();
    return {ok:r.ok,status:r.status,apnsId,response:responseText};
  }catch(e){
    await env.DB.prepare('INSERT INTO push_delivery_logs(id,event_id,endpoint,status,ok,apns_id,response,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(uuid(),eventId,sub.endpoint,0,0,'',String(e?.message||e).slice(0,500),sentAt).run().catch(()=>{});
    console.error('push',e);return {ok:false,status:0,response:String(e?.message||e)}
  }
}
async function publishPush(env,event){
  const id=uuid(),createdAt=nowIso();
  await env.DB.prepare('INSERT INTO push_events(id,payload,created_at) VALUES(?,?,?)').bind(id,JSON.stringify(event),createdAt).run();
  const rows=await env.DB.prepare("SELECT endpoint,subscription FROM push_subscriptions").all();
  for(const row of rows.results||[]){
    await env.DB.prepare('INSERT OR REPLACE INTO push_event_deliveries(endpoint,event_id,created_at,consumed_at) VALUES(?,?,?,NULL)').bind(row.endpoint,id,createdAt).run();
  }
  const results=await Promise.all((rows.results||[]).map(row=>sendEmptyPush(env,JSON.parse(row.subscription),id)));
  return {eventId:id,total:results.length,delivered:results.filter(x=>x.ok).length,results};
}
function orderEvents(before,after){
  const old=new Map((before.orders||[]).map(o=>[o.id,o]));
  const next=new Map((after.orders||[]).map(o=>[o.id,o]));
  const events=[];
  const formatMoney=value=>`${new Intl.NumberFormat('vi-VN').format(Number(value||0))}đ`;

  // Chỉ thông báo khi có đơn mới. Việc đổi trạng thái hoặc chỉnh sửa đơn không gửi push.
  for(const o of after.orders||[]){
    if(!old.has(o.id))events.push({
      type:'new-order',
      title:'GS334 · Có đơn hàng mới',
      body:`${o.customerName||'Khách lẻ'} · ${formatMoney(o.total)}`,
      orderId:o.id,
      orderCode:o.code||'',
      url:`/?open=orders&order=${encodeURIComponent(o.id||'')}`
    });
  }

  // Mỗi đơn bị xóa tạo đúng một thông báo, kèm tên khách và tổng tiền của đơn đó.
  for(const o of before.orders||[]){
    if(!next.has(o.id))events.push({
      type:'deleted-order',
      title:'GS334 · Có 1 đơn hàng đã được xóa',
      body:`${o.customerName||'Khách lẻ'} · ${formatMoney(o.total)}`,
      orderId:o.id,
      orderCode:o.code||'',
      url:'/?open=orders'
    });
  }
  return events;
}


async function sha256(text){const bytes=new TextEncoder().encode(String(text));const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function uuid(){return crypto.randomUUID()}
function defaultData(){return {version:4,settings:{shopName:"GIẶT SẤY 334",phone:"",address:"",paperWidth:"80",printerName:"",labelPrinterName:"",autoPrint:true,shopCode:"GS334",customPaperWidth:58,paperHeightMode:"auto",fixedPaperHeight:150,receiptMarginTop:3,receiptMarginRight:4,receiptMarginBottom:3,receiptMarginLeft:4,receiptScale:100,receiptFeedBottom:0,receiptCopies:1,receiptCutBetweenCopies:true,receiptFinalCut:true,receiptCutMode:"full",receiptFeedBeforeCut:3,receiptShowCopyLabel:true,receiptCopy1Label:"PHIẾU KHÁCH",receiptCopy2Label:"PHIẾU TIỆM",receiptCopy3Label:"PHIẾU LƯU",receiptFont:"Arial",receiptFontSize:12,receiptTitleSize:20,receiptTitleBold:true,receiptTitleItalic:false,receiptCompact:false,receiptHeaderText:"",receiptFooter:"Cảm ơn quý khách!",receiptBottomNote:"Vui lòng giữ phiếu để nhận đồ.",receiptShowShopName:true,receiptShowAddress:true,receiptShowPhone:true,receiptShowHeaderText:false,receiptShowOrderDate:true,receiptShowCustomer:true,receiptShowCustomerPhone:true,receiptShowDueDate:true,receiptShowNote:true,receiptShowPaid:true,receiptShowFooter:true,receiptShowBottomNote:true,recoveryCode:"GS334-CHUTIEM-2026"},users:[{id:"user-admin",username:"admin",displayName:"Chủ tiệm",role:"admin",passwordHash:"32061d15a18f947686897b71824d0a2431197d30db6323c2048499d65e382bb3",active:true},{id:"user-staff",username:"nhanvien",displayName:"Nhân viên",role:"staff",passwordHash:"8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",active:true}],services:[{id:"svc-1",name:"Giặt sấy",unit:"kg",price:12000,active:true},{id:"svc-2",name:"Sấy riêng",unit:"kg",price:8000,active:true},{id:"svc-3",name:"Giặt chăn",unit:"cái",price:40000,active:true},{id:"svc-4",name:"Giặt giày",unit:"đôi",price:50000,active:true}],orders:[],conversations:[],messaging:{demoMode:true,zalo:{connected:false,accountName:""},facebook:{connected:false,accountName:""},autoReceived:true,autoReady:true,templates:{received:"{shop} đã tiếp nhận đơn {orderCode}. Dự kiến trả: {dueDate}.",ready:"Đơn {orderCode} đã hoàn thành. Mình có thể đến nhận đồ rồi ạ.",thanks:"Cảm ơn mình đã sử dụng dịch vụ của {shop} ạ!"},customTemplates:[]},promotions:[],auditLogs:[]}}

async function ensureDb(env){
 await env.DB.exec(`CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS print_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', error TEXT, created_at TEXT NOT NULL, claimed_at TEXT, completed_at TEXT);CREATE TABLE IF NOT EXISTS print_gateway (id INTEGER PRIMARY KEY CHECK(id=1), last_seen TEXT NOT NULL, info TEXT);CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, subscription TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS push_events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS push_delivery_logs (id TEXT PRIMARY KEY, event_id TEXT, endpoint TEXT NOT NULL, status INTEGER NOT NULL DEFAULT 0, ok INTEGER NOT NULL DEFAULT 0, apns_id TEXT, response TEXT, created_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS push_event_deliveries (endpoint TEXT NOT NULL,event_id TEXT NOT NULL,created_at TEXT NOT NULL,consumed_at TEXT,PRIMARY KEY(endpoint,event_id));`);
 const row=await env.DB.prepare("SELECT id FROM app_state WHERE id=1").first();
 if(!row){const data=defaultData();await env.DB.prepare("INSERT INTO app_state(id,data,revision,updated_at) VALUES(1,?,1,?)").bind(JSON.stringify(data),nowIso()).run()}
}
async function readState(env){const row=await env.DB.prepare("SELECT data,revision FROM app_state WHERE id=1").first();return {data:JSON.parse(row.data),revision:Number(row.revision||1)}}
async function auth(request,env){const raw=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!raw)return null;const tokenHash=await sha256(raw);const session=await env.DB.prepare("SELECT user_id,expires_at FROM sessions WHERE token_hash=?").bind(tokenHash).first();if(!session||new Date(session.expires_at)<=new Date())return null;const state=await readState(env);const user=(state.data.users||[]).find(u=>u.id===session.user_id&&u.active!==false);return user?{user,state,tokenHash}:null}
function publicUser(user){const {passwordHash,...safe}=user;return safe}

function sameJson(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function sanitizeStaffData(current,incoming,user){
 const protectedKeys=["settings","users","services","promotions","messaging"];
 for(const key of protectedKeys){if(!sameJson(incoming[key],current[key]))throw new Error(`STAFF_FORBIDDEN:${key}`)}
 const oldOrders=new Map((current.orders||[]).map(o=>[o.id,o]));
 const nextOrders=Array.isArray(incoming.orders)?incoming.orders:[];
 const nextIds=new Set(nextOrders.map(o=>o.id));
 for(const old of oldOrders.values())if(!nextIds.has(old.id))throw new Error("STAFF_FORBIDDEN:delete_order");
 const allowedChange=new Set(["status","readyAt","closedAt"]);
 for(const order of nextOrders){
  const old=oldOrders.get(order.id);
  if(!old){
   if(order.status==="Đã hủy")throw new Error("STAFF_FORBIDDEN:cancel_order");
   const items=Array.isArray(order.items)?order.items:[];
   for(const item of items){const svc=(current.services||[]).find(s=>s.id===item.serviceId&&s.active!==false);if(!svc)throw new Error("STAFF_FORBIDDEN:invalid_service");item.price=Number(svc.price||0);item.name=svc.name;item.unit=svc.unit;item.total=Number(item.quantity||0)*item.price}
   order.subtotal=items.reduce((sum,i)=>sum+Number(i.total||0),0);
   order.total=Math.max(0,order.subtotal-Number(order.discount||0));
   order.createdBy=user.id;
   continue;
  }
  if(order.status==="Đã hủy"&&old.status!=="Đã hủy")throw new Error("STAFF_FORBIDDEN:cancel_order");
  for(const key of new Set([...Object.keys(old),...Object.keys(order)])){if(allowedChange.has(key))continue;if(!sameJson(order[key],old[key]))throw new Error(`STAFF_FORBIDDEN:order_${key}`)}
 }
 return incoming;
}

export default {async fetch(request,env){
 try{
  await ensureDb(env);
  const url=new URL(request.url),p=url.pathname;
  if(p==="/api/health")return json({ok:true,service:"GS334 Cloud",time:nowIso()});
  if(p==="/api/login"&&request.method==="POST"){
   const {username="",password=""}=await request.json();const state=await readState(env);const user=(state.data.users||[]).find(u=>String(u.username).toLowerCase()===String(username).trim().toLowerCase()&&u.active!==false);
   if(!user||user.passwordHash!==await sha256(password))return json({ok:false,error:"Sai tài khoản hoặc mật khẩu"},401);
   const token=uuid()+uuid(),tokenHash=await sha256(token),expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
   await env.DB.prepare("INSERT OR REPLACE INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(tokenHash,user.id,expires,nowIso()).run();
   return json({ok:true,token,user:publicUser(user),data:state.data,revision:state.revision});
  }
  if(p==="/api/recover"&&request.method==="POST"){
   const {username="",code="",password=""}=await request.json();if(String(password).length<6)return json({error:"Mật khẩu phải có ít nhất 6 ký tự"},400);
   const state=await readState(env);if(String(state.data.settings?.recoveryCode||"").toUpperCase()!==String(code).trim().toUpperCase())return json({error:"Mã khôi phục không đúng"},403);
   const user=(state.data.users||[]).find(u=>String(u.username).toLowerCase()===String(username).trim().toLowerCase());if(!user)return json({error:"Không tìm thấy tài khoản"},404);
   user.passwordHash=await sha256(password);user.active=true;await env.DB.prepare("UPDATE app_state SET data=?,revision=revision+1,updated_at=? WHERE id=1").bind(JSON.stringify(state.data),nowIso()).run();return json({ok:true});
  }
  if(p==="/api/push/latest"&&request.method==="POST"){
   const body=await request.json().catch(()=>({}));
   const endpoint=String(body.endpoint||"");
   if(!endpoint)return json({error:"Thiếu endpoint"},400);
   const sub=await env.DB.prepare("SELECT endpoint FROM push_subscriptions WHERE endpoint=?").bind(endpoint).first();
   if(!sub)return json({error:"Thiết bị chưa đăng ký"},403);
   const row=await env.DB.prepare("SELECT d.event_id,e.payload,e.created_at FROM push_event_deliveries d JOIN push_events e ON e.id=d.event_id WHERE d.endpoint=? AND d.consumed_at IS NULL ORDER BY d.created_at ASC LIMIT 1").bind(endpoint).first();
   if(!row)return json({ok:true,event:null});
   await env.DB.prepare("UPDATE push_event_deliveries SET consumed_at=? WHERE endpoint=? AND event_id=?").bind(nowIso(),endpoint,row.event_id).run();
   return json({ok:true,event:JSON.parse(row.payload),eventId:row.event_id,createdAt:row.created_at});
  }
  const session=await auth(request,env);if(!session&&p.startsWith("/api/"))return json({error:"Phiên đăng nhập đã hết hạn"},401);
  if(p==="/api/session")return json({ok:true,user:publicUser(session.user),data:session.state.data,revision:session.state.revision});
  if(p==="/api/data"&&request.method==="GET")return json({ok:true,data:session.state.data,revision:session.state.revision});
  if(p==="/api/push/vapid-public"&&request.method==="GET")return json({ok:true,publicKey:VAPID.publicKey});
  if(p==="/api/push/subscribe"&&request.method==="POST"){
   if(session.user.role!=="admin")return json({error:"Chỉ chủ tiệm được bật thông báo"},403);
   const body=await request.json(),sub=body.subscription||body;if(!sub?.endpoint)return json({error:"Subscription không hợp lệ"},400);
   await env.DB.prepare("INSERT INTO push_subscriptions(endpoint,user_id,subscription,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,subscription=excluded.subscription,updated_at=excluded.updated_at").bind(sub.endpoint,session.user.id,JSON.stringify(sub),nowIso(),nowIso()).run();
   return json({ok:true});
  }
  if(p==="/api/push/unsubscribe"&&request.method==="POST"){const body=await request.json();if(body.endpoint)await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?").bind(body.endpoint,session.user.id).run();return json({ok:true})}
  if(p==="/api/push/test"&&request.method==="POST"){
   if(session.user.role!=="admin")return json({error:"Chỉ chủ tiệm được thử thông báo"},403);
   const event={type:'test',title:'GS334 · Thông báo đã hoạt động',body:'Đây là biểu ngữ gửi từ Cloudflare tới điện thoại, không phải thông báo nội bộ.',url:'/?open=dashboard'};
   const result=await publishPush(env,event);
   return json({ok:result.delivered>0,...result},result.delivered>0?200:502);
  }
  if(p==="/api/push/diagnostics"&&request.method==="GET"){
   if(session.user.role!=="admin")return json({error:"Không có quyền"},403);
   const subscriptionCount=await env.DB.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').first();
   const logs=await env.DB.prepare('SELECT status,ok,apns_id,response,created_at FROM push_delivery_logs ORDER BY created_at DESC LIMIT 10').all();
   return json({ok:true,subscriptions:Number(subscriptionCount?.count||0),deliveries:logs.results||[]});
  }
  if(p==="/api/push/order-created"&&request.method==="POST"){
   const body=await request.json().catch(()=>({}));const order=(session.state.data.orders||[]).find(o=>o.id===body.orderId);
   if(!order)return json({error:"Không tìm thấy đơn để gửi thông báo"},404);
   const event={type:'new-order',title:'GS334 · Có đơn mới',body:`${order.code||'Đơn mới'} · ${order.customerName||'Khách lẻ'} · ${new Intl.NumberFormat('vi-VN').format(Number(order.total||0))}đ`,orderId:order.id,orderCode:order.code||'',url:`/?open=orders&order=${encodeURIComponent(order.id||'')}`};
   await publishPush(env,event);return json({ok:true});
  }
  if(p==="/api/print/status"&&request.method==="GET"){
   const gateway=await env.DB.prepare("SELECT last_seen,info FROM print_gateway WHERE id=1").first();
   const pending=await env.DB.prepare("SELECT COUNT(*) AS count FROM print_jobs WHERE status IN ('pending','processing')").first();
   const last=await env.DB.prepare("SELECT status,error,completed_at FROM print_jobs ORDER BY created_at DESC LIMIT 1").first();
   const online=Boolean(gateway&&Date.now()-new Date(gateway.last_seen).getTime()<15000);
   return json({ok:true,online,lastSeen:gateway?.last_seen||null,pending:Number(pending?.count||0),last:last||null});
  }
  if(p==="/api/print/jobs"&&request.method==="POST"){
   // Cả chủ tiệm và nhân viên đều được gửi lệnh in. Các API quản trị
   // Gateway (heartbeat/claim/complete) vẫn giữ quyền admin riêng bên dưới.
   const body=await request.json();const kind=String(body.kind||body.type||"receipt");
   if(!["receipt","label","test"].includes(kind))return json({error:"Loại lệnh in không hợp lệ"},400);
   const id=uuid();await env.DB.prepare("INSERT INTO print_jobs(id,kind,payload,status,created_at) VALUES(?,?,?,'pending',?)").bind(id,kind,JSON.stringify(body.payload||body),nowIso()).run();
   return json({ok:true,id,message:"Đã đưa lệnh in vào hàng đợi"});
  }
  if(p==="/api/print/gateway/heartbeat"&&request.method==="POST"){
   if(session.user.role!=="admin")return json({error:"Không có quyền"},403);
   const body=await request.json().catch(()=>({}));await env.DB.prepare("INSERT INTO print_gateway(id,last_seen,info) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,info=excluded.info").bind(nowIso(),JSON.stringify(body)).run();return json({ok:true});
  }
  if(p==="/api/print/jobs/next"&&request.method==="GET"){
   if(session.user.role!=="admin")return json({error:"Không có quyền"},403);
   const job=await env.DB.prepare("SELECT id,kind,payload FROM print_jobs WHERE status='pending' ORDER BY created_at LIMIT 1").first();
   if(!job)return json({ok:true,job:null});
   await env.DB.prepare("UPDATE print_jobs SET status='processing',claimed_at=? WHERE id=? AND status='pending'").bind(nowIso(),job.id).run();
   return json({ok:true,job:{id:job.id,kind:job.kind,payload:JSON.parse(job.payload)}});
  }
  if(p.startsWith("/api/print/jobs/")&&p.endsWith("/complete")&&request.method==="POST"){
   if(session.user.role!=="admin")return json({error:"Không có quyền"},403);
   const id=p.split("/")[4],body=await request.json();await env.DB.prepare("UPDATE print_jobs SET status=?,error=?,completed_at=? WHERE id=?").bind(body.ok?"done":"failed",body.error||null,nowIso(),id).run();return json({ok:true});
  }
  if(p==="/api/data"&&request.method==="PUT"){
   const body=await request.json();if(!body.data||typeof body.data!=="object")return json({error:"Dữ liệu không hợp lệ"},400);
   let nextData=body.data;
   if(session.user.role!=="admin"){
    try{nextData=sanitizeStaffData(session.state.data,structuredClone(body.data),session.user)}
    catch(error){if(String(error.message||"").startsWith("STAFF_FORBIDDEN:"))return json({error:"Tài khoản nhân viên không có quyền thực hiện thao tác này"},403);throw error}
   }
   const events=orderEvents(session.state.data,nextData);
   const nextRev=session.state.revision+1;await env.DB.prepare("UPDATE app_state SET data=?,revision=?,updated_at=? WHERE id=1").bind(JSON.stringify(nextData),nextRev,nowIso()).run();
   for(const event of events)await publishPush(env,event);
   return json({ok:true,revision:nextRev});
  }
  if(p==="/api/logout"&&request.method==="POST"){await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(session.tokenHash).run();return json({ok:true})}
  return env.ASSETS.fetch(request);
 }catch(e){console.error(e);return json({error:e.message||"Lỗi máy chủ"},500)}
}};
