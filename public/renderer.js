let appData=null,currentUser=null,currentOrderItems=[];
let dataRevision=0;
let selectedOrderIds=new Set();
let activeConversationId=null;
const ORDERS_PAGE_SIZE=50;
let currentOrdersPage=1;
const statuses=["Đã nhận","Đang giặt","Đang sấy","Chờ khách lấy","Hoàn thành","Đã hủy"];
const $=id=>document.getElementById(id);
const money=v=>new Intl.NumberFormat("vi-VN").format(Number(v||0))+"đ";
const esc=(v="")=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
function toast(msg){const e=$("toast");e.textContent=msg;e.classList.remove("hidden");clearTimeout(window.__t);window.__t=setTimeout(()=>e.classList.add("hidden"),2500)}
async function persist(){dataRevision++;await window.posAPI.saveData(appData)}
function audit(action,detail){appData.auditLogs.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),userId:currentUser?.id||"",userName:currentUser?.displayName||"",action,detail});appData.auditLogs=appData.auditLogs.slice(0,3000)}

function generateRecoveryCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const part=()=>Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join("");return `GS334-${part()}-${part()}-${part()}`}
function ensureSecurityData(){appData.settings=appData.settings||{};if(!appData.settings.recoveryCode)appData.settings.recoveryCode=generateRecoveryCode();appData.users=(appData.users||[]).map(u=>({...u,active:u.active!==false}));if(!Array.isArray(appData.auditLogs))appData.auditLogs=[]}
function closeAccountModal(){$("account-modal").classList.add("hidden");$("account-modal-content").innerHTML=""}
function showForgotPassword(){const users=appData.users.filter(u=>u.active!==false);$("account-modal-content").innerHTML=`<h2>Khôi phục mật khẩu</h2><div class="account-modal-note">Nhập tài khoản cần khôi phục và mã khôi phục của chủ tiệm.</div><div class="account-modal-form"><label>Tài khoản<input id="recover-username" autocomplete="username" value="${esc($("login-username").value)}"></label><label>Mã khôi phục<input id="recover-code" autocomplete="off" placeholder="GS334-XXXX-XXXX-XXXX"></label><label>Mật khẩu mới<input id="recover-new-password" type="password" autocomplete="new-password"></label><label>Nhập lại mật khẩu<input id="recover-confirm-password" type="password" autocomplete="new-password"></label><div id="recover-error" class="error-text"></div><button class="primary" id="recover-submit">Đặt lại mật khẩu</button></div>`;$("account-modal").classList.remove("hidden");$("recover-submit").onclick=async()=>{const username=$("recover-username").value.trim().toLowerCase(),code=$("recover-code").value.trim().toUpperCase(),pw=$("recover-new-password").value,confirm=$("recover-confirm-password").value;const user=appData.users.find(u=>u.username.toLowerCase()===username);if(!user)return $("recover-error").textContent="Không tìm thấy tài khoản";if(code!==String(appData.settings.recoveryCode||"").toUpperCase())return $("recover-error").textContent="Mã khôi phục không đúng";if(pw.length<6)return $("recover-error").textContent="Mật khẩu phải có ít nhất 6 ký tự";if(pw!==confirm)return $("recover-error").textContent="Hai mật khẩu không trùng nhau";user.passwordHash=await window.posAPI.hashPassword(pw);user.active=true;audit("RECOVER_PASSWORD",user.username);await persist();closeAccountModal();$("login-username").value=user.username;$("login-password").value="";$("login-error").textContent="Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới."}}
function showResetPassword(user){$("account-modal-content").innerHTML=`<h2>Đặt lại mật khẩu</h2><div class="account-modal-note">Tài khoản: <b>${esc(user.username)}</b>. Chủ tiệm có thể cấp mật khẩu mới mà không cần biết mật khẩu cũ.</div><div class="account-modal-form"><label>Mật khẩu mới<input id="admin-new-password" type="password"></label><label>Nhập lại mật khẩu<input id="admin-confirm-password" type="password"></label><div id="admin-password-error" class="error-text"></div><button class="primary" id="admin-reset-submit">Lưu mật khẩu mới</button></div>`;$("account-modal").classList.remove("hidden");$("admin-reset-submit").onclick=async()=>{const pw=$("admin-new-password").value,confirm=$("admin-confirm-password").value;if(pw.length<6)return $("admin-password-error").textContent="Mật khẩu phải có ít nhất 6 ký tự";if(pw!==confirm)return $("admin-password-error").textContent="Hai mật khẩu không trùng nhau";user.passwordHash=await window.posAPI.hashPassword(pw);audit("RESET_PASSWORD",user.username);await persist();closeAccountModal();toast("Đã đặt lại mật khẩu")}}


function validRecoveryCode(code){return /^[^\s]{8,32}$/.test(code)}
function showCustomRecoveryCode(){
  $("account-modal-content").innerHTML=`<h2>Đổi mã khôi phục</h2><div class="account-modal-note">Mã mới phải dài 8–32 ký tự và không có khoảng trắng. Mã cũ sẽ mất hiệu lực ngay sau khi lưu.</div><div class="account-modal-form"><label>Mật khẩu chủ tiệm hiện tại<input id="recovery-owner-password" type="password" autocomplete="current-password"></label><label>Mã khôi phục mới<input id="recovery-custom-value" autocomplete="off" maxlength="32" placeholder="Ví dụ: GS334-CHUTIEM-2026"></label><label>Nhập lại mã mới<input id="recovery-custom-confirm" autocomplete="off" maxlength="32"></label><div id="recovery-custom-error" class="error-text"></div><button class="primary" id="recovery-custom-submit">Lưu mã khôi phục</button></div>`;
  $("account-modal").classList.remove("hidden");
  $("recovery-custom-submit").onclick=async()=>{
    const password=$("recovery-owner-password").value;
    const code=$("recovery-custom-value").value.trim();
    const confirmCode=$("recovery-custom-confirm").value.trim();
    const auth=await window.posAPI.login({username:currentUser.username,password});
    if(!auth.ok)return $("recovery-custom-error").textContent="Mật khẩu chủ tiệm không đúng";
    if(!validRecoveryCode(code))return $("recovery-custom-error").textContent="Mã phải dài 8–32 ký tự và không có khoảng trắng";
    if(code!==confirmCode)return $("recovery-custom-error").textContent="Hai mã khôi phục không trùng nhau";
    appData.settings.recoveryCode=code;
    audit("CHANGE_RECOVERY_CODE","Mã khôi phục đã được tùy chỉnh");
    await persist();
    closeAccountModal();
    renderUsers();
    toast("Đã đổi mã khôi phục");
  };
}
function showGenerateRecoveryCode(){
  const nextCode=generateRecoveryCode();
  $("account-modal-content").innerHTML=`<h2>Tạo mã khôi phục mới</h2><div class="account-modal-note">Mã cũ sẽ mất hiệu lực. Hãy sao chép và cất mã mới ở nơi an toàn.</div><div class="account-modal-form"><label>Mật khẩu chủ tiệm hiện tại<input id="recovery-generate-password" type="password" autocomplete="current-password"></label><label>Mã mới dự kiến<input value="${esc(nextCode)}" readonly></label><div id="recovery-generate-error" class="error-text"></div><button class="primary" id="recovery-generate-submit">Xác nhận tạo mã mới</button></div>`;
  $("account-modal").classList.remove("hidden");
  $("recovery-generate-submit").onclick=async()=>{
    const auth=await window.posAPI.login({username:currentUser.username,password:$("recovery-generate-password").value});
    if(!auth.ok)return $("recovery-generate-error").textContent="Mật khẩu chủ tiệm không đúng";
    appData.settings.recoveryCode=nextCode;
    audit("REGENERATE_RECOVERY_CODE","Đã tạo mã khôi phục ngẫu nhiên mới");
    await persist();
    closeAccountModal();
    renderUsers();
    toast("Đã tạo mã khôi phục mới");
  };
}

