const CACHE = 'gs334-v6.3.1-staff-print-fix';
const APP_SHELL = [
  '/', '/index.html', '/styles.css', '/mobile-v2.css', '/mobile-v3.css', '/cloud-api.js', '/renderer.js','/raster-print.js', '/cloud-overrides.js',
  '/install-app.js', '/app-mode.js', '/push-notifications.js', '/press-feedback.js', '/mobile-shell.js', '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='SHOW_NOTIFICATION'){
    const d=event.data||{};
    event.waitUntil(self.registration.showNotification(d.title||'GS334',{body:d.body||'',icon:'/icon-192.png',badge:'/icon-192.png',tag:'gs334-local-'+Date.now(),renotify:true,data:d.data||{url:'/'}}));
  }
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate'){event.respondWith((async()=>{try{const r=await fetch(event.request);const c=await caches.open(CACHE);c.put('/index.html',r.clone());return r}catch{return(await caches.match('/index.html'))||(await caches.match('/'))}})());return}
  event.respondWith((async()=>{const cached=await caches.match(event.request);const network=fetch(event.request).then(async r=>{if(r.ok){const c=await caches.open(CACHE);c.put(event.request,r.clone())}return r}).catch(()=>null);return cached||await network||new Response('',{status:504})})());
});
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let info={title:'GS334 · Có cập nhật tại tiệm',body:'Mở GS334 để xem chi tiết.',url:'/?open=orders',type:'generic'};
    try{
      const sub=await self.registration.pushManager.getSubscription();
      if(sub){const r=await fetch('/api/push/latest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint}),cache:'no-store'});const b=await r.json();if(r.ok&&b.event)info={...info,...b.event}}
    }catch{}
    try{if(self.navigator?.setAppBadge)await self.navigator.setAppBadge(1)}catch{}
    await self.registration.showNotification(info.title||'GS334',{body:info.body||'Có đơn hàng mới.',icon:'/icon-192.png',badge:'/icon-192.png',tag:(info.type||'order')+'-'+(info.orderId||Date.now()),renotify:true,silent:false,timestamp:Date.now(),lang:'vi',dir:'ltr',data:{url:info.url||'/?open=orders',orderId:info.orderId||''}});
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();event.waitUntil((async()=>{try{if(self.navigator?.clearAppBadge)await self.navigator.clearAppBadge()}catch{}const target=new URL(event.notification.data?.url||'/?open=orders',self.location.origin).href;const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const c of clients){if('focus'in c){await c.focus();c.navigate(target);return}}if(self.clients.openWindow)await self.clients.openWindow(target)})());
});
