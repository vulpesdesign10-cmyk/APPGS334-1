(() => {
  const SVG = {
    dashboard:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6"/></svg>',
    orders:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    'new-order':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    messages:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    services:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10M7 20h10M9 4c-2 3-2 13 0 16M15 4c2 3 2 13 0 16M6 8h12M6 16h12"/></svg>',
    promotions:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 19 14-14M7.5 5.5h.01M16.5 18.5h.01"/><circle cx="7.5" cy="5.5" r="2.5"/><circle cx="16.5" cy="18.5" r="2.5"/></svg>',
    users:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5"/></svg>',
    connections:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
    settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z" transform="scale(.8) translate(3 3)"/></svg>',
    more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
    menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    logout:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></svg>'
  };
  const isMobile = () => matchMedia('(max-width: 900px)').matches;
  const icon = (name) => `<span class="mobile-svg-icon">${SVG[name] || SVG.more}</span>`;

  function normalizeIcons(){
    document.querySelectorAll('.sidebar .nav-item').forEach(btn=>{
      const slot=btn.querySelector('.nav-icon');
      if(slot) slot.innerHTML=SVG[btn.dataset.page]||SVG.more;
    });
  }

  function buildMobileChrome(){
    if(document.getElementById('mobile-app-header')) return;
    const shell=document.getElementById('app-shell');
    const main=document.querySelector('.main-content');
    const header=document.createElement('header');
    header.id='mobile-app-header';
    header.className='mobile-app-header';
    header.innerHTML=`<button id="mobile-menu-open" class="mobile-icon-button" aria-label="Mở menu">${icon('menu')}</button><div class="mobile-app-brand"><strong>GS334 Cloud</strong></div><span class="mobile-header-spacer" aria-hidden="true"></span>`;
    main.prepend(header);

    const backdrop=document.createElement('div');
    backdrop.id='mobile-drawer-backdrop';backdrop.className='mobile-drawer-backdrop';
    const drawer=document.createElement('aside');
    drawer.id='mobile-drawer';drawer.className='mobile-drawer';
    const items=[
      ['dashboard','Tổng quan'],['orders','Đơn giặt'],['new-order','Tạo đơn mới'],['services','Dịch vụ & giá'],['promotions','Khuyến mãi'],['users','Nhân viên'],['connections','Tin nhắn & mẫu'],['settings','Máy in & cài đặt']
    ];
    drawer.innerHTML=`<div class="mobile-drawer-profile"><div class="mobile-avatar">334</div><div><strong id="mobile-drawer-name">Admin</strong><span id="mobile-drawer-role">Chủ tiệm</span></div></div><nav class="mobile-drawer-nav">${items.map(([p,t])=>`<button type="button" data-mobile-page="${p}" class="${['services','promotions','users','connections','settings'].includes(p)?'admin-only':''}">${icon(p)}<span>${t}</span><b>›</b></button>`).join('')}</nav><button id="mobile-drawer-logout" class="mobile-drawer-logout" type="button">${icon('logout')}<span>Đăng xuất</span></button>`;
    shell.append(backdrop,drawer);

    const bottom=document.createElement('nav');
    bottom.id='mobile-bottom-nav';bottom.className='mobile-bottom-nav';
    bottom.innerHTML=[['dashboard','Tổng quan'],['orders','Đơn giặt'],['new-order','Tạo đơn'],['messages','Tin nhắn']].map(([p,t])=>`<button data-mobile-page="${p}" type="button">${icon(p)}<span>${t}</span></button>`).join('')+`<button id="mobile-more-button" type="button">${icon('more')}<span>Thêm</span></button>`;
    shell.append(bottom);

    const open=()=>{drawer.classList.add('open');backdrop.classList.add('open');document.body.classList.add('drawer-open')};
    const close=()=>{drawer.classList.remove('open');backdrop.classList.remove('open');document.body.classList.remove('drawer-open')};
    document.getElementById('mobile-menu-open').onclick=open;
    document.getElementById('mobile-more-button').onclick=open;
    backdrop.onclick=close;
    const doLogout=()=>{const b=document.getElementById('logout-button'); if(b) b.click(); else if(typeof logout==='function') logout();};
    document.getElementById('mobile-drawer-logout').onclick=doLogout;
    document.querySelectorAll('[data-mobile-page]').forEach(btn=>btn.onclick=()=>{if(typeof navigate==='function')navigate(btn.dataset.mobilePage);syncMobileState(btn.dataset.mobilePage);close();});
  }


  function applyMobileRoleAccess(role){
    const normalized=String(role||document.getElementById("current-user-role")?.textContent||"").trim().toLowerCase();
    const isAdminRole=normalized==="admin" || normalized==="chủ tiệm" || normalized==="chu tiem";
    document.body.dataset.gs334Role=isAdminRole?"admin":"staff";
    document.querySelectorAll("#mobile-drawer .admin-only").forEach(btn=>{
      btn.classList.toggle("hidden",!isAdminRole);
      btn.hidden=!isAdminRole;
      btn.setAttribute("aria-hidden",String(!isAdminRole));
      btn.tabIndex=isAdminRole?0:-1;
      btn.style.setProperty("display",isAdminRole?"":"none",isAdminRole?"":"important");
    });
    const activePage=document.querySelector(".page.active")?.id?.replace("page-","")||"dashboard";
    if(!isAdminRole && ["services","promotions","users","connections","settings"].includes(activePage) && typeof navigate==="function") navigate("dashboard");
  }

  function syncMobileState(page){
    document.querySelectorAll('#mobile-bottom-nav [data-mobile-page],#mobile-drawer [data-mobile-page]').forEach(b=>b.classList.toggle('active',b.dataset.mobilePage===page));
    const title=document.getElementById('page-title')?.textContent||'GS334';
    const appBrand=document.querySelector('.mobile-app-brand strong');
    if(appBrand) appBrand.textContent=page==='dashboard'?'GS334 Cloud':title;
    const name=document.getElementById('current-user-name')?.textContent;
    const role=document.getElementById('current-user-role')?.textContent;
    if(name) document.getElementById('mobile-drawer-name').textContent=name;
    if(role) document.getElementById('mobile-drawer-role').textContent=role;
    applyMobileRoleAccess(role==="Chủ tiệm"?"admin":"staff");
  }

  function patchNavigate(){
    if(typeof navigate!=='function'||navigate.__mobilePatched)return;
    const original=navigate;
    navigate=function(page){const result=original(page);requestAnimationFrame(()=>syncMobileState(page));return result};
    navigate.__mobilePatched=true;
  }

  function enhanceOrderCards(){
    const list=document.getElementById('orders-mobile-list');
    if(!list||list.dataset.enhanced==='1') return;
    list.dataset.enhanced='1';
    const observer=new MutationObserver(()=>{
      list.querySelectorAll('.mobile-order-card').forEach(card=>{
        const view=card.querySelector('[data-view]');
        if(view&&!view.dataset.compact){view.dataset.compact='1';view.textContent='Chi tiết';}
      });
    });
    observer.observe(list,{childList:true,subtree:true});
  }

  function boot(){normalizeIcons();buildMobileChrome();patchNavigate();enhanceOrderCards();syncMobileState('dashboard');applyMobileRoleAccess();}
  document.addEventListener('gs334:role-applied',e=>applyMobileRoleAccess(e.detail?.role));
  const roleObserver=new MutationObserver(()=>applyMobileRoleAccess());
  document.addEventListener('DOMContentLoaded',()=>{const r=document.getElementById('current-user-role');if(r)roleObserver.observe(r,{childList:true,characterData:true,subtree:true});});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  addEventListener('resize',()=>{if(isMobile())syncMobileState(document.querySelector('.page.active')?.id?.replace('page-','')||'dashboard')});
})();