function navigate(page){if(currentUser&&!isAdmin()&&!staffAllowedPage(page))page="dashboard";const target=$(`page-${page}`);if(!target)page="dashboard";document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));$(`page-${page}`).classList.add("active");const m={dashboard:["Tổng quan","Tình hình hoạt động tại tiệm"],orders:["Đơn giặt","Mặc định hiển thị đơn hôm nay; có thể đổi ngày, tháng hoặc năm"],"new-order":["Tạo đơn mới","Nhận đồ, tính tiền và in phiếu"],services:["Dịch vụ & giá","Quản lý bảng giá"],promotions:["Khuyến mãi","Tạo và quản lý các mốc ưu đãi"],users:["Nhân viên","Quản lý tài khoản đăng nhập"],messages:["Gửi tin nhanh","Soạn mẫu và mở Zalo/Facebook để gửi"],connections:["Tin nhắn & mẫu","Mở kênh chat và chỉnh mẫu tin nhắn"],settings:["Máy in & cài đặt","Thiết lập cửa hàng và sao lưu"]};$("page-title").textContent=m[page][0];$("page-subtitle").textContent=m[page][1];if(page==="new-order")resetOrderForm();if(page==="orders")renderOrders();if(page==="dashboard")renderDashboard();if(page==="services")renderServices();if(page==="promotions")renderPromotions();if(page==="users")renderUsers();if(page==="settings")loadSettings();if(page==="messages")renderMessages();if(page==="connections")loadConnections()}
function isAdmin(){return currentUser?.role==="admin"}
function staffAllowedPage(page){return ["dashboard","orders","new-order","messages","mobile"].includes(page)}
function applyRole(){
  const admin=isAdmin();
  document.querySelectorAll(".admin-only").forEach(x=>x.classList.toggle("hidden",!admin));
  $("current-user-name").textContent=currentUser?.displayName||"";
  $("current-user-role").textContent=admin?"Chủ tiệm":"Nhân viên";
  document.dispatchEvent(new CustomEvent("gs334:role-applied",{detail:{role:admin?"admin":"staff"}}));
}
async function login(){
  const button=$("login-button");
  if(button?.disabled)return;
  if(button)button.disabled=true;
  try{
    const r=await window.posAPI.login({username:$("login-username").value,password:$("login-password").value});
    if(!r.ok){$("login-error").textContent=r.error;return}
    currentUser=r.user;
    sessionStorage.setItem("gs334-user",JSON.stringify(currentUser));
    $("login-screen").classList.add("hidden");
    $("app-shell").classList.remove("hidden");
    applyRole();
    navigate("dashboard");
  }finally{if(button)button.disabled=false}
}
async function logout(event){
  if(event){ event.preventDefault(); event.stopPropagation(); }
  try { await window.posAPI.logout(); } catch (error) { console.warn("Logout API failed", error); }
  sessionStorage.removeItem("gs334-user");
  currentUser=null;
  window.location.replace("/");
}
function orderCode(){const n=new Date(),d=String(n.getFullYear()).slice(-2)+String(n.getMonth()+1).padStart(2,"0")+String(n.getDate()).padStart(2,"0"),c=appData.orders.filter(o=>o.code.includes(d)).length+1;return `${appData.settings.shopCode||"GS334"}-${d}-${String(c).padStart(3,"0")}`}
function resetOrderForm(){$("customer-name").value="";$("customer-phone").value="";$("order-note").value="";$("discount").value=0;$("paid-amount").value=0;$("payment-status").value="Chưa thanh toán";const d=new Date(Date.now()+86400000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());$("due-date").value=d.toISOString().slice(0,16);const s=appData.services.find(x=>x.active!==false);currentOrderItems=[{id:crypto.randomUUID(),serviceId:s?.id||"",quantity:1,price:s?.price||0}];renderOrderItems()}
function renderOrderItems(){const c=$("order-items"),active=appData.services.filter(x=>x.active!==false);c.innerHTML=currentOrderItems.map(i=>`<div class="order-item" data-id="${i.id}"><label>Dịch vụ<select class="item-service">${active.map(s=>`<option value="${s.id}" ${s.id===i.serviceId?"selected":""}>${esc(s.name)} (${esc(s.unit)})</option>`).join("")}</select></label><label>Số lượng<input class="item-qty" type="number" min=".1" step=".1" value="${i.quantity}"></label><label>Đơn giá<input class="item-price" type="number" min="0" value="${i.price}" ${isAdmin()?"":"disabled"}></label><label>Thành tiền<input value="${i.quantity*i.price}" disabled></label><button class="remove-item">×</button></div>`).join("");c.querySelectorAll(".order-item").forEach(r=>{const i=currentOrderItems.find(x=>x.id===r.dataset.id),se=r.querySelector(".item-service"),q=r.querySelector(".item-qty"),p=r.querySelector(".item-price");se.onchange=()=>{const s=appData.services.find(x=>x.id===se.value);i.serviceId=se.value;i.price=s?.price||0;renderOrderItems()};q.onchange=()=>{i.quantity=Number(q.value||0);renderOrderItems()};p.onchange=()=>{i.price=Number(p.value||0);renderOrderItems()};r.querySelector(".remove-item").onclick=()=>{if(currentOrderItems.length===1)return toast("Đơn phải có ít nhất một dịch vụ");currentOrderItems=currentOrderItems.filter(x=>x.id!==i.id);renderOrderItems()}});recalc()}
function recalc(){const sub=currentOrderItems.reduce((a,i)=>a+i.quantity*i.price,0),dis=Number($("discount").value||0),total=Math.max(0,sub-dis),paid=Number($("paid-amount").value||0);$("subtotal").textContent=money(sub);$("grand-total").textContent=money(total);$("remaining").textContent=money(Math.max(0,total-paid))}
function collect(){const name=$("customer-name").value.trim(),phone=$("customer-phone").value.trim();if(!name&&!phone){toast("Nhập tên khách hoặc số điện thoại");return null}const subtotal=currentOrderItems.reduce((a,i)=>a+i.quantity*i.price,0),discount=Number($("discount").value||0),total=Math.max(0,subtotal-discount),paid=Number($("paid-amount").value||0);return{id:crypto.randomUUID(),code:orderCode(),customerName:name,phone,createdAt:new Date().toISOString(),dueDate:$("due-date").value?new Date($("due-date").value).toISOString():"",paymentStatus:$("payment-status").value,paidAmount:paid,note:$("order-note").value.trim(),status:"Đã nhận",discount,subtotal,total,createdBy:currentUser.id,items:currentOrderItems.map(i=>{const s=appData.services.find(x=>x.id===i.serviceId);return{serviceId:i.serviceId,name:s?.name||"Dịch vụ",unit:s?.unit||"",quantity:i.quantity,price:i.price,total:i.quantity*i.price}})}}
async function saveOrder(mode){const o=collect();if(!o)return;appData.orders.unshift(o);audit("CREATE_ORDER",o.code);if(appData.messaging?.autoReceived)queueOrderMessage(o,"received");await persist();try{window.__GS334Notify?.inApp("GS334 · Có đơn mới",`${o.code} · ${o.customerName||"Khách lẻ"} · ${money(o.total)}`)}catch{}if(mode==="receipt"||mode==="all")await printReceipt(o);if(mode==="all")await printLabel(o);toast(`Đã tạo ${o.code}`);navigate("orders")}
function receiptHtml(o){
  const s=appData.settings||{};
  const paper=receiptPaperMm();
  const fs=Number(s.receiptFontSize||12);
  const mt=Math.max(0,Math.min(30,Number(s.receiptMarginTop??3)));
  const mr=Math.max(0,Math.min(30,Number(s.receiptMarginRight??4)));
  const mb=Math.max(0,Math.min(30,Number(s.receiptMarginBottom??3)));
  const ml=Math.max(0,Math.min(30,Number(s.receiptMarginLeft??4)));
  const scale=Math.max(70,Math.min(130,Number(s.receiptScale||100)))/100;
  const titleSize=Number(s.receiptTitleSize||20);
  const compact=s.receiptCompact===true;
  const titleWeight=s.receiptTitleBold===false?"400":"900";
  const titleStyle=s.receiptTitleItalic===true?"italic":"normal";
  const rowPad=compact?"1px":"2px";
  const lineMargin=compact?"4px":"7px";
  const top=[
    s.receiptShowShopName!==false?`<h1>${esc(s.shopName||"GIẶT SẤY 334")}</h1>`:"",
    s.receiptShowAddress!==false&&s.address?`<div class="c sm">${esc(s.address)}</div>`:"",
    s.receiptShowPhone!==false&&s.phone?`<div class="c sm">ĐT: ${esc(s.phone)}</div>`:"",
    s.receiptShowHeaderText===true&&s.receiptHeaderText?`<div class="c sm">${esc(s.receiptHeaderText)}</div>`:""
  ].join("");
  const midInfo=[
    `<div class="row"><b>Mã đơn</b><b>${esc(o.code)}</b></div>`,
    s.receiptShowOrderDate!==false?`<div class="row"><span>Ngày nhận</span><span>${new Date(o.createdAt).toLocaleString("vi-VN")}</span></div>`:"",
    s.receiptShowCustomer!==false?`<div class="row"><span>Khách</span><span>${esc(o.customerName||"-")}</span></div>`:"",
    s.receiptShowCustomerPhone!==false?`<div class="row"><span>Điện thoại</span><span>${esc(o.phone||"-")}</span></div>`:"",
    s.receiptShowDueDate!==false?`<div class="row"><span>Hẹn trả</span><span>${o.dueDate?new Date(o.dueDate).toLocaleString("vi-VN"):"-"}</span></div>`:""
  ].join("");
  const footer=[
    s.receiptShowFooter!==false&&s.receiptFooter?`<div class="c"><b>${esc(s.receiptFooter)}</b></div>`:"",
    s.receiptShowBottomNote!==false&&s.receiptBottomNote?`<div class="c sm">${esc(s.receiptBottomNote)}</div>`:""
  ].join("");
  return`<!doctype html><html><head><meta charset="UTF-8"><style>@page{margin:0}html{margin:0;padding:0;background:#fff;height:auto!important;min-height:0!important;overflow:visible}body{margin:0;padding:0;background:#fff;overflow:visible;break-after:avoid-page;page-break-after:avoid}body{box-sizing:border-box;width:${paper}mm;min-height:1mm;padding:${mt}mm ${mr}mm ${mb}mm ${ml}mm;font-family:${JSON.stringify(s.receiptFont||"Arial")};font-size:${fs}px;line-height:${compact?1.18:1.35};color:#000}body>*{zoom:${scale}}h1{text-align:center;font-size:${titleSize}px;font-weight:${titleWeight};font-style:${titleStyle};margin:0 0 4px}.c{text-align:center}.sm{font-size:${Math.max(8,fs-2)}px}.line{border-top:1px dashed #000;margin:${lineMargin} 0}.row{display:flex;justify-content:space-between;gap:8px;padding:${rowPad} 0}table{width:100%;border-collapse:collapse;page-break-inside:avoid;break-inside:avoid}tr,.row,.line{break-inside:avoid;page-break-inside:avoid;break-before:avoid-page;break-after:avoid-page}td{padding:${compact?1:3}px 0;vertical-align:top}.total{font-size:${fs+2}px;font-weight:bold}</style></head><body>${top}${top?'<div class="line"></div>':''}${midInfo}<div class="line"></div><table>${o.items.map(i=>`<tr><td>${esc(i.name)}<br><small>${i.quantity} ${esc(i.unit)} × ${money(i.price)}</small></td><td style="text-align:right">${money(i.total)}</td></tr>`).join("")}</table><div class="line"></div><div class="row"><span>Tạm tính</span><span>${money(o.subtotal)}</span></div><div class="row"><span>Giảm giá</span><span>${money(o.discount)}</span></div><div class="row total"><span>TỔNG CỘNG</span><span>${money(o.total)}</span></div>${s.receiptShowPaid!==false?`<div class="row"><span>Khách đưa</span><span>${money(o.paidAmount)}</span></div><div class="row"><b>Còn lại</b><b>${money(Math.max(0,o.total-o.paidAmount))}</b></div>`:""}${s.receiptShowNote!==false&&o.note?`<div class="line"></div><b>Ghi chú:</b><div>${esc(o.note)}</div>`:""}${footer?`<div class="line"></div>${footer}`:""}</body></html>`
}
function receiptPaperMm(){const s=appData.settings||{};return s.paperWidth==="custom"?Math.min(120,Math.max(40,Number(s.customPaperWidth||58))):Number(s.paperWidth||80)}
function labelHtml(o){return`<!doctype html><html><head><meta charset="UTF-8"><style>@page{margin:0}body{width:48mm;margin:0;padding:2mm;font-family:Arial;color:#000}.shop{text-align:center;font-size:14px;font-weight:bold}.code{text-align:center;font-size:18px;font-weight:900;border:2px solid #000;padding:4px;margin:4px 0}.name{font-size:14px;font-weight:bold}.line{border-top:1px dashed #000;margin:4px 0}.small{font-size:10px}</style></head><body><div class="shop">${esc(appData.settings.shopName)}</div><div class="code">${esc(o.code)}</div><div class="name">${esc(o.customerName||o.phone||"Khách lẻ")}</div><div>${o.items.map(i=>`${esc(i.name)}: ${i.quantity} ${esc(i.unit)}`).join("<br>")}</div><div class="line"></div><div><b>Hẹn:</b> ${o.dueDate?new Date(o.dueDate).toLocaleString("vi-VN"):"-"}</div>${o.note?`<div class="small"><b>Lưu ý:</b> ${esc(o.note)}</div>`:""}</body></html>`}
let uiPrintBusy=false;
async function doPrint(html,printer,type,order){
  if(uiPrintBusy){toast("Đang gửi lệnh in trước đó");return {ok:false,error:"Đang in"}}
  uiPrintBusy=true;
  toast("Đang gửi lệnh in...");
  try{
    let r;
    if((appData.settings.printerMode||"windows")==="network"){
      const rasterCopies=type==="receipt"&&window.GS334Raster?window.GS334Raster.copies(order,appData.settings):undefined;
      r=await window.posAPI.printNetwork({
        host:appData.settings.printerIp,
        port:Number(appData.settings.printerPort||9100),
        type,
        order,
        settings:appData.settings,
        rasterCopies,
        copies:type==="label"?1:Math.max(1,Math.min(3,Number(appData.settings.receiptCopies||1)))
      });
    }else{
      r=await window.posAPI.printHtml({
        html,
        printerName:printer,
        silent:appData.settings.autoPrint,
        type,
        paperWidthMm:type==="label"?50:receiptPaperMm(),
        paperHeightMode:"auto",
        fixedPaperHeightMm:Number(appData.settings.fixedPaperHeight||150),
        feedBottomMm:type==="label"?4:Number(appData.settings.receiptFeedBottom??0),
        copies:type==="label"?1:Math.max(1,Math.min(3,Number(appData.settings.receiptCopies||1)))
      });
    }
    toast(r.ok?(r.message||"Đã gửi lệnh in"):`In lỗi: ${r.error}`);
    return r;
  }catch(error){
    const message=error?.message||"Không thể gửi lệnh in";
    toast(`In lỗi: ${message}`);
    return {ok:false,error:message};
  }finally{
    uiPrintBusy=false;
  }
}
function normalizeOrderForPrint(order){
  if(!order||typeof order!=="object")throw new Error("Không tìm thấy dữ liệu đơn hàng");
  const rawItems=Array.isArray(order.items)?order.items:[];
  const items=rawItems.map((item,index)=>{
    const quantity=Number(item?.quantity??item?.qty??1)||1;
    const price=Number(item?.price??item?.unitPrice??0)||0;
    const total=Number(item?.total);
    return{
      ...item,
      name:String(item?.name||item?.serviceName||`Dịch vụ ${index+1}`),
      unit:String(item?.unit||""),
      quantity,
      price,
      total:Number.isFinite(total)?total:quantity*price
    };
  });
  if(!items.length)items.push({name:"Dịch vụ",unit:"",quantity:1,price:Number(order.total||0),total:Number(order.total||0)});
  const subtotalValue=Number(order.subtotal);
  const subtotal=Number.isFinite(subtotalValue)?subtotalValue:items.reduce((sum,item)=>sum+Number(item.total||0),0);
  const discount=Number(order.discount||0)||0;
  const totalValue=Number(order.total);
  const total=Number.isFinite(totalValue)?totalValue:Math.max(0,subtotal-discount);
  const createdDate=new Date(order.createdAt||Date.now());
  const dueDate=order.dueDate?new Date(order.dueDate):null;
  return{
    ...order,
    code:String(order.code||"ĐƠN-HÀNG"),
    customerName:String(order.customerName||order.name||"Khách lẻ"),
    phone:String(order.phone||""),
    note:String(order.note||""),
    createdAt:Number.isNaN(createdDate.getTime())?new Date().toISOString():createdDate.toISOString(),
    dueDate:dueDate&&!Number.isNaN(dueDate.getTime())?dueDate.toISOString():"",
    paidAmount:Number(order.paidAmount||0)||0,
    subtotal,discount,total,items
  };
}
async function printReceipt(order){
  try{
    const normalized=normalizeOrderForPrint(order);
    return await doPrint(receiptHtml(normalized),appData.settings.printerName,"receipt",normalized);
  }catch(error){
    const message=error?.message||"Không dựng được phiếu từ dữ liệu đơn hàng";
    console.error("PRINT_RECEIPT_ORDER_ERROR",error,order);
    toast(`Không thể in đơn: ${message}`);
    return{ok:false,error:message};
  }
}
async function printLabel(order){
  try{
    const normalized=normalizeOrderForPrint(order);
    return await doPrint(labelHtml(normalized),appData.settings.labelPrinterName||appData.settings.printerName,"label",normalized);
  }catch(error){
    const message=error?.message||"Không dựng được tem từ dữ liệu đơn hàng";
    console.error("PRINT_LABEL_ORDER_ERROR",error,order);
    toast(`Không thể in tem: ${message}`);
    return{ok:false,error:message};
  }
}
function badge(s){const c={"Đã nhận":"blue","Đang giặt":"orange","Đang sấy":"orange","Chờ khách lấy":"green","Hoàn thành":"green","Đã hủy":"red"}[s]||"";return`<span class="badge ${c}">${esc(s)}</span>`}
const ORDER_OVERDUE_GRACE_DAYS=5;
function orderAgeDays(o){
  if(!o?.createdAt)return 0;
  const created=localDayStart(o.createdAt),today=localDayStart(new Date());
  return Math.max(0,Math.floor((today-created)/86400000));
}
function overdueDays(o){
  if(!o||["Hoàn thành","Đã hủy"].includes(o.status))return 0;
  return Math.max(0,orderAgeDays(o)-ORDER_OVERDUE_GRACE_DAYS);
}
function isOverdue(o){return overdueDays(o)>0}
function overdueBadgeHtml(o){
  const days=overdueDays(o);
  return days>0?`<br><span class="badge red">Quá hẹn ${days} ngày</span>`:"";
}
function updateBulkSelectionUI(){
  const count=selectedOrderIds.size;
  $("selected-count").textContent=String(count);
  $("delete-selected-orders").classList.toggle("hidden",!isAdmin()||count===0);
  const visibleCheckboxes=[...document.querySelectorAll(".order-select")];
  const allChecked=visibleCheckboxes.length>0&&visibleCheckboxes.every(cb=>cb.checked);
  const someChecked=visibleCheckboxes.some(cb=>cb.checked);
  $("select-all-orders").checked=allChecked;
  $("select-all-orders").indeterminate=!allChecked&&someChecked;
}
function renderOrders(){
  const q=$("order-search").value.trim().toLowerCase(),st=$("status-filter").value;
  const arr=appData.orders.filter(o=>(!q||[o.code,o.customerName,o.phone].some(v=>String(v||"").toLowerCase().includes(q)))&&(!st||o.status===st));
  $("orders-table").innerHTML=arr.map(o=>`<tr>
    ${isAdmin()?`<td class="checkbox-col"><input class="order-select" type="checkbox" data-select-order="${o.id}" ${selectedOrderIds.has(o.id)?"checked":""}></td>`:""}
    <td><strong>${esc(o.code)}</strong>${overdueBadgeHtml(o)}<br><small>${new Date(o.createdAt).toLocaleString("vi-VN")}</small></td>
    <td>${esc(o.customerName||"-")}<br><small>${esc(o.phone||"-")}</small></td>
    <td>${o.items.map(i=>`${esc(i.name)} (${i.quantity} ${esc(i.unit)})`).join("<br>")}</td>
    <td><strong>${money(o.total)}</strong></td>
    <td>${esc(o.paymentStatus)}<br><small>Còn ${money(Math.max(0,o.total-o.paidAmount))}</small></td>
    <td>${badge(o.status)}</td>
    <td><div class="table-actions"><button data-view="${o.id}">Xem</button><button data-print="${o.id}">Phiếu</button><button data-label="${o.id}">Tem</button></div></td>
  </tr>`).join("");
  $("orders-empty").classList.toggle("hidden",arr.length>0);
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>openModal(b.dataset.view));
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>printReceipt(appData.orders.find(o=>o.id===b.dataset.print)));
  document.querySelectorAll("[data-label]").forEach(b=>b.onclick=()=>printLabel(appData.orders.find(o=>o.id===b.dataset.label)));
  document.querySelectorAll("[data-select-order]").forEach(cb=>{
    cb.onchange=()=>{
      if(cb.checked)selectedOrderIds.add(cb.dataset.selectOrder);
      else selectedOrderIds.delete(cb.dataset.selectOrder);
      updateBulkSelectionUI();
    };
  });
  updateBulkSelectionUI();
}
function renderDashboard(){const today=new Date().toDateString(),todayOrders=appData.orders.filter(o=>new Date(o.createdAt).toDateString()===today&&o.status!=="Đã hủy");$("stat-today").textContent=todayOrders.length;$("stat-processing").textContent=appData.orders.filter(o=>["Đã nhận","Đang giặt","Đang sấy"].includes(o.status)).length;$("stat-ready").textContent=appData.orders.filter(o=>o.status==="Chờ khách lấy").length;$("stat-overdue").textContent=appData.orders.filter(isOverdue).length;$("stat-revenue").textContent=money(todayOrders.reduce((a,o)=>a+o.total,0));$("stat-debt").textContent=money(appData.orders.filter(o=>!["Đã hủy"].includes(o.status)).reduce((a,o)=>a+Math.max(0,o.total-o.paidAmount),0));const p=appData.orders.filter(o=>isOverdue(o)||o.status==="Chờ khách lấy").slice(0,8);$("priority-orders").innerHTML=p.length?p.map(o=>`<div class="priority-row ${isOverdue(o)?"overdue":""}"><div><b>${esc(o.code)} — ${esc(o.customerName||o.phone||"Khách lẻ")}</b><small>${isOverdue(o)?`Quá hẹn ${overdueDays(o)} ngày`:"Đang chờ khách lấy"} · ${money(o.total)}</small></div><button class="secondary" data-dash="${o.id}">Xem</button></div>`).join(""):'<div class="empty-state">Không có đơn cần ưu tiên.</div>';document.querySelectorAll("[data-dash]").forEach(b=>b.onclick=()=>openModal(b.dataset.dash))}
function openModal(id){const o=appData.orders.find(x=>x.id===id);if(!o)return;$("order-modal-content").innerHTML=`<h2>${esc(o.code)}</h2><div>${badge(o.status)} ${overdueDays(o)>0?`<span class="badge red">Quá hẹn ${overdueDays(o)} ngày</span>`:""}</div><div class="order-detail-grid"><div class="detail-box"><span>Khách hàng</span><strong>${esc(o.customerName||"-")}</strong></div><div class="detail-box"><span>Điện thoại</span><strong>${esc(o.phone||"-")}</strong></div><div class="detail-box"><span>Tổng tiền</span><strong>${money(o.total)}</strong></div><div class="detail-box"><span>Còn lại</span><strong>${money(Math.max(0,o.total-o.paidAmount))}</strong></div></div><h3>Dịch vụ</h3>${o.items.map(i=>`<div class="summary-row"><span>${esc(i.name)} — ${i.quantity} ${esc(i.unit)}</span><strong>${money(i.total)}</strong></div>`).join("")}${o.note?`<p><b>Ghi chú:</b> ${esc(o.note)}</p>`:""}<h3>Chuyển trạng thái</h3><div class="status-actions">${statuses.map(s=>`<button class="${s==="Đã hủy"?"danger":"secondary"}" data-status="${s}">${s}</button>`).join("")}</div><div class="button-row"><button class="secondary" id="m-label">In tem</button><button class="secondary" id="m-paid">Đã thanh toán</button></div>`;$("order-modal").classList.remove("hidden");document.querySelectorAll("[data-status]").forEach(b=>b.onclick=async()=>{o.status=b.dataset.status;if(o.status==="Chờ khách lấy"&&!o.readyAt)o.readyAt=new Date().toISOString();if(["Hoàn thành","Đã hủy"].includes(o.status))o.closedAt=new Date().toISOString();audit("CHANGE_STATUS",`${o.code}: ${o.status}`);if(o.status==="Chờ khách lấy"&&appData.messaging?.autoReady)queueOrderMessage(o,"ready");await persist();openModal(id);renderOrders();renderDashboard();toast("Đã cập nhật trạng thái")});$("m-label").onclick=()=>printLabel(o);$("m-paid").onclick=async()=>{o.paymentStatus="Đã thanh toán";o.paidAmount=o.total;audit("MARK_PAID",o.code);await persist();openModal(id);renderOrders();renderDashboard();toast("Đã thanh toán")}}
function renderServices(){
  const list=$("services-list");
  list.innerHTML=appData.services.map((s,index)=>`<div class="service-row" data-service="${s.id}" draggable="true">
    <button class="service-drag" type="button" title="Giữ và kéo để đổi thứ tự" aria-label="Kéo để đổi thứ tự">☰</button>
    <input class="sn" value="${esc(s.name)}">
    <input class="su" value="${esc(s.unit)}">
    <input class="sp" type="number" min="0" value="${s.price}">
    <div class="service-order-actions"><button class="secondary service-up" type="button" title="Đưa lên" ${index===0?"disabled":""}>↑</button><button class="secondary service-down" type="button" title="Đưa xuống" ${index===appData.services.length-1?"disabled":""}>↓</button></div>
    <button class="danger sd">Xóa</button>
  </div>`).join("");
  let draggedId="";
  list.querySelectorAll(".service-row").forEach(r=>{
    const service=appData.services.find(x=>x.id===r.dataset.service);
    const saveOrder=async(fromId,toId)=>{
      if(!fromId||!toId||fromId===toId)return;
      const from=appData.services.findIndex(x=>x.id===fromId),to=appData.services.findIndex(x=>x.id===toId);
      if(from<0||to<0)return;
      const [moved]=appData.services.splice(from,1);appData.services.splice(to,0,moved);
      audit("REORDER_SERVICE",moved.name);await persist();renderServices();renderOrderItems();
    };
    r.addEventListener("dragstart",e=>{if(!e.target.closest(".service-drag")){e.preventDefault();return}draggedId=r.dataset.service;r.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",draggedId)});
    r.addEventListener("dragend",()=>{draggedId="";r.classList.remove("dragging");list.querySelectorAll(".drag-over").forEach(x=>x.classList.remove("drag-over"))});
    r.addEventListener("dragover",e=>{e.preventDefault();e.dataTransfer.dropEffect="move";r.classList.add("drag-over")});
    r.addEventListener("dragleave",()=>r.classList.remove("drag-over"));
    r.addEventListener("drop",async e=>{e.preventDefault();r.classList.remove("drag-over");await saveOrder(draggedId||e.dataTransfer.getData("text/plain"),r.dataset.service)});
    r.querySelector(".sn").onchange=async e=>{service.name=e.target.value.trim()||"Dịch vụ";audit("EDIT_SERVICE",service.name);await persist()};
    r.querySelector(".su").onchange=async e=>{service.unit=e.target.value.trim()||"đơn vị";await persist()};
    r.querySelector(".sp").onchange=async e=>{service.price=Number(e.target.value||0);audit("EDIT_PRICE",`${service.name}: ${service.price}`);await persist()};
    r.querySelector(".service-up").onclick=async()=>{const i=appData.services.findIndex(x=>x.id===service.id);if(i<=0)return;[appData.services[i-1],appData.services[i]]=[appData.services[i],appData.services[i-1]];await persist();renderServices();renderOrderItems()};
    r.querySelector(".service-down").onclick=async()=>{const i=appData.services.findIndex(x=>x.id===service.id);if(i<0||i>=appData.services.length-1)return;[appData.services[i+1],appData.services[i]]=[appData.services[i],appData.services[i+1]];await persist();renderServices();renderOrderItems()};
    r.querySelector(".sd").onclick=async()=>{if(appData.services.length===1)return toast("Phải giữ ít nhất một dịch vụ");appData.services=appData.services.filter(x=>x.id!==service.id);await persist();renderServices()};
  });
}
function renderUsers(){$("recovery-code-display").textContent=appData.settings.recoveryCode||"";$("users-list").innerHTML=appData.users.map(u=>`<div class="user-row" data-user="${u.id}"><label>Tên hiển thị<input class="ud" value="${esc(u.displayName)}"></label><label>Tài khoản<input class="uu" value="${esc(u.username)}"></label><label>Vai trò<select class="ur"><option value="staff" ${u.role==="staff"?"selected":""}>Nhân viên</option><option value="admin" ${u.role==="admin"?"selected":""}>Chủ tiệm</option></select><span class="account-status ${u.active===false?"locked":""}">${u.active===false?"Đã khóa":"Đang hoạt động"}</span></label><div class="user-actions"><button class="secondary up">Đặt lại mật khẩu</button><button class="secondary ul">${u.active===false?"Mở khóa":"Khóa"}</button><button class="danger ux">Xóa</button></div></div>`).join("");document.querySelectorAll("[data-user]").forEach(r=>{const u=appData.users.find(x=>x.id===r.dataset.user);r.querySelector(".ud").onchange=async e=>{u.displayName=e.target.value.trim()||u.username;await persist()};r.querySelector(".uu").onchange=async e=>{const next=e.target.value.trim();if(!next)return e.target.value=u.username;if(appData.users.some(x=>x.id!==u.id&&x.username.toLowerCase()===next.toLowerCase())){e.target.value=u.username;return toast("Tài khoản đã tồn tại")}u.username=next;await persist()};r.querySelector(".ur").onchange=async e=>{u.role=e.target.value;await persist()};r.querySelector(".up").onclick=()=>showResetPassword(u);r.querySelector(".ul").onclick=async()=>{if(u.id===currentUser.id)return toast("Không thể khóa tài khoản đang đăng nhập");u.active=u.active===false;audit(u.active?"UNLOCK_USER":"LOCK_USER",u.username);await persist();renderUsers()};r.querySelector(".ux").onclick=async()=>{if(u.id===currentUser.id)return toast("Không thể xóa tài khoản đang đăng nhập");if(appData.users.length===1)return toast("Phải giữ ít nhất một tài khoản");if(u.role==="admin"&&appData.users.filter(x=>x.role==="admin").length===1)return toast("Phải giữ ít nhất một tài khoản chủ tiệm");if(!confirm(`Xóa tài khoản ${u.username}?`))return;appData.users=appData.users.filter(x=>x.id!==u.id);audit("DELETE_USER",u.username);await persist();renderUsers()}})}
function togglePrinterMode(){
  const mode=$("printer-mode").value;
  $("windows-printer-settings").classList.toggle("hidden",mode!=="windows");
  $("network-printer-settings").classList.toggle("hidden",mode!=="network");
}
function setPrinterStatus(message,type=""){
  const el=$("printer-status");
  el.textContent=message;
  el.classList.remove("ok","error");
  if(type)el.classList.add(type);
}
function ensurePromotions(){
  appData.settings=appData.settings||{};
  if(!Array.isArray(appData.settings.promotions)){
    appData.settings.promotions=[
      {id:crypto.randomUUID(),name:"Lần thứ 6 giảm 20%",enabled:true,visitNumber:6,discountType:"percent",discountValue:20,maxDiscount:20000},
      {id:crypto.randomUUID(),name:"Lần thứ 10 giảm 100%",enabled:true,visitNumber:10,discountType:"percent",discountValue:100,maxDiscount:55000}
    ];
  }
  appData.settings.promotions=appData.settings.promotions.map((p,i)=>({
    id:p.id||crypto.randomUUID(),name:String(p.name||`Khuyến mãi ${i+1}`),enabled:p.enabled!==false,
    visitNumber:Math.max(1,Number(p.visitNumber||1)),discountType:p.discountType==="amount"?"amount":"percent",
    discountValue:Math.max(0,Number(p.discountValue||0)),maxDiscount:Math.max(0,Number(p.maxDiscount||0))
  }));
  return appData.settings.promotions;
}
function activePromotions(){return ensurePromotions().filter(p=>p.enabled).sort((a,b)=>a.visitNumber-b.visitNumber)}
function promotionDiscountAmount(p,subtotal){
  let amount=p.discountType==="percent"?subtotal*Math.min(100,p.discountValue)/100:p.discountValue;
  if(p.maxDiscount>0)amount=Math.min(amount,p.maxDiscount);
  return Math.max(0,Math.min(subtotal,Math.round(amount)));
}
function promotionDescription(p){
  const value=p.discountType==="percent"?`${p.discountValue}%`:money(p.discountValue);
  return `Lần thứ ${p.visitNumber}: giảm ${value}${p.maxDiscount>0?`, tối đa ${money(p.maxDiscount)}`:""}`;
}
function renderPromotions(){
  ensurePromotions();const box=$("promotions-list");if(!box)return;
  const list=appData.settings.promotions;
  if(!list.length){box.innerHTML='<div class="empty-state">Chưa có khuyến mãi. Bấm “Thêm khuyến mãi” để tạo.</div>';return}
  box.innerHTML=list.map((p,i)=>`<div class="promotion-card" data-promotion-id="${p.id}">
    <div class="promotion-card-head"><label class="promotion-switch"><input type="checkbox" data-promo-field="enabled" ${p.enabled?"checked":""}><span></span></label><div><strong>${esc(p.name)}</strong><small>${esc(promotionDescription(p))}</small></div><div class="promotion-actions"><button class="secondary" data-edit-promo="${p.id}">Sửa</button><button class="danger" data-delete-promo="${p.id}">Xóa</button></div></div>
  </div>`).join("");
  box.querySelectorAll('[data-promo-field="enabled"]').forEach(input=>input.onchange=async()=>{const card=input.closest('[data-promotion-id]'),p=list.find(x=>x.id===card.dataset.promotionId);if(!p)return;p.enabled=input.checked;audit("TOGGLE_PROMOTION",`${p.name}: ${p.enabled?"Bật":"Tắt"}`);await persist();renderPromotions();toast("Đã cập nhật khuyến mãi")});
  box.querySelectorAll('[data-edit-promo]').forEach(b=>b.onclick=()=>openPromotionEditor(list.find(x=>x.id===b.dataset.editPromo)));
  box.querySelectorAll('[data-delete-promo]').forEach(b=>b.onclick=async()=>{const p=list.find(x=>x.id===b.dataset.deletePromo);if(!p||!confirm(`Xóa khuyến mãi “${p.name}”?`))return;appData.settings.promotions=list.filter(x=>x.id!==p.id);audit("DELETE_PROMOTION",p.name);await persist();renderPromotions();toast("Đã xóa khuyến mãi")});
}
function openPromotionEditor(p=null){
  const item=p||{id:crypto.randomUUID(),name:"",enabled:true,visitNumber:1,discountType:"percent",discountValue:10,maxDiscount:0};
  $("account-modal-content").innerHTML=`<h2>${p?"Sửa":"Thêm"} khuyến mãi</h2><div class="account-modal-note">Khuyến mãi được xét theo số thứ tự lần giặt tiếp theo của khách.</div><div class="account-modal-form">
    <label>Tên chương trình<input id="promo-name" value="${esc(item.name)}" placeholder="Ví dụ: Lần thứ 6 giảm 20%"></label>
    <label>Áp dụng ở lần giặt thứ<input id="promo-visit" type="number" min="1" max="9999" value="${item.visitNumber}"></label>
    <label>Loại giảm<select id="promo-type"><option value="percent" ${item.discountType==="percent"?"selected":""}>Giảm theo phần trăm</option><option value="amount" ${item.discountType==="amount"?"selected":""}>Giảm số tiền cố định</option></select></label>
    <label>Giá trị giảm<input id="promo-value" type="number" min="0" value="${item.discountValue}"></label>
    <label>Giảm tối đa (đ)<input id="promo-max" type="number" min="0" value="${item.maxDiscount}"><small>Nhập 0 nếu không giới hạn.</small></label>
    <label class="checkbox"><input id="promo-enabled" type="checkbox" ${item.enabled?"checked":""}> Bật chương trình này</label>
    <div id="promo-error" class="error-text"></div><button class="primary" id="save-promotion">Lưu khuyến mãi</button></div>`;
  $("account-modal").classList.remove("hidden");
  $("save-promotion").onclick=async()=>{const name=$("promo-name").value.trim(),visit=Math.max(1,Number($("promo-visit").value||1)),type=$("promo-type").value,value=Math.max(0,Number($("promo-value").value||0)),max=Math.max(0,Number($("promo-max").value||0));if(!name)return $("promo-error").textContent="Hãy nhập tên chương trình";if(type==="percent"&&value>100)return $("promo-error").textContent="Phần trăm giảm không được lớn hơn 100";const duplicate=ensurePromotions().find(x=>x.visitNumber===visit&&x.id!==item.id);if(duplicate)return $("promo-error").textContent=`Đã có khuyến mãi ở lần thứ ${visit}`;Object.assign(item,{name,visitNumber:visit,discountType:type,discountValue:value,maxDiscount:max,enabled:$("promo-enabled").checked});if(!p)appData.settings.promotions.push(item);audit(p?"EDIT_PROMOTION":"ADD_PROMOTION",name);await persist();closeAccountModal();renderPromotions();toast("Đã lưu khuyến mãi")};
}
async function loadSettings(){appData.settings.paperHeightMode="auto";
  $("shop-name").value=appData.settings.shopName||"";
  $("shop-code").value=appData.settings.shopCode||"GS334";
  $("shop-phone").value=appData.settings.phone||"";
  $("shop-address").value=appData.settings.address||"";
  $("paper-width").value=appData.settings.paperWidth||"80";
  $("custom-paper-width").value=appData.settings.customPaperWidth||58;
  $("paper-height-mode").value="auto";
  $("fixed-paper-height").value=appData.settings.fixedPaperHeight||150;
  $("receipt-margin-top").value=appData.settings.receiptMarginTop??3;
  $("receipt-margin-right").value=appData.settings.receiptMarginRight??4;
  $("receipt-margin-bottom").value=appData.settings.receiptMarginBottom??3;
  $("receipt-margin-left").value=appData.settings.receiptMarginLeft??4;
  $("receipt-scale").value=appData.settings.receiptScale||100;
  $("receipt-feed-bottom").value=appData.settings.receiptFeedBottom??0;
  $("receipt-copies").value=String(Math.max(1,Math.min(3,Number(appData.settings.receiptCopies||1))));
  $("receipt-cut-between-copies").checked=appData.settings.receiptCutBetweenCopies!==false;
  $("receipt-final-cut").checked=appData.settings.receiptFinalCut!==false;
  $("receipt-cut-mode").value=appData.settings.receiptCutMode==="partial"?"partial":"full";
  $("receipt-feed-before-cut").value=Math.max(0,Math.min(10,Number(appData.settings.receiptFeedBeforeCut??3)));
  $("receipt-show-copy-label").checked=appData.settings.receiptShowCopyLabel!==false;
  $("receipt-copy-1-label").value=appData.settings.receiptCopy1Label||"PHIẾU KHÁCH";
  $("receipt-copy-2-label").value=appData.settings.receiptCopy2Label||"PHIẾU TIỆM";
  $("receipt-copy-3-label").value=appData.settings.receiptCopy3Label||"PHIẾU LƯU";
  $("receipt-font").value=appData.settings.receiptFont||"Arial";
  $("receipt-font-size").value=String(appData.settings.receiptFontSize||12);
  $("receipt-title-size").value=appData.settings.receiptTitleSize||20;
  $("receipt-title-bold").checked=appData.settings.receiptTitleBold!==false;
  $("receipt-title-italic").checked=appData.settings.receiptTitleItalic===true;
  $("receipt-compact").checked=appData.settings.receiptCompact===true;
  $("receipt-header-text").value=appData.settings.receiptHeaderText||"";
  $("receipt-footer").value=appData.settings.receiptFooter||"Cảm ơn quý khách!";
  $("receipt-bottom-note").value=appData.settings.receiptBottomNote||"Vui lòng giữ phiếu để nhận đồ.";
  $("receipt-show-shop-name").checked=appData.settings.receiptShowShopName!==false;
  $("receipt-show-address").checked=appData.settings.receiptShowAddress!==false;
  $("receipt-show-phone").checked=appData.settings.receiptShowPhone!==false;
  $("receipt-show-header-text").checked=appData.settings.receiptShowHeaderText===true;
  $("receipt-show-order-date").checked=appData.settings.receiptShowOrderDate!==false;
  $("receipt-show-customer").checked=appData.settings.receiptShowCustomer!==false;
  $("receipt-show-customer-phone").checked=appData.settings.receiptShowCustomerPhone!==false;
  $("receipt-show-due-date").checked=appData.settings.receiptShowDueDate!==false;
  $("receipt-show-note").checked=appData.settings.receiptShowNote!==false;
  $("receipt-show-paid").checked=appData.settings.receiptShowPaid!==false;
  $("receipt-show-footer").checked=appData.settings.receiptShowFooter!==false;
  $("receipt-show-bottom-note").checked=appData.settings.receiptShowBottomNote!==false;
  toggleCustomPaper();
  toggleFixedPaperHeight();
  renderBillPreview();
  $("auto-print").checked=appData.settings.autoPrint!==false;
  $("printer-mode").value=appData.settings.printerMode||"windows";
  $("printer-ip").value=appData.settings.printerIp||"";
  $("printer-port").value=appData.settings.printerPort||9100;

  const ps=await window.posAPI.listPrinters();
  const opts='<option value="">Máy in mặc định Windows</option>'+
    ps.map(p=>`<option value="${esc(p.name)}">${esc(p.displayName||p.name)}</option>`).join("");
  $("printer-select").innerHTML=opts;
  $("label-printer-select").innerHTML=opts;
  $("printer-select").value=appData.settings.printerName||"";
  $("label-printer-select").value=appData.settings.labelPrinterName||"";
  togglePrinterMode();
  setPrinterStatus("Chưa kiểm tra kết nối");
}
async function saveSettings(){
  Object.assign(appData.settings,{
    shopName:$("shop-name").value.trim()||"GIẶT SẤY 334",
    shopCode:$("shop-code").value.trim()||"GS334",
    phone:$("shop-phone").value.trim(),
    address:$("shop-address").value.trim(),
    paperWidth:$("paper-width").value,
    customPaperWidth:Number($("custom-paper-width").value||58),
    paperHeightMode:"auto",
    fixedPaperHeight:Number($("fixed-paper-height").value||150),
    receiptMarginTop:Number($("receipt-margin-top").value||0),
    receiptMarginRight:Number($("receipt-margin-right").value||0),
    receiptMarginBottom:Number($("receipt-margin-bottom").value||0),
    receiptMarginLeft:Number($("receipt-margin-left").value||0),
    receiptScale:Number($("receipt-scale").value||100),
    receiptFeedBottom:Number($("receipt-feed-bottom").value||0),
    receiptCopies:Math.max(1,Math.min(3,Number($("receipt-copies").value||1))),
    receiptCutBetweenCopies:$("receipt-cut-between-copies").checked,
    receiptFinalCut:$("receipt-final-cut").checked,
    receiptCutMode:$("receipt-cut-mode").value==="partial"?"partial":"full",
    receiptFeedBeforeCut:Math.max(0,Math.min(10,Number($("receipt-feed-before-cut").value||0))),
    receiptShowCopyLabel:$("receipt-show-copy-label").checked,
    receiptCopy1Label:$("receipt-copy-1-label").value.trim()||"PHIẾU KHÁCH",
    receiptCopy2Label:$("receipt-copy-2-label").value.trim()||"PHIẾU TIỆM",
    receiptCopy3Label:$("receipt-copy-3-label").value.trim()||"PHIẾU LƯU",
    receiptFont:$("receipt-font").value,
    receiptFontSize:Number($("receipt-font-size").value||12),
    receiptTitleSize:Number($("receipt-title-size").value||20),
    receiptTitleBold:$("receipt-title-bold").checked,
    receiptTitleItalic:$("receipt-title-italic").checked,
    receiptCompact:$("receipt-compact").checked,
    receiptHeaderText:$("receipt-header-text").value.trim(),
    receiptFooter:$("receipt-footer").value.trim(),
    receiptBottomNote:$("receipt-bottom-note").value.trim(),
    receiptShowShopName:$("receipt-show-shop-name").checked,
    receiptShowAddress:$("receipt-show-address").checked,
    receiptShowPhone:$("receipt-show-phone").checked,
    receiptShowHeaderText:$("receipt-show-header-text").checked,
    receiptShowOrderDate:$("receipt-show-order-date").checked,
    receiptShowCustomer:$("receipt-show-customer").checked,
    receiptShowCustomerPhone:$("receipt-show-customer-phone").checked,
    receiptShowDueDate:$("receipt-show-due-date").checked,
    receiptShowNote:$("receipt-show-note").checked,
    receiptShowPaid:$("receipt-show-paid").checked,
    receiptShowFooter:$("receipt-show-footer").checked,
    receiptShowBottomNote:$("receipt-show-bottom-note").checked,
    printerName:$("printer-select").value,
    labelPrinterName:$("label-printer-select").value,
    autoPrint:$("auto-print").checked,
    printerMode:$("printer-mode").value,
    printerIp:$("printer-ip").value.trim(),
    printerPort:Number($("printer-port").value||9100)
  });
  audit("SAVE_SETTINGS","Cập nhật cài đặt máy in");
  await persist();
  toast("Đã lưu cài đặt");
}
function toggleCustomPaper(){
  $("custom-paper-wrap").classList.toggle("hidden",$("paper-width").value!=="custom");
}
function toggleFixedPaperHeight(){
  $("fixed-paper-height-wrap").classList.toggle("hidden",$("paper-height-mode").value!=="fixed");
}
function readBillUiSettings(){
  return {paperWidth:$("paper-width").value,customPaperWidth:Number($("custom-paper-width").value||58),paperHeightMode:"auto",fixedPaperHeight:Number($("fixed-paper-height").value||150),receiptMarginTop:Number($("receipt-margin-top").value||0),receiptMarginRight:Number($("receipt-margin-right").value||0),receiptMarginBottom:Number($("receipt-margin-bottom").value||0),receiptMarginLeft:Number($("receipt-margin-left").value||0),receiptScale:Number($("receipt-scale").value||100),receiptFeedBottom:Number($("receipt-feed-bottom").value||0),receiptFont:$("receipt-font").value,receiptFontSize:Number($("receipt-font-size").value||12),receiptTitleSize:Number($("receipt-title-size").value||20),receiptTitleBold:$("receipt-title-bold").checked,receiptTitleItalic:$("receipt-title-italic").checked,receiptCompact:$("receipt-compact").checked,receiptHeaderText:$("receipt-header-text").value,receiptFooter:$("receipt-footer").value,receiptBottomNote:$("receipt-bottom-note").value,receiptShowShopName:$("receipt-show-shop-name").checked,receiptShowAddress:$("receipt-show-address").checked,receiptShowPhone:$("receipt-show-phone").checked,receiptShowHeaderText:$("receipt-show-header-text").checked,receiptShowOrderDate:$("receipt-show-order-date").checked,receiptShowCustomer:$("receipt-show-customer").checked,receiptShowCustomerPhone:$("receipt-show-customer-phone").checked,receiptShowDueDate:$("receipt-show-due-date").checked,receiptShowNote:$("receipt-show-note").checked,receiptShowPaid:$("receipt-show-paid").checked,receiptShowFooter:$("receipt-show-footer").checked,receiptShowBottomNote:$("receipt-show-bottom-note").checked};
}
function renderBillPreview(){
  if(!$('bill-preview'))return;
  const s={...appData.settings,...readBillUiSettings(),shopName:$('shop-name').value||appData.settings.shopName,address:$('shop-address').value||appData.settings.address,phone:$('shop-phone').value||appData.settings.phone};
  const p=$('bill-preview');
  if(window.GS334Raster){
    const demo=sample();
    const img=document.createElement('img');
    img.alt='Xem trước bill';img.src=window.GS334Raster.previewDataURL(demo,s,0,Math.max(1,Number(s.receiptCopies||1)));
    img.style.cssText='display:block;width:100%;height:auto;background:#fff';
    p.innerHTML='';p.style.padding='0';p.style.zoom='1';p.style.maxWidth=(Number(s.paperWidth)==58?'270px':'330px');p.appendChild(img);
    return;
  }
  p.textContent='Đang tải bộ dựng bill...';
}
async function testPrinterConnection(){
  await saveSettings();
  if(appData.settings.printerMode==="network"){
    setPrinterStatus("Đang kiểm tra...");
    const r=await window.posAPI.testNetworkPrinter({
      host:appData.settings.printerIp,
      port:appData.settings.printerPort
    });
    if(r.ok){
      setPrinterStatus(`Đã kết nối: ${appData.settings.printerIp}:${appData.settings.printerPort}`,"ok");
      toast("Kết nối máy in thành công");
    }else{
      setPrinterStatus(`Không kết nối được: ${r.error}`,"error");
      toast(`Kết nối thất bại: ${r.error}`);
    }
  }else{
    const selected=$("printer-select").value;
    const name=selected||"Máy in mặc định Windows";
    setPrinterStatus(`Đã chọn: ${name}`,"ok");
    toast(`Đã nhận máy in: ${name}`);
  }
}
function sample(){return{code:"PHIEU-IN-THU",createdAt:new Date().toISOString(),customerName:"Khách hàng mẫu",phone:"0900 000 000",dueDate:new Date(Date.now()+86400000).toISOString(),paymentStatus:"Chưa thanh toán",paidAmount:0,note:"Phiếu kiểm tra máy in",subtotal:12000,discount:0,total:12000,items:[{name:"Giặt sấy",unit:"kg",quantity:1,price:12000,total:12000}]}}

async function deleteSelectedOrders(){
  if(!isAdmin()||selectedOrderIds.size===0)return;
  const count=selectedOrderIds.size;
  if(!confirm(`Xóa vĩnh viễn ${count} đơn đã chọn?\n\nThao tác này không thể hoàn tác.`))return;
  const deletedOrders=appData.orders.filter(o=>selectedOrderIds.has(o.id));
  const codes=deletedOrders.map(o=>o.code);
  appData.orders=appData.orders.filter(o=>!selectedOrderIds.has(o.id));
  audit("DELETE_ORDERS",codes.join(", "));
  selectedOrderIds.clear();
  await persist();
  renderOrders();
  renderDashboard();
  toast(`Đã xóa ${count} đơn`);
  try{
    if(count===1){
      const o=deletedOrders[0];
      window.__GS334Notify?.inApp("GS334 · Có 1 đơn hàng đã được xóa",`${o?.customerName||"Khách lẻ"} · ${money(o?.total||0)}`);
    }else{
      window.__GS334Notify?.inApp("GS334 · Đã xóa đơn",`${count} đơn đã được xóa`);
    }
  }catch{}
}
async function exportExcelReport(){
  if(!isAdmin())return;
  const filtered=getFilteredOrders();
  const result=await window.posAPI.exportExcel({orders:filtered});
  if(result.ok)toast("Đã xuất báo cáo Excel");
  else if(!result.canceled)toast(`Xuất Excel lỗi: ${result.error||"Không xác định"}`);
}

function ensureMessagingData(){
  appData.conversations=Array.isArray(appData.conversations)?appData.conversations:[];
  appData.messaging=appData.messaging||{demoMode:true,zalo:{},facebook:{},autoReceived:true,autoReady:true};
  appData.messaging.zalo=appData.messaging.zalo||{};appData.messaging.facebook=appData.messaging.facebook||{};
}
function channelLabel(ch){return ch==="zalo"?"Zalo":"Facebook"}
function findConversationByPhone(phone){const p=String(phone||"").replace(/\D/g,"");return appData.conversations.find(c=>p&&String(c.phone||"").replace(/\D/g,"")===p)}
function queueOrderMessage(order,type){
  ensureMessagingData();
  let conv=findConversationByPhone(order.phone);
  if(!conv){conv={id:crypto.randomUUID(),channel:"zalo",customerName:order.customerName||"Khách hàng",phone:order.phone||"",unread:0,lastMessageAt:new Date().toISOString(),messages:[]};appData.conversations.unshift(conv)}
  const text=type==="received"
    ?`${appData.settings.shopName||"GIẶT SẤY 334"} đã tiếp nhận đơn ${order.code}. Dự kiến trả: ${order.dueDate?new Date(order.dueDate).toLocaleString("vi-VN"):"sẽ cập nhật"}. Tổng tiền: ${money(order.total)}.`
    :`Đơn ${order.code} của bạn đã hoàn thành. Bạn có thể đến ${appData.settings.shopName||"GIẶT SẤY 334"} để nhận đồ. Cảm ơn bạn!`;
  conv.messages.push({id:crypto.randomUUID(),direction:"out",text,at:new Date().toISOString(),status:"demo"});conv.lastMessageAt=new Date().toISOString();
}
function updateUnreadBadge(){ensureMessagingData();const n=appData.conversations.reduce((a,c)=>a+Number(c.unread||0),0);$("nav-unread").textContent=n;$("nav-unread").classList.toggle("hidden",!n)}
function renderMessages(){ensureMessagingData();updateUnreadBadge();const q=$("message-search").value.trim().toLowerCase(),ch=$("message-channel-filter").value;const list=appData.conversations.filter(c=>(!ch||c.channel===ch)&&(!q||[c.customerName,c.phone].some(v=>String(v||"").toLowerCase().includes(q)))).sort((a,b)=>new Date(b.lastMessageAt)-new Date(a.lastMessageAt));$("conversation-list").innerHTML=list.length?list.map(c=>{const last=c.messages?.at(-1);return`<div class="conversation-item ${activeConversationId===c.id?"active":""}" data-conversation="${c.id}"><div class="channel-dot ${c.channel}">${c.channel==="zalo"?"Z":"FB"}</div><div class="conversation-main"><div class="conversation-top"><b>${esc(c.customerName||c.phone||"Khách hàng")}</b><small>${c.lastMessageAt?new Date(c.lastMessageAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}):""}</small></div><small>${esc(last?.text||"Chưa có tin nhắn")}</small></div>${c.unread?`<span class="unread-dot">${c.unread}</span>`:""}</div>`}).join(""):'<div class="empty-state">Chưa có cuộc trò chuyện.</div>';document.querySelectorAll("[data-conversation]").forEach(x=>x.onclick=()=>openConversation(x.dataset.conversation));if(activeConversationId&&!appData.conversations.some(c=>c.id===activeConversationId))activeConversationId=null;if(activeConversationId)openConversation(activeConversationId,false)}
async function openConversation(id,rerender=true){ensureMessagingData();activeConversationId=id;const c=appData.conversations.find(x=>x.id===id);if(!c)return;c.unread=0;await persist();$("chat-empty").classList.add("hidden");$("chat-content").classList.remove("hidden");$("chat-customer-name").textContent=c.customerName||c.phone||"Khách hàng";$("chat-customer-meta").textContent=`${channelLabel(c.channel)}${c.phone?" · "+c.phone:""}`;const orders=appData.orders.filter(o=>c.phone&&String(o.phone||"").replace(/\D/g,"")===String(c.phone).replace(/\D/g,""));const spent=orders.filter(o=>o.status!=="Đã hủy").reduce((a,o)=>a+Number(o.total||0),0),debt=orders.reduce((a,o)=>a+Math.max(0,Number(o.total||0)-Number(o.paidAmount||0)),0);$("customer-summary").innerHTML=`<div><span>Số đơn</span><b>${orders.length}</b></div><div><span>Tổng chi</span><b>${money(spent)}</b></div><div><span>Công nợ</span><b>${money(debt)}</b></div><div><span>Đơn gần nhất</span><b>${orders[0]?.code||"Chưa có"}</b></div>`;$("chat-messages").innerHTML=(c.messages||[]).map(m=>`<div class="message ${m.direction}">${esc(m.text)}<time>${new Date(m.at).toLocaleString("vi-VN")}${m.status==="demo"?" · mô phỏng":""}</time></div>`).join("");$("chat-messages").scrollTop=$("chat-messages").scrollHeight;if(rerender)renderMessages();updateUnreadBadge()}
async function sendChatMessage(text){const c=appData.conversations.find(x=>x.id===activeConversationId);text=String(text||"").trim();if(!c||!text)return;c.messages.push({id:crypto.randomUUID(),direction:"out",text,at:new Date().toISOString(),status:"demo"});c.lastMessageAt=new Date().toISOString();audit("SEND_DEMO_MESSAGE",`${channelLabel(c.channel)}: ${c.customerName}`);await persist();$("chat-input").value="";openConversation(c.id);toast("Đã lưu tin nhắn mô phỏng")}
function fillMessageTemplate(text,conversation,order){const values={shop:appData.settings.shopName||"GIẶT SẤY 334",customer:conversation?.customerName||"mình",orderCode:order?.code||"[mã đơn]",dueDate:order?.dueDate?new Date(order.dueDate).toLocaleString("vi-VN"):"[thời gian trả]",total:money(order?.total||0),remaining:money(Math.max(0,Number(order?.total||0)-Number(order?.paidAmount||0)))};return String(text||"").replace(/\{(shop|customer|orderCode|dueDate|total|remaining)\}/g,(_,key)=>values[key])}
function templateText(type){const c=appData.conversations.find(x=>x.id===activeConversationId);const phone=String(c?.phone||"").replace(/\D/g,"");const order=[...appData.orders].reverse().find(o=>phone&&String(o.phone||"").replace(/\D/g,"")===phone);const defaults={received:"{shop} đã tiếp nhận đơn {orderCode}. Dự kiến trả: {dueDate}.",ready:"Đơn {orderCode} đã hoàn thành. Mình có thể đến nhận đồ rồi ạ.",thanks:"Cảm ơn mình đã sử dụng dịch vụ của {shop} ạ!"};return fillMessageTemplate(appData.messaging.templates?.[type]||defaults[type],c,order)}
function loadConnections(){const m=appData.messaging;$("zalo-account-name").value=m.zalo?.accountName||"";$("facebook-account-name").value=m.facebook?.accountName||"";$("auto-message-received").checked=m.autoReceived!==false;$("auto-message-ready").checked=m.autoReady!==false;$("template-received").value=m.templates?.received||"{shop} đã tiếp nhận đơn {orderCode}. Dự kiến trả: {dueDate}.";$("template-ready").value=m.templates?.ready||"Đơn {orderCode} đã hoàn thành. Mình có thể đến nhận đồ rồi ạ.";$("template-thanks").value=m.templates?.thanks||"Cảm ơn mình đã sử dụng dịch vụ của {shop} ạ!";updateSimpleConnectionStatus("zalo");updateSimpleConnectionStatus("facebook")}
function updateSimpleConnectionStatus(channel){const cfg=appData.messaging[channel]||{},el=$(channel+"-status");if(cfg.connected){el.textContent="Đã liên kết"+(cfg.accountName?`: ${cfg.accountName}`:"");el.classList.add("ok")}else{el.textContent="Chưa đăng nhập";el.classList.remove("ok")}}
async function openChannel(channel){const r=await window.posAPI.openChatChannel(channel);if(!r.ok)toast(`Không mở được ${channel}: ${r.error}`)}
async function markChannelConnected(channel){const name=$(channel+"-account-name").value.trim();appData.messaging[channel]={...(appData.messaging[channel]||{}),connected:true,accountName:name};await persist();updateSimpleConnectionStatus(channel);toast("Đã lưu trạng thái liên kết")}
async function saveMessageTemplates(){appData.messaging.templates={received:$("template-received").value.trim(),ready:$("template-ready").value.trim(),thanks:$("template-thanks").value.trim()};appData.messaging.autoReceived=$("auto-message-received").checked;appData.messaging.autoReady=$("auto-message-ready").checked;await persist();toast("Đã lưu mẫu tin nhắn")}

function bind(){
  $("quick-customer-search").oninput=renderMessages;
  $("quick-customer").onchange=()=>{renderQuickOrders();renderQuickCustomerInfo();};
  $("quick-order").onchange=renderQuickCustomerInfo;
  document.querySelectorAll("[data-quick-template]").forEach(b=>b.onclick=()=>{$("quick-message").value=quickTemplateText(b.dataset.quickTemplate)});
  $("copy-open-zalo").onclick=()=>copyAndOpen("zalo");
  $("copy-open-facebook").onclick=()=>copyAndOpen("facebook");
  $("copy-message").onclick=()=>copyOnly();
  $("open-zalo").onclick=()=>openChannel("zalo");
  $("open-facebook").onclick=()=>openChannel("facebook");
  $("save-message-templates").onclick=saveMessageTemplates;
  $("login-button").onclick=login;$("forgot-password-button").onclick=showForgotPassword;$("close-account-modal").onclick=closeAccountModal;$("account-modal").onclick=e=>{if(e.target.id==="account-modal")closeAccountModal()};$("copy-recovery-code").onclick=async()=>{await window.posAPI.copyText(appData.settings.recoveryCode||"");toast("Đã sao chép mã khôi phục")};$("custom-recovery-code").onclick=showCustomRecoveryCode;$("generate-recovery-code").onclick=showGenerateRecoveryCode;$("login-password").onkeydown=e=>{if(e.key==="Enter")login()};$("logout-button").onclick=logout;const resetButton=$("reset-app-button");if(resetButton)resetButton.onclick=()=>{if(confirm("Làm mới phần mềm ngay? Dữ liệu đã lưu sẽ được giữ nguyên."))window.location.reload()};document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>navigate(b.dataset.page));$("quick-new-order").onclick=()=>navigate("new-order");$("add-item").onclick=()=>{const s=appData.services.find(x=>x.active!==false);currentOrderItems.push({id:crypto.randomUUID(),serviceId:s?.id||"",quantity:1,price:s?.price||0});renderOrderItems()};$("discount").oninput=recalc;$("paid-amount").oninput=recalc;$("save-order").onclick=()=>saveOrder("save");$("save-print-order").onclick=()=>saveOrder("receipt");$("save-print-all").onclick=()=>saveOrder("all");$("order-search").oninput=renderOrders;$("status-filter").onchange=renderOrders;
$("select-all-orders").onchange=()=>{
  if(!isAdmin())return;
  document.querySelectorAll(".order-select").forEach(cb=>{
    cb.checked=$("select-all-orders").checked;
    if(cb.checked)selectedOrderIds.add(cb.dataset.selectOrder);
    else selectedOrderIds.delete(cb.dataset.selectOrder);
  });
  updateBulkSelectionUI();
};
$("delete-selected-orders").onclick=deleteSelectedOrders;
$("export-excel").onclick=exportExcelReport;$("close-modal").onclick=closeOrderModal;$("order-modal").onclick=e=>{if(e.target.id==="order-modal")closeOrderModal()};$("add-service").onclick=async()=>{appData.services.push({id:crypto.randomUUID(),name:"Dịch vụ mới",unit:"kg",price:0,active:true});await persist();renderServices()};$("add-user").onclick=async()=>{appData.users.push({id:crypto.randomUUID(),username:`nhanvien${appData.users.length}`,displayName:"Nhân viên mới",role:"staff",passwordHash:await window.posAPI.hashPassword("123456"),active:true});await persist();renderUsers();toast("Mật khẩu mặc định: 123456")};$("printer-mode").onchange=togglePrinterMode;
  ["paper-width","custom-paper-width","paper-height-mode","fixed-paper-height","receipt-margin-top","receipt-margin-right","receipt-margin-bottom","receipt-margin-left","receipt-scale","receipt-feed-bottom","receipt-copies","receipt-cut-between-copies","receipt-final-cut","receipt-cut-mode","receipt-feed-before-cut","receipt-show-copy-label","receipt-copy-1-label","receipt-copy-2-label","receipt-copy-3-label","receipt-font","receipt-font-size","receipt-title-size","receipt-title-bold","receipt-title-italic","receipt-compact","receipt-header-text","receipt-footer","receipt-bottom-note","receipt-show-shop-name","receipt-show-address","receipt-show-phone","receipt-show-header-text","receipt-show-order-date","receipt-show-customer","receipt-show-customer-phone","receipt-show-due-date","receipt-show-note","receipt-show-paid","receipt-show-footer","receipt-show-bottom-note","shop-name","shop-address","shop-phone"].forEach(id=>{const el=$(id);if(el){el.addEventListener("input",()=>{if(id==="paper-width")toggleCustomPaper();if(id==="paper-height-mode")toggleFixedPaperHeight();renderBillPreview()});el.addEventListener("change",()=>{if(id==="paper-width")toggleCustomPaper();if(id==="paper-height-mode")toggleFixedPaperHeight();renderBillPreview()})}});
$("save-settings").onclick=saveSettings;
$("test-connection").onclick=testPrinterConnection;$("test-print").onclick=async()=>{await saveSettings();printReceipt(sample())};$("test-label").onclick=async()=>{await saveSettings();printLabel(sample())};
async function refreshBackupInfo(){const el=$("backup-status");if(!el)return;const r=await window.posAPI.getBackupInfo();if(!r.ok){el.textContent="Không đọc được thư mục Backup";return}const latest=r.latest?` • Gần nhất: ${new Date(r.latest.updatedAt).toLocaleString("vi-VN")}`:" • Chưa có bản sao lưu";el.innerHTML=`<b>Thư mục:</b> ${esc(r.path)}<br><b>Số bản:</b> ${r.count}${latest}`}
$("backup-quick").onclick=async()=>{const r=await window.posAPI.quickBackup();if(r.ok){toast("Đã sao lưu nhanh thành công");await refreshBackupInfo()}else if(r.error)alert(r.error)};
$("backup-export").onclick=async()=>{const r=await window.posAPI.exportBackup();if(r.ok){toast("Đã lưu file sao lưu");await refreshBackupInfo()}else if(r.error)alert(r.error)};
$("backup-open-folder").onclick=async()=>{const r=await window.posAPI.openBackupFolder();if(!r.ok&&r.error)alert(r.error)};
if($("add-promotion"))$("add-promotion").onclick=()=>openPromotionEditor();
$("backup-import").onclick=async()=>{if(!confirm("Khôi phục sẽ thay toàn bộ dữ liệu hiện tại. Phần mềm sẽ tự tạo một bản cứu hộ trước khi thay thế. Tiếp tục?"))return;const r=await window.posAPI.importBackup();if(r.ok){appData=r.data;toast("Đã khôi phục dữ liệu thành công");navigate("dashboard")}else if(r.error)alert(r.error)};
refreshBackupInfo()}

function customerKey(order){return String(order.phone||"").replace(/\D/g,"")||`name:${String(order.customerName||"").trim().toLowerCase()}`}
function quickCustomers(){
  const map=new Map();
  [...appData.orders].reverse().forEach(o=>{
    const key=customerKey(o); if(!key||key==="name:")return;
    if(!map.has(key))map.set(key,{key,name:o.customerName||"Khách hàng",phone:o.phone||""});
  });
  return [...map.values()];
}
function renderMessages(){
  const select=$("quick-customer"), previous=select.value, q=$("quick-customer-search").value.trim().toLowerCase();
  const customers=quickCustomers().filter(c=>!q||`${c.name} ${c.phone}`.toLowerCase().includes(q));
  select.innerHTML=customers.length?customers.map(c=>`<option value="${esc(c.key)}">${esc(c.name)}${c.phone?` · ${esc(c.phone)}`:""}</option>`).join(""):'<option value="">Chưa có khách hàng</option>';
  if(customers.some(c=>c.key===previous))select.value=previous;
  renderQuickOrders(); renderQuickCustomerInfo();
}
function selectedQuickCustomer(){return quickCustomers().find(c=>c.key===$("quick-customer").value)}
function ordersForQuickCustomer(){const c=selectedQuickCustomer();return c?appData.orders.filter(o=>customerKey(o)===c.key).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)):[]}
function renderQuickOrders(){
  const orders=ordersForQuickCustomer();
  $("quick-order").innerHTML=orders.length?orders.map(o=>`<option value="${o.id}">${esc(o.code)} · ${money(o.total)} · ${esc(o.status)}</option>`).join(""):'<option value="">Chưa có đơn</option>';
}
function selectedQuickOrder(){return appData.orders.find(o=>o.id===$("quick-order").value)||ordersForQuickCustomer()[0]}
function renderQuickCustomerInfo(){
  const c=selectedQuickCustomer(), orders=ordersForQuickCustomer(), o=selectedQuickOrder();
  if(!c){$("quick-customer-info").innerHTML='<div class="customer-info-empty">Chưa chọn khách hàng.</div>';return}
  const spent=orders.filter(x=>x.status!=="Đã hủy").reduce((a,x)=>a+Number(x.total||0),0);
  const debt=orders.reduce((a,x)=>a+Math.max(0,Number(x.total||0)-Number(x.paidAmount||0)),0);
  $("quick-customer-info").innerHTML=`<div class="quick-info-list"><div class="quick-info-row"><span>Tên khách</span><b>${esc(c.name)}</b></div><div class="quick-info-row"><span>Số điện thoại</span><b>${esc(c.phone||"Chưa có")}</b></div><div class="quick-info-row"><span>Số đơn</span><b>${orders.length}</b></div><div class="quick-info-row"><span>Tổng chi</span><b>${money(spent)}</b></div><div class="quick-info-row"><span>Công nợ</span><b>${money(debt)}</b></div><div class="quick-info-row"><span>Đơn đang chọn</span><b>${esc(o?.code||"Chưa có")}</b></div></div>`;
}
function quickTemplateText(type){
  const c=selectedQuickCustomer(), order=selectedQuickOrder();
  const conversation={customerName:c?.name||"mình",phone:c?.phone||""};
  const defaults={received:"{shop} đã tiếp nhận đơn {orderCode}. Dự kiến trả: {dueDate}. Tổng tiền: {total}.",ready:"Đơn {orderCode} đã hoàn thành. Mình có thể đến nhận đồ rồi ạ. Số tiền còn lại: {remaining}.",thanks:"Cảm ơn mình đã sử dụng dịch vụ của {shop} ạ!"};
  return fillMessageTemplate(appData.messaging?.templates?.[type]||defaults[type],conversation,order);
}
async function copyOnly(){const text=$("quick-message").value.trim();if(!text)return toast("Chưa có nội dung tin nhắn");await window.posAPI.copyText(text);toast("Đã sao chép tin nhắn")}
async function copyAndOpen(channel){const text=$("quick-message").value.trim();if(!text)return toast("Chưa có nội dung tin nhắn");await window.posAPI.copyText(text);const r=await window.posAPI.openChatChannel(channel);toast(r.ok?`Đã sao chép. Chọn khách rồi nhấn Ctrl + V để gửi.`:`Không mở được ${channel}: ${r.error}`)}
function loadConnections(){
  ensureMessagingData();
  $("template-received").value=appData.messaging.templates?.received||"{shop} đã tiếp nhận đơn {orderCode}. Dự kiến trả: {dueDate}. Tổng tiền: {total}.";
  $("template-ready").value=appData.messaging.templates?.ready||"Đơn {orderCode} đã hoàn thành. Mình có thể đến nhận đồ rồi ạ. Số tiền còn lại: {remaining}.";
  $("template-thanks").value=appData.messaging.templates?.thanks||"Cảm ơn mình đã sử dụng dịch vụ của {shop} ạ!";
}
async function saveMessageTemplates(){ensureMessagingData();appData.messaging.templates={received:$("template-received").value.trim(),ready:$("template-ready").value.trim(),thanks:$("template-thanks").value.trim()};await persist();toast("Đã lưu mẫu tin nhắn")}
function updateUnreadBadge(){}
async function init(){appData=await window.posAPI.loadData();ensureSecurityData();ensureMessagingData();ensurePromotions();await persist();bind();updateUnreadBadge();const saved=sessionStorage.getItem("gs334-user");if(saved){currentUser=JSON.parse(saved);$("login-screen").classList.add("hidden");$("app-shell").classList.remove("hidden");applyRole();navigate("dashboard")}}

