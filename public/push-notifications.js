(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const b64ToBytes=value=>{const pad='='.repeat((4-value.length%4)%4),raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  function status(text,type=''){const el=$('push-status');if(!el)return;el.textContent=text;el.dataset.type=type}
  async function api(path,opt={}){return window.__GS334Cloud.api(path,opt)}
  async function currentSubscription(){if(!('serviceWorker'in navigator)||!('PushManager'in window))return null;const reg=await navigator.serviceWorker.ready;return reg.pushManager.getSubscription()}
  function ensureBanner(){
    let el=document.querySelector('.gs334-inapp-banner');if(el)return el;
    el=document.createElement('div');el.className='gs334-inapp-banner';el.innerHTML='<div class="gs334-inapp-banner-icon">🔔</div><div><strong></strong><span></span></div><button type="button" aria-label="Đóng">×</button>';
    el.querySelector('button').onclick=()=>el.classList.remove('show');document.body.appendChild(el);return el;
  }
  function inApp(title,body){const el=ensureBanner();el.querySelector('strong').textContent=title;el.querySelector('span').textContent=body;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),4500)}
  async function systemNotify(title,body,data={}){
    try{const reg=await navigator.serviceWorker.ready;reg.active?.postMessage({type:'SHOW_NOTIFICATION',title,body,data});return true}catch{return false}
  }
  window.__GS334Notify={inApp,systemNotify,async event(title,body,data={}){inApp(title,body);return systemNotify(title,body,data)}};
  async function refresh(){
    const btn=$('push-toggle');if(!btn)return;
    if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){btn.disabled=true;status('Thiết bị này chưa hỗ trợ thông báo đẩy.','error');return}
    if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!standalone()){btn.disabled=false;btn.textContent='Xem cách cài app';status('Trên iPhone, hãy Thêm GS334 vào Màn hình chính rồi mở từ icon để bật thông báo.','warn');return}
    const sub=await currentSubscription();
    if(sub){btn.textContent='Tắt thông báo';btn.dataset.enabled='1';status('Thông báo đang bật. Nếu chỉ thấy số badge, vào Cài đặt iPhone → Thông báo → GS334 và bật Biểu ngữ.','ok')}
    else{btn.textContent='Bật thông báo đơn mới';btn.dataset.enabled='0';status(Notification.permission==='denied'?'Thông báo đang bị chặn trong Cài đặt của điện thoại.':'Nhận biểu ngữ khi có đơn mới hoặc khi một đơn bị xóa.',Notification.permission==='denied'?'error':'')}
  }
  async function toggle(){
    const btn=$('push-toggle');if(!btn)return;
    if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!standalone()){alert('Trên iPhone: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính. Sau đó mở GS334 từ icon và bấm Bật thông báo.');return}
    btn.disabled=true;
    try{
      const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
      if(sub){await api('/api/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe();status('Đã tắt thông báo trên thiết bị này.','ok')}
      else{
        const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Bạn chưa cho phép GS334 gửi thông báo');
        const key=await api('/api/push/vapid-public');sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(key.publicKey)});
        await api('/api/push/subscribe',{method:'POST',body:JSON.stringify({subscription:sub.toJSON()})});
        status('Đang gửi biểu ngữ thử từ máy chủ...','');
        const test=await api('/api/push/test',{method:'POST',body:'{}'});
        if(!test?.delivered)throw new Error('Máy chủ chưa gửi được Web Push tới thiết bị này');
        status('Đã bật. Biểu ngữ thử đã được gửi từ Cloudflare tới điện thoại.','ok');
      }
    }catch(e){status(e.message||'Không bật được thông báo','error')}finally{btn.disabled=false;refresh()}
  }
  addEventListener('DOMContentLoaded',()=>{const btn=$('push-toggle');if(btn)btn.addEventListener('click',toggle);setTimeout(refresh,800)});
})();