function ensureCustomTemplates(){ensureMessagingData();if(!Array.isArray(appData.messaging.customTemplates)||!appData.messaging.customTemplates.length){const t=appData.messaging.templates||{};appData.messaging.customTemplates=[{id:"received",name:"Đã nhận đơn",text:t.received||"{shop} đã tiếp nhận đơn {orderCode}. Dự kiến trả: {dueDate}. Tổng tiền: {total}."},{id:"ready",name:"Đồ đã xong",text:t.ready||"Đơn {orderCode} đã hoàn thành. Mình có thể đến nhận đồ rồi ạ. Số tiền còn lại: {remaining}."},{id:"thanks",name:"Cảm ơn khách",text:t.thanks||"Cảm ơn {customer} đã sử dụng dịch vụ của {shop} ạ!"}]}}
function renderOrders(){const q=$("order-search").value.trim().toLowerCase(),st=$("status-filter").value;const arr=appData.orders.filter(o=>(!q||[o.code,o.customerName,o.phone].some(v=>String(v||"").toLowerCase().includes(q)))&&(!st||o.status===st));$("orders-table").innerHTML=arr.map(o=>`<tr>${isAdmin()?`<td class="checkbox-col"><input class="order-select" type="checkbox" data-select-order="${o.id}" ${selectedOrderIds.has(o.id)?"checked":""}></td>`:""}<td><strong>${esc(o.code)}</strong>${overdueBadgeHtml(o)}<br><small>${new Date(o.createdAt).toLocaleString("vi-VN")}</small></td><td>${esc(o.customerName||"-")}<br><small>${esc(o.phone||"-")}</small></td><td>${o.items.map(i=>`${esc(i.name)} (${i.quantity} ${esc(i.unit)})`).join("<br>")}</td><td><strong>${money(o.total)}</strong></td><td>${esc(o.paymentStatus)}<br><small>Còn ${money(Math.max(0,o.total-o.paidAmount))}</small></td><td>${badge(o.status)}</td><td><div class="table-actions"><button data-view="${o.id}">Xem</button><button class="primary" data-print="${o.id}">In</button></div></td></tr>`).join("");$("orders-empty").classList.toggle("hidden",arr.length>0);document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>openModal(b.dataset.view));document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>printReceipt(appData.orders.find(o=>o.id===b.dataset.print)));document.querySelectorAll("[data-select-order]").forEach(cb=>cb.onchange=()=>{cb.checked?selectedOrderIds.add(cb.dataset.selectOrder):selectedOrderIds.delete(cb.dataset.selectOrder);updateBulkSelectionUI()});updateBulkSelectionUI()}
function setupReportDefaults(){const now=new Date(),iso=now.toISOString().slice(0,10);if($("report-day")&&!$("report-day").value)$("report-day").value=iso;if($("report-month")&&!$("report-month").value)$("report-month").value=iso.slice(0,7);if($("report-year")&&!$("report-year").value)$("report-year").value=now.getFullYear();if($("report-from")&&!$("report-from").value)$("report-from").value=iso;if($("report-to")&&!$("report-to").value)$("report-to").value=iso}
function toggleReportFields(){const type=$("report-type")?.value||"day";["day","month","year","from","to"].forEach(k=>$("report-"+k+"-wrap")?.classList.add("hidden"));if(type==="range"){$("report-from-wrap").classList.remove("hidden");$("report-to-wrap").classList.remove("hidden")}else $("report-"+type+"-wrap").classList.remove("hidden")}
function reportBounds(){const type=$("report-type").value;let start,end,label;if(type==="day"){const v=$("report-day").value;start=new Date(v+"T00:00:00");end=new Date(v+"T23:59:59.999");label=`Ngày ${start.toLocaleDateString("vi-VN")}`}else if(type==="month"){const [y,m]=$("report-month").value.split("-").map(Number);start=new Date(y,m-1,1);end=new Date(y,m,0,23,59,59,999);label=`Tháng ${m}/${y}`}else if(type==="year"){const y=Number($("report-year").value);start=new Date(y,0,1);end=new Date(y,11,31,23,59,59,999);label=`Năm ${y}`}else{start=new Date($("report-from").value+"T00:00:00");end=new Date($("report-to").value+"T23:59:59.999");label=`Từ ${start.toLocaleDateString("vi-VN")} đến ${end.toLocaleDateString("vi-VN")}`}return{start,end,label}}
function runRevenueReport(){const{start,end,label}=reportBounds();if(isNaN(start)||isNaN(end)||start>end)return toast("Khoảng thời gian không hợp lệ");const orders=appData.orders.filter(o=>o.status!=="Đã hủy"&&new Date(o.createdAt)>=start&&new Date(o.createdAt)<=end),revenue=orders.reduce((a,o)=>a+Number(o.total||0),0),paid=orders.reduce((a,o)=>a+Math.min(Number(o.paidAmount||0),Number(o.total||0)),0);$("report-orders").textContent=orders.length;$("report-revenue").textContent=money(revenue);$("report-paid").textContent=money(paid);$("report-debt").textContent=money(Math.max(0,revenue-paid));$("report-period").textContent=label}
const _renderDashboardV27=renderDashboard;renderDashboard=function(){_renderDashboardV27();setupReportDefaults();toggleReportFields();runRevenueReport()};
function renderQuickTemplateButtons(){ensureCustomTemplates();const el=$("quick-template-buttons");if(!el)return;el.innerHTML=appData.messaging.customTemplates.map(t=>`<button data-custom-template="${t.id}">${esc(t.name)}</button>`).join("");el.querySelectorAll("[data-custom-template]").forEach(b=>b.onclick=()=>{const t=appData.messaging.customTemplates.find(x=>x.id===b.dataset.customTemplate),c=selectedQuickCustomer(),order=selectedQuickOrder();$("quick-message").value=fillMessageTemplate(t?.text||"",{customerName:c?.name||"mình",phone:c?.phone||""},order)})}
const _renderMessagesV27=renderMessages;renderMessages=function(){_renderMessagesV27();renderQuickTemplateButtons()};
function renderCustomTemplateEditor(){ensureCustomTemplates();const el=$("message-template-list");if(!el)return;el.innerHTML=appData.messaging.customTemplates.map(t=>`<div class="custom-template-row" data-template-id="${t.id}"><label>Tên nút<input class="ct-name" value="${esc(t.name)}" placeholder="Ví dụ: Đã nhận đơn"></label><label>Nội dung<textarea class="ct-text" rows="4">${esc(t.text)}</textarea></label><button class="danger delete-template">Xóa</button></div>`).join("");el.querySelectorAll(".delete-template").forEach(b=>b.onclick=()=>{const row=b.closest("[data-template-id]");if(appData.messaging.customTemplates.length===1)return toast("Phải giữ ít nhất một mẫu");appData.messaging.customTemplates=appData.messaging.customTemplates.filter(t=>t.id!==row.dataset.templateId);renderCustomTemplateEditor()})}
loadConnections=function(){ensureCustomTemplates();renderCustomTemplateEditor()};
saveMessageTemplates=async function(){ensureCustomTemplates();const rows=[...document.querySelectorAll("[data-template-id]")];appData.messaging.customTemplates=rows.map(r=>({id:r.dataset.templateId,name:r.querySelector(".ct-name").value.trim()||"Mẫu tin",text:r.querySelector(".ct-text").value.trim()}));await persist();renderQuickTemplateButtons();toast("Đã lưu mẫu tin nhắn")};
function addCustomTemplate(){ensureCustomTemplates();appData.messaging.customTemplates.push({id:crypto.randomUUID(),name:"Mẫu mới",text:"Xin chào {customer}, "});renderCustomTemplateEditor()}
setTimeout(()=>{$("report-type")&&($("report-type").onchange=()=>{toggleReportFields();runRevenueReport()});$("run-revenue-report")&&($("run-revenue-report").onclick=runRevenueReport);$("add-message-template")&&($("add-message-template").onclick=addCustomTemplate);$("save-message-templates")&&($("save-message-templates").onclick=saveMessageTemplates)},0);



/* ===== V3 STABLE: pickup alerts isolated from login and core order logic ===== */
function localDayStart(value){
  const d=new Date(value);
  return new Date(d.getFullYear(),d.getMonth(),d.getDate());
}
function pickupAgeDays(order){
  if(!order||["Hoàn thành","Đã hủy"].includes(order.status))return 0;
  const source=order.createdAt;
  if(!source)return 0;
  return Math.max(0,Math.floor((localDayStart(new Date())-localDayStart(source))/86400000));
}
function pickupIsLate(order){
  return !["Hoàn thành","Đã hủy"].includes(order.status)&&pickupAgeDays(order)>ORDER_OVERDUE_GRACE_DAYS;
}
function pickupAgeHtml(order){
  if(["Hoàn thành","Đã hủy"].includes(order.status))return '<span class="muted">Đã kết thúc</span>';
  const days=pickupAgeDays(order);
  if(days===0)return '<span class="pickup-age fresh">Hôm nay</span>';
  if(days<=ORDER_OVERDUE_GRACE_DAYS)return `<span class="pickup-age">${days} ngày</span>`;
  return `<span class="pickup-age late">Quá hẹn ${days-ORDER_OVERDUE_GRACE_DAYS} ngày</span>`;
}
function prioritySortedOrders(list){
  return [...list].sort((a,b)=>{
    const al=pickupIsLate(a)?1:0,bl=pickupIsLate(b)?1:0;
    if(al!==bl)return bl-al;
    if(al&&bl)return pickupAgeDays(b)-pickupAgeDays(a);
    return new Date(b.createdAt||0)-new Date(a.createdAt||0);
  });
}
let lastPickupWarningDate='';
function showPickupWarningOncePerDay(){
  const lateCount=appData.orders.filter(pickupIsLate).length;
  const today=new Date().toDateString();
  if(lateCount>0&&lastPickupWarningDate!==today){
    lastPickupWarningDate=today;
    toast(`Có ${lateCount} đơn đã quá hẹn khách chưa lấy`);
  }
}

function renderOrdersLegacyUnused(){
  const q=$("order-search").value.trim().toLowerCase(),st=$("status-filter").value;
  const filtered=appData.orders.filter(o=>(!q||[o.code,o.customerName,o.phone].some(v=>String(v||"").toLowerCase().includes(q)))&&(!st||o.status===st));
  const arr=prioritySortedOrders(filtered);
  $("orders-table").innerHTML=arr.map(o=>`<tr class="${pickupIsLate(o)?"long-waiting-row":""}">
    ${isAdmin()?`<td class="checkbox-col"><input class="order-select" type="checkbox" data-select-order="${o.id}" ${selectedOrderIds.has(o.id)?"checked":""}></td>`:""}
    <td><strong>${esc(o.code)}</strong>${pickupIsLate(o)?'<br><span class="badge red">Cần liên hệ khách</span>':isOverdue(o)?'<br><span class="badge red">Quá hẹn</span>':""}<br><small>${new Date(o.createdAt).toLocaleString("vi-VN")}</small></td>
    <td>${esc(o.customerName||"-")}<br><small>${esc(o.phone||"-")}</small></td>
    <td>${o.items.map(i=>`${esc(i.name)} (${i.quantity} ${esc(i.unit)})`).join("<br>")}</td>
    <td><strong>${money(o.total)}</strong></td>
    <td>${esc(o.paymentStatus)}<br><small>Còn ${money(Math.max(0,o.total-o.paidAmount))}</small></td>
    <td>${badge(o.status)}</td>
    <td>${pickupAgeHtml(o)}</td>
    <td><div class="table-actions"><button data-view="${o.id}">Xem</button><button class="primary" data-print="${o.id}">In</button></div></td>
  </tr>`).join("");
  $("orders-empty").classList.toggle("hidden",arr.length>0);
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>openModal(b.dataset.view));
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>printReceipt(appData.orders.find(o=>o.id===b.dataset.print)));
  document.querySelectorAll("[data-select-order]").forEach(cb=>cb.onchange=()=>{cb.checked?selectedOrderIds.add(cb.dataset.selectOrder):selectedOrderIds.delete(cb.dataset.selectOrder);updateBulkSelectionUI()});
  updateBulkSelectionUI();
  showPickupWarningOncePerDay();
};

const renderDashboardCoreV3=renderDashboard;
renderDashboard=function(){
  renderDashboardCoreV3();
  const late=appData.orders.filter(pickupIsLate);
  $("stat-overdue").textContent=appData.orders.filter(o=>isOverdue(o)||pickupIsLate(o)).length;
  const priority=prioritySortedOrders(appData.orders.filter(o=>pickupIsLate(o)||isOverdue(o)||o.status==="Chờ khách lấy")).slice(0,10);
  $("priority-orders").innerHTML=priority.length?priority.map(o=>`<div class="priority-row ${pickupIsLate(o)||isOverdue(o)?"overdue":""}"><div><b>${esc(o.code)} — ${esc(o.customerName||o.phone||"Khách lẻ")}</b><small>${pickupIsLate(o)?`Khách chưa lấy ${pickupAgeDays(o)} ngày · Cần liên hệ ngay`:isOverdue(o)?`Quá hẹn ${overdueDays(o)} ngày`:`Chờ khách lấy ${pickupAgeDays(o)} ngày`} · ${money(o.total)}</small></div><button class="secondary" data-dash="${o.id}">Xem</button></div>`).join(""):'<div class="empty-state">Không có đơn cần ưu tiên.</div>';
  document.querySelectorAll("[data-dash]").forEach(b=>b.onclick=()=>openModal(b.dataset.dash));
  showPickupWarningOncePerDay();
};

// Refresh day-sensitive dashboard/order counters without touching authentication.
setInterval(()=>{
  if(!currentUser)return;
  if($("page-dashboard").classList.contains("active"))renderDashboard();
  if($("page-orders").classList.contains("active"))renderOrders();
},60000);



async function renderMobileServerInfo(providedInfo){
  const wrap=$("mobile-server-content"),status=$("mobile-server-status");
  if(!wrap||!status||!window.posAPI.getMobileInfo)return;
  try{
    const info=providedInfo||await window.posAPI.getMobileInfo();
    const online=info.onlineUrl||"";
    const lan=(info.urls||[])[0]||"";
    const selected=online||lan;
    const cf=info.cloudflare||{};
    if(online){status.textContent="Online";status.classList.add("mobile-server-status-ok")}
    else if(cf.status==="downloading"){status.textContent="Đang tải Cloudflare";status.classList.remove("mobile-server-status-ok")}
    else if(cf.status==="starting"){status.textContent="Đang kết nối";status.classList.remove("mobile-server-status-ok")}
    else if(cf.status==="error"||cf.status==="offline"){status.textContent="Online bị lỗi";status.classList.remove("mobile-server-status-ok")}
    else{status.textContent=lan?"Chỉ LAN":"Chưa có mạng";status.classList.toggle("mobile-server-status-ok",Boolean(lan))}
    let qr="";if(selected){try{qr=await window.posAPI.getMobileQr(selected)}catch(e){}}
    const onlineBlock=online
      ? `<div><b>Link dùng mọi Wi-Fi/4G/5G</b><div class="mobile-url">${esc(online)}</div></div>`
      : `<div><b>Mobile Online</b><div class="mobile-instructions">${cf.status==="downloading"?"Đang tự tải Cloudflare Tunnel lần đầu...":cf.status==="starting"?"Đang tạo link online...":esc(cf.error||"Chưa kết nối được Cloudflare Tunnel.")}</div><button class="secondary" id="restart-mobile-online">Kết nối lại Online</button></div>`;
    const lanBlock=lan?`<div class="mobile-instructions"><b>Link LAN dự phòng:</b> ${esc(lan)}</div>`:'<div class="mobile-instructions">Chưa tìm thấy IP Wi-Fi/LAN của máy tính.</div>';
    wrap.innerHTML=`${qr?`<div class="mobile-qr-wrap"><img class="mobile-qr" src="${qr}" alt="QR điện thoại"><button class="secondary mobile-copy-qr" id="copy-mobile-qr">Sao chép QR</button></div>`:""}<div>${onlineBlock}${lanBlock}<div class="mobile-instructions" style="margin-top:10px">Quét QR bằng Camera. Link Online dùng được ở Wi-Fi khác hoặc 4G/5G, miễn là phần mềm trên máy tính đang mở và có Internet.</div></div>`;
    const copyQr=$("copy-mobile-qr");if(copyQr)copyQr.onclick=async()=>{copyQr.disabled=true;const oldText=copyQr.textContent;copyQr.textContent="Đang sao chép...";try{const r=await window.posAPI.copyImage(qr);if(!r||!r.ok)throw new Error(r&&r.error||"Không sao chép được QR");toast("Đã sao chép QR — mở Zalo/Messenger và nhấn Ctrl + V");copyQr.textContent="Đã sao chép ✓";setTimeout(()=>{copyQr.textContent=oldText;copyQr.disabled=false},1500)}catch(e){toast(e.message||"Không sao chép được QR");copyQr.textContent=oldText;copyQr.disabled=false}};
    const retry=$("restart-mobile-online");if(retry)retry.onclick=async()=>{retry.disabled=true;retry.textContent="Đang kết nối...";try{await window.posAPI.restartMobileOnline()}catch(e){toast(e.message||"Không kết nối được")};setTimeout(()=>renderMobileServerInfo(),1200)};
  }catch(e){status.textContent="Lỗi";wrap.textContent="Không lấy được trạng thái Mobile."}
}

const loadSettingsV31=loadSettings;
loadSettings=function(){loadSettingsV31()};

if(window.posAPI.onDataChanged)window.posAPI.onDataChanged(async()=>{appData=await window.posAPI.loadData();if(!currentUser)return;if($("page-dashboard").classList.contains("active"))renderDashboard();if($("page-orders").classList.contains("active"))renderOrders();toast("Dữ liệu vừa được cập nhật từ điện thoại")});

// Cloud build initializes after cloud-overrides.js loads.

// Customer autocomplete + configurable promotion milestones
let selectedLoyaltyCustomerKey="";
let appliedPromotionId="";
function normalizePhone(v=""){return String(v).replace(/\D/g,"")}
function normalizeSearch(v=""){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().trim()}
function customerIdentity(name,phone){const n=normalizeSearch(name),p=normalizePhone(phone);if(n&&p)return `np:${n}|${p}`;if(p)return `p:${p}`;return `n:${n}`}
function customerDirectory(){
  const map=new Map();for(const o of appData.orders||[]){const key=customerIdentity(o.customerName,o.phone);if(key==="n:")continue;const old=map.get(key)||{key,name:o.customerName||"",phone:o.phone||"",orders:[],lastAt:""};if(o.customerName)old.name=o.customerName;if(o.phone)old.phone=o.phone;old.orders.push(o);if(!old.lastAt||new Date(o.createdAt)>new Date(old.lastAt))old.lastAt=o.createdAt;map.set(key,old)}
  return [...map.values()].map(c=>{const completed=c.orders.filter(o=>o.status==="Hoàn thành").length;return {...c,completed,nextVisit:completed+1,totalOrders:c.orders.filter(o=>o.status!=="Đã hủy").length}}).sort((a,b)=>new Date(b.lastAt)-new Date(a.lastAt));
}
function currentCustomerRecord(){const key=selectedLoyaltyCustomerKey||customerIdentity($("customer-name")?.value,$("customer-phone")?.value);return customerDirectory().find(c=>c.key===key)||null}
function eligiblePromotions(c){if(!c)return[];return activePromotions().filter(p=>p.visitNumber===c.nextVisit)}
function renderLoyaltyCard(){
  const el=$("loyalty-card");if(!el)return;const c=currentCustomerRecord();if(!c){el.classList.add("hidden");el.innerHTML="";return}const promos=eligiblePromotions(c),applied=promos.find(p=>p.id===appliedPromotionId);
  el.classList.toggle("reward-ready",promos.length>0);el.classList.remove("hidden");
  const nextMilestone=activePromotions().find(p=>p.visitNumber>c.nextVisit);const status=promos.length?`${promos.length} khuyến mãi dùng được cho lần này`:nextMilestone?`Mốc tiếp theo: lần ${nextMilestone.visitNumber} — ${esc(nextMilestone.name)}`:"Chưa có mốc khuyến mãi tiếp theo";
  el.innerHTML=`<div class="loyalty-head"><strong>🎁 Khách đã hoàn thành ${c.completed} lần</strong><span>Lần tiếp theo: ${c.nextVisit}</span></div><div class="loyalty-meta"><span>${status}</span><span>Tổng đơn: ${c.totalOrders}</span></div>${promos.map(p=>`<div class="loyalty-reward"><div><b>${esc(p.name)}</b><small>${esc(promotionDescription(p))}</small></div><button type="button" class="secondary" data-apply-promo="${p.id}">${appliedPromotionId===p.id?"Đã áp dụng ✓":"Áp dụng"}</button></div>`).join("")}`;
  el.querySelectorAll('[data-apply-promo]').forEach(b=>b.onclick=()=>{const p=promos.find(x=>x.id===b.dataset.applyPromo);if(!p)return;const turningOff=appliedPromotionId===p.id;appliedPromotionId=turningOff?"":p.id;if(turningOff){$("discount-type").value="amount";setMoneyInputValue($("discount"),0);toast("Đã bỏ khuyến mãi")}else{const sub=currentOrderItems.reduce((a,i)=>a+i.quantity*i.price,0),amount=promotionDiscountAmount(p,sub);$("discount-type").value="amount";setMoneyInputValue($("discount"),amount);toast(`Đã áp dụng: ${p.name}`)}recalc();renderLoyaltyCard()});
}
function showCustomerSuggestions(){const box=$("customer-suggestions"),input=$("customer-name");if(!box||!input)return;const q=normalizeSearch(input.value),phoneQ=normalizePhone(input.value);if(!q){box.classList.add("hidden");return}const rows=customerDirectory().filter(c=>(q&&normalizeSearch(c.name).includes(q))||(phoneQ&&normalizePhone(c.phone).includes(phoneQ))).slice(0,8);if(!rows.length){box.classList.add("hidden");return}box.innerHTML=rows.map(c=>`<button type="button" class="customer-suggestion" data-customer-key="${esc(c.key)}"><span><strong>${esc(c.name||"Khách không tên")}</strong><small>${esc(c.phone||"Chưa có số điện thoại")}</small></span><span class="visit-count">${c.completed} lần</span></button>`).join("");box.classList.remove("hidden");box.querySelectorAll("[data-customer-key]").forEach(b=>b.onclick=()=>{const c=customerDirectory().find(x=>x.key===b.dataset.customerKey);if(!c)return;$("customer-name").value=c.name;$("customer-phone").value=c.phone;selectedLoyaltyCustomerKey=c.key;appliedPromotionId="";box.classList.add("hidden");renderLoyaltyCard();toast("Đã chọn khách cũ")})}
const resetOrderFormPromo=resetOrderForm;resetOrderForm=function(){resetOrderFormPromo();selectedLoyaltyCustomerKey="";appliedPromotionId="";const b=$("customer-suggestions");if(b)b.classList.add("hidden");renderLoyaltyCard()};
const collectPromo=collect;collect=function(){const o=collectPromo();if(!o)return null;o.customerKey=customerIdentity(o.customerName,o.phone);o.appliedPromotionId=appliedPromotionId||"";o.loyaltyRewardUsed=!!appliedPromotionId;return o};
(()=>{const n=$("customer-name"),p=$("customer-phone");if(n&&!n.dataset.loyaltyBound){n.dataset.loyaltyBound="1";n.addEventListener("input",()=>{selectedLoyaltyCustomerKey="";appliedPromotionId="";showCustomerSuggestions();renderLoyaltyCard()});n.addEventListener("focus",showCustomerSuggestions)}if(p&&!p.dataset.loyaltyBound){p.dataset.loyaltyBound="1";p.addEventListener("input",()=>{selectedLoyaltyCustomerKey="";appliedPromotionId="";renderLoyaltyCard()})}document.addEventListener("click",e=>{const box=$("customer-suggestions");if(box&&!e.target.closest(".customer-autocomplete-label"))box.classList.add("hidden")})})();

// V3.6.8 - show customer visit count and order time in order list/detail
function orderCustomerLoyalty(order){
  const key=customerIdentity(order?.customerName,order?.phone);
  return customerDirectory().find(c=>c.key===key)||{completed:0,nextVisit:1,totalOrders:0};
}
function formatOrderTime(value){
  if(!value)return "-";
  const d=new Date(value);return Number.isNaN(d.getTime())?"-":d.toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"});
}
function orderDateKey(value,mode){
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return "";
  const y=String(d.getFullYear()),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return mode==="day"?`${y}-${m}-${day}`:mode==="month"?`${y}-${m}`:mode==="year"?y:"";
}
function getFilteredOrders(){
  const q=$("order-search")?.value.trim().toLowerCase()||"",st=$("status-filter")?.value||"";
  const mode=$("date-filter-mode")?.value||"day",value=$("date-filter-value")?.value||"";
  return (appData.orders||[]).filter(o=>{
    const matchesText=!q||[o.code,o.customerName,o.phone].some(v=>String(v||"").toLowerCase().includes(q));
    const matchesStatus=!st||o.status===st;
    const matchesDate=!value||orderDateKey(o.createdAt,mode)===value;
    return matchesText&&matchesStatus&&matchesDate;
  });
}
function todayFilterValue(mode="day"){
  const now=new Date(),y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,"0"),d=String(now.getDate()).padStart(2,"0");
  return mode==="day"?`${y}-${m}-${d}`:mode==="month"?`${y}-${m}`:String(y);
}
function updateDateFilterControl(forceDefault=false){
  const modeEl=$("date-filter-mode"),input=$("date-filter-value");if(!modeEl||!input)return;
  const mode=modeEl.value||"day";
  if(!modeEl.value)modeEl.value="day";
  input.classList.remove("hidden");
  input.type=mode==="day"?"date":mode==="month"?"month":"number";
  if(mode==="year"){input.min="2000";input.max="2100";input.step="1";input.placeholder="Nhập năm"}else{input.removeAttribute("min");input.removeAttribute("max");input.removeAttribute("step");input.removeAttribute("placeholder")}
  if(forceDefault||!input.value)input.value=todayFilterValue(mode);
}
function renderOrdersPagination(totalItems,totalPages){
  const wrap=$("orders-pagination");if(!wrap)return;
  if(totalPages<=1){wrap.innerHTML="";wrap.classList.add("hidden");return}
  currentOrdersPage=Math.min(Math.max(1,currentOrdersPage),totalPages);
  const pages=[];
  let start=Math.max(1,currentOrdersPage-2),end=Math.min(totalPages,start+4);
  start=Math.max(1,end-4);
  for(let p=start;p<=end;p++)pages.push(`<button class="page-button ${p===currentOrdersPage?"active":""}" data-order-page="${p}">${p}</button>`);
  wrap.classList.remove("hidden");
  wrap.innerHTML=`<div class="pagination-summary">${totalItems} đơn · Trang ${currentOrdersPage}/${totalPages}</div><div class="pagination-buttons"><button class="page-button" data-order-page="${currentOrdersPage-1}" ${currentOrdersPage===1?"disabled":""}>‹</button>${start>1?'<span class="pagination-dots">…</span>':''}${pages.join("")}${end<totalPages?'<span class="pagination-dots">…</span>':''}<button class="page-button" data-order-page="${currentOrdersPage+1}" ${currentOrdersPage===totalPages?"disabled":""}>›</button></div>`;
  wrap.querySelectorAll("[data-order-page]").forEach(btn=>btn.onclick=()=>{const page=Number(btn.dataset.orderPage);if(page<1||page>totalPages||page===currentOrdersPage)return;currentOrdersPage=page;renderOrders();document.querySelector("#page-orders .table-wrap")?.scrollTo({top:0,behavior:"smooth"})});
}
function renderOrders(){
  updateDateFilterControl(false);
  const filtered=prioritySortedOrders(getFilteredOrders());
  const totalPages=Math.max(1,Math.ceil(filtered.length/ORDERS_PAGE_SIZE));
  if(currentOrdersPage>totalPages)currentOrdersPage=totalPages;
  const start=(currentOrdersPage-1)*ORDERS_PAGE_SIZE;
  const arr=filtered.slice(start,start+ORDERS_PAGE_SIZE);
  $("orders-table").innerHTML=arr.map(o=>{const c=orderCustomerLoyalty(o);return `<tr class="${pickupIsLate(o)?"long-waiting-row":""}">${isAdmin()?`<td class="checkbox-col"><input class="order-select" type="checkbox" data-select-order="${o.id}" ${selectedOrderIds.has(o.id)?"checked":""}></td>`:""}<td><strong>${esc(o.code)}</strong>${pickupIsLate(o)?'<br><span class="badge red">Cần liên hệ khách</span>':isOverdue(o)?'<br><span class="badge red">Quá hẹn</span>':""}<br><small>🕒 ${formatOrderTime(o.createdAt)}</small></td><td>${esc(o.customerName||"-")}<br><small>${esc(o.phone||"-")}</small><br><small><b>🎁 Đã giặt: ${c.completed} lần</b> · Lần tiếp theo: ${c.nextVisit}</small></td><td>${o.items.map(i=>`${esc(i.name)} (${i.quantity} ${esc(i.unit)})`).join("<br>")}</td><td><strong>${money(o.total)}</strong></td><td>${esc(o.paymentStatus)}<br><small>Còn ${money(Math.max(0,o.total-o.paidAmount))}</small></td><td>${badge(o.status)}</td><td>${pickupAgeHtml(o)}</td><td><div class="table-actions"><button data-view="${o.id}">Xem</button><button class="primary" data-print="${o.id}">In</button></div></td></tr>`}).join("");
  const mobileList=$("orders-mobile-list");
  if(mobileList) mobileList.innerHTML=arr.map(o=>{const c=orderCustomerLoyalty(o),remaining=Math.max(0,Number(o.total||0)-Number(o.paidAmount||0));return `<article class="mobile-order-card ${pickupIsLate(o)?"is-late":""}"><div class="mobile-order-head"><div><strong>${esc(o.code)}</strong><small>🕒 ${formatOrderTime(o.createdAt)}</small></div>${isAdmin()?`<input class="order-select mobile-order-select" type="checkbox" aria-label="Chọn đơn ${esc(o.code)}" data-select-order="${o.id}" ${selectedOrderIds.has(o.id)?"checked":""}>`:""}</div><div class="mobile-order-badges">${badge(o.status)}${pickupIsLate(o)?'<span class="badge red">Cần liên hệ</span>':isOverdue(o)?'<span class="badge red">Quá hẹn</span>':""}</div><div class="mobile-order-customer"><b>${esc(o.customerName||"Khách lẻ")}</b><span>${esc(o.phone||"Chưa có số điện thoại")}</span></div><div class="mobile-order-services">${o.items.map(i=>`<span>${esc(i.name)} · ${i.quantity} ${esc(i.unit)}</span>`).join("")}</div><div class="mobile-order-grid"><div><span>Tổng tiền</span><b>${money(o.total)}</b></div><div><span>Còn nợ</span><b>${money(remaining)}</b></div><div><span>Đã giặt</span><b>${c.completed} lần</b></div><div><span>Chưa lấy</span><b>${pickupAgeHtml(o)||"—"}</b></div></div><div class="mobile-order-actions"><button data-view="${o.id}">Xem chi tiết</button><button class="primary" data-print="${o.id}">In phiếu</button></div></article>`}).join("");
  $("orders-empty").classList.toggle("hidden",filtered.length>0);
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>openModal(b.dataset.view));
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>printReceipt(appData.orders.find(o=>o.id===b.dataset.print)));
  document.querySelectorAll("[data-select-order]").forEach(cb=>cb.onchange=()=>{cb.checked?selectedOrderIds.add(cb.dataset.selectOrder):selectedOrderIds.delete(cb.dataset.selectOrder);updateBulkSelectionUI()});
  renderOrdersPagination(filtered.length,totalPages);
  updateBulkSelectionUI();showPickupWarningOncePerDay();
}
let activeOrderModalId="";
function closeOrderModal(){activeOrderModalId="";$("order-modal")?.classList.add("hidden")}
function modalOrderList(){try{return getFilteredOrders()}catch{return appData.orders||[]}}
function openAdjacentOrder(step){
  const rows=modalOrderList();
  const current=rows.findIndex(x=>x.id===activeOrderModalId);
  const next=rows[current+step];
  if(next)openModal(next.id);
}
function openModal(id){
  const o=appData.orders.find(x=>x.id===id);if(!o)return;activeOrderModalId=id;
  const c=orderCustomerLoyalty(o),eligible=eligiblePromotions(c),rewardText=eligible.length?` · <b>${eligible.length} khuyến mãi đang sẵn sàng</b>`:"";
  const rows=modalOrderList(),index=rows.findIndex(x=>x.id===id),hasPrev=index>0,hasNext=index>=0&&index<rows.length-1;
  $("order-modal-content").innerHTML=`
    <div class="order-modal-head"><div><h2>${esc(o.code)}</h2><div>${badge(o.status)} ${overdueDays(o)>0?`<span class="badge red">Quá hẹn ${overdueDays(o)} ngày</span>`:""}</div></div><div class="order-nav-position"><b>${index>=0?`${index+1} / ${rows.length}`:""}</b><small>Dùng ← → để chuyển · Esc để thoát</small></div></div>
    <button class="order-side-nav order-side-prev" id="order-prev" ${hasPrev?"":"disabled"}><span>←</span><b>Trước</b></button>
    <button class="order-side-nav order-side-next" id="order-next" ${hasNext?"":"disabled"}><b>Sau</b><span>→</span></button>
    <div class="order-detail-grid"><div class="detail-box"><span>Khách hàng</span><strong>${esc(o.customerName||"-")}</strong></div><div class="detail-box"><span>Điện thoại</span><strong>${esc(o.phone||"-")}</strong></div><div class="detail-box"><span>Thời gian tạo đơn</span><strong>${formatOrderTime(o.createdAt)}</strong></div><div class="detail-box"><span>Số lần đã giặt</span><strong>${c.completed} lần · Lần tiếp theo: ${c.nextVisit}</strong><small>${rewardText}</small></div><div class="detail-box"><span>Tổng tiền</span><strong>${money(o.total)}</strong></div><div class="detail-box"><span>Còn lại</span><strong>${money(Math.max(0,o.total-o.paidAmount))}</strong></div></div>
    <h3>Dịch vụ</h3>${o.items.map(i=>`<div class="summary-row"><span>${esc(i.name)} — ${i.quantity} ${esc(i.unit)}</span><strong>${money(i.total)}</strong></div>`).join("")}${o.note?`<p><b>Ghi chú:</b> ${esc(o.note)}</p>`:""}
    <h3>Chuyển trạng thái</h3><div class="status-actions">${statuses.filter(s=>isAdmin()||s!=="Đã hủy").map(s=>`<button class="${s==="Đã hủy"?"danger":"secondary"}" data-status="${s}">${s}</button>`).join("")}</div>${isAdmin()?`<div class="button-row"><button class="secondary" id="m-label">In tem</button><button class="secondary" id="m-paid">Đã thanh toán</button></div>`:""}`;
  $("order-modal").classList.remove("hidden");
  focusOrderModal();
  $("order-prev").onclick=()=>openAdjacentOrder(-1);$("order-next").onclick=()=>openAdjacentOrder(1);
  document.querySelectorAll("[data-status]").forEach(b=>b.onclick=async()=>{const nextStatus=b.dataset.status;if(nextStatus==="Đã hủy"&&!isAdmin())return toast("Tài khoản nhân viên không có quyền hủy hóa đơn");o.status=nextStatus;if(o.status==="Chờ khách lấy"&&!o.readyAt)o.readyAt=new Date().toISOString();if(["Hoàn thành","Đã hủy"].includes(o.status))o.closedAt=new Date().toISOString();audit("CHANGE_STATUS",`${o.code}: ${o.status}`);if(o.status==="Chờ khách lấy"&&appData.messaging?.autoReady)queueOrderMessage(o,"ready");await persist();openModal(id);renderOrders();renderDashboard();toast("Đã cập nhật trạng thái")});
  const labelBtn=$("m-label"),paidBtn=$("m-paid");if(labelBtn)labelBtn.onclick=()=>printLabel(o);if(paidBtn)paidBtn.onclick=async()=>{if(!isAdmin())return toast("Tài khoản nhân viên không có quyền xác nhận thanh toán");o.paymentStatus="Đã thanh toán";o.paidAmount=o.total;audit("MARK_PAID",o.code);await persist();openModal(id);renderOrders();renderDashboard();toast("Đã thanh toán")};
}


// V3.6.9 - filter orders by day, month or year
(()=>{
  const mode=$("date-filter-mode"),value=$("date-filter-value"),search=$("order-search"),status=$("status-filter");
  const resetAndRender=()=>{currentOrdersPage=1;renderOrders()};
  if(mode&&!mode.dataset.bound){mode.dataset.bound="1";mode.addEventListener("change",()=>{value.value=todayFilterValue(mode.value||"day");updateDateFilterControl(false);resetAndRender()})}
  if(value&&!value.dataset.bound){value.dataset.bound="1";value.addEventListener("input",resetAndRender);value.addEventListener("change",resetAndRender)}
  if(search){search.oninput=resetAndRender}
  if(status){status.onchange=resetAndRender}
  updateDateFilterControl(true);
})();

// V3.7.1 - discount by amount/percent, thousand separators and live clock
function parseMoneyValue(value){
  const digits=String(value??"").replace(/[^0-9]/g,"");
  return digits?Number(digits):0;
}
function formatMoneyInputValue(value){return Math.max(0,Math.round(Number(value)||0)).toLocaleString("en-US")}
function setMoneyInputValue(input,value){if(input)input.value=formatMoneyInputValue(value)}
function bindMoneyInput(input,onChange){
  if(!input||input.dataset.moneyBound)return;
  input.dataset.moneyBound="1";
  const update=()=>{const n=parseMoneyValue(input.value);input.value=formatMoneyInputValue(n);if(onChange)onChange(n)};
  input.addEventListener("input",update);
  input.addEventListener("focus",()=>input.select());
  input.addEventListener("blur",update);
  update();
}
function discountCalculation(subtotal){
  const type=$("discount-type")?.value||"amount";
  const raw=parseMoneyValue($("discount")?.value||0);
  const value=type==="percent"?Math.min(100,raw):raw;
  const amount=type==="percent"?Math.round(subtotal*value/100):value;
  return{type,value,amount:Math.min(subtotal,Math.max(0,amount))};
}
recalc=function(){
  const sub=currentOrderItems.reduce((a,i)=>a+Number(i.quantity||0)*Number(i.price||0),0);
  if(appliedPromotionId){const promo=ensurePromotions().find(p=>p.id===appliedPromotionId);if(promo){$("discount-type").value="amount";setMoneyInputValue($("discount"),promotionDiscountAmount(promo,sub));}}
  const dis=discountCalculation(sub),total=Math.max(0,sub-dis.amount),paid=parseMoneyValue($("paid-amount")?.value||0);
  $("subtotal").textContent=money(sub);$("grand-total").textContent=money(total);$("remaining").textContent=money(Math.max(0,total-paid));
};
renderOrderItems=function(){
  const c=$("order-items"),active=appData.services.filter(x=>x.active!==false);
  c.innerHTML=currentOrderItems.map(i=>`<div class="order-item" data-id="${i.id}"><label>Dịch vụ<select class="item-service">${active.map(s=>`<option value="${s.id}" ${s.id===i.serviceId?"selected":""}>${esc(s.name)} (${esc(s.unit)})</option>`).join("")}</select></label><label>Số lượng<input class="item-qty" type="number" min=".1" step=".1" value="${i.quantity}"></label><label>Đơn giá<input class="item-price money-input" inputmode="numeric" value="${formatMoneyInputValue(i.price)}" ${isAdmin()?"":"disabled"}></label><label>Thành tiền<input class="item-total" value="${formatMoneyInputValue(i.quantity*i.price)}" disabled></label><button class="remove-item">×</button></div>`).join("");
  c.querySelectorAll(".order-item").forEach(r=>{const i=currentOrderItems.find(x=>x.id===r.dataset.id),se=r.querySelector(".item-service"),q=r.querySelector(".item-qty"),p=r.querySelector(".item-price");se.onchange=()=>{const s=appData.services.find(x=>x.id===se.value);i.serviceId=se.value;i.price=s?.price||0;renderOrderItems()};q.oninput=()=>{i.quantity=Number(q.value||0);r.querySelector(".item-total").value=formatMoneyInputValue(i.quantity*i.price);recalc()};bindMoneyInput(p,n=>{i.price=n;r.querySelector(".item-total").value=formatMoneyInputValue(i.quantity*i.price);recalc()});r.querySelector(".remove-item").onclick=()=>{if(currentOrderItems.length===1)return toast("Đơn phải có ít nhất một dịch vụ");currentOrderItems=currentOrderItems.filter(x=>x.id!==i.id);renderOrderItems()}});recalc();
};
collect=function(){
  const name=$("customer-name").value.trim(),phone=$("customer-phone").value.trim();if(!name&&!phone){toast("Nhập tên khách hoặc số điện thoại");return null}
  const subtotal=currentOrderItems.reduce((a,i)=>a+Number(i.quantity||0)*Number(i.price||0),0),d=discountCalculation(subtotal),total=Math.max(0,subtotal-d.amount),paid=parseMoneyValue($("paid-amount")?.value||0);
  return{id:crypto.randomUUID(),code:orderCode(),customerName:name,phone,createdAt:new Date().toISOString(),dueDate:$("due-date").value?new Date($("due-date").value).toISOString():"",paymentStatus:$("payment-status").value,paidAmount:paid,note:$("order-note").value.trim(),status:"Đã nhận",discount:d.amount,discountType:d.type,discountValue:d.value,subtotal,total,createdBy:currentUser.id,customerKey:customerIdentity(name,phone),loyaltyRewardUsed:!!appliedPromotionId,appliedPromotionId:appliedPromotionId||"",items:currentOrderItems.map(i=>{const s=appData.services.find(x=>x.id===i.serviceId);return{serviceId:i.serviceId,name:s?.name||"Dịch vụ",unit:s?.unit||"",quantity:i.quantity,price:i.price,total:i.quantity*i.price}})};
};
const resetOrderFormV371=resetOrderForm;
resetOrderForm=function(){resetOrderFormV371();if($("discount-type"))$("discount-type").value="amount";setMoneyInputValue($("discount"),0);setMoneyInputValue($("paid-amount"),0);recalc()};
const receiptHtmlV371=receiptHtml;
receiptHtml=function(o){const label=o.discountType==="percent"?`Giảm giá (${Number(o.discountValue||0)}%)`:"Giảm giá";return receiptHtmlV371(o).replace("<span>Giảm giá</span>",`<span>${label}</span>`)};
function updateLiveClock(){const now=new Date(),date=$("live-date"),time=$("live-time");if(date)date.textContent=now.toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"});if(time)time.textContent=now.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
(()=>{
  const discount=$("discount"),paid=$("paid-amount"),type=$("discount-type");
  bindMoneyInput(discount,recalc);bindMoneyInput(paid,recalc);
  if(type&&!type.dataset.bound371){type.dataset.bound371="1";type.addEventListener("change",()=>{const n=parseMoneyValue(discount.value);if(type.value==="percent"&&n>100)setMoneyInputValue(discount,100);recalc()})}
  if(discount)discount.oninput=null;if(paid)paid.oninput=null;
  bindMoneyInput(discount,recalc);bindMoneyInput(paid,recalc);
  renderOrderItems();updateLiveClock();setInterval(updateLiveClock,1000);
})();


// V3.9.10 - phản hồi tức thời, không trì hoãn input/gợi ý
(()=>{
  const search=$("order-search");if(search)search.oninput=()=>{currentOrdersPage=1;renderOrders()};
  const quickSearch=$("quick-customer-search");if(quickSearch)quickSearch.oninput=renderMessages;
})();

// V3.9.5 - bắt phím popup nhiều lớp, tự focus popup và Enter lưu + in
let savingByEnter=false,__lastModalHotkeyAt=0;
function isOrderModalOpen(){const modal=$("order-modal");return !!(modal&&!modal.classList.contains("hidden"))}
function focusOrderModal(){
  const modal=$("order-modal"),panel=modal?.querySelector(".modal-panel");
  if(!panel)return;
  panel.setAttribute("tabindex","-1");
  requestAnimationFrame(()=>{try{panel.focus({preventScroll:true})}catch{panel.focus()}});
}
function handleOrderModalHotkey(e){
  if(!isOrderModalOpen())return false;
  const key=e.key||e.code;
  if(!["Escape","Esc","ArrowLeft","Left","ArrowRight","Right"].includes(key))return false;
  const now=Date.now();
  if(now-__lastModalHotkeyAt<120){e.preventDefault?.();return true}
  __lastModalHotkeyAt=now;
  e.preventDefault?.();e.stopPropagation?.();e.stopImmediatePropagation?.();
  if(key==="Escape"||key==="Esc")closeOrderModal();
  else openAdjacentOrder(key==="ArrowLeft"||key==="Left"?-1:1);
  return true;
}
async function handleGlobalHotkey(e){
  if(handleOrderModalHotkey(e))return;
  const enter=e.key==="Enter"||e.code==="NumpadEnter",page=$("page-new-order");
  if(!enter||!page?.classList.contains("active")||e.repeat||e.isComposing||savingByEnter)return;
  if(e.target?.tagName==="TEXTAREA"||e.target?.tagName==="BUTTON"||e.target?.closest?.(".customer-suggestions:not(.hidden)"))return;
  e.preventDefault();e.stopImmediatePropagation?.();e.target?.blur?.();savingByEnter=true;
  try{await saveOrder("receipt")}finally{setTimeout(()=>savingByEnter=false,350)}
}
window.addEventListener("keydown",handleGlobalHotkey,true);
document.addEventListener("keydown",handleGlobalHotkey,true);
document.body?.addEventListener("keydown",handleGlobalHotkey,true);
window.addEventListener("keyup",e=>{if(isOrderModalOpen())handleOrderModalHotkey(e)},true);


// V3.9.6 - tách khách theo tên + số điện thoại, sửa gợi ý khách trùng số
