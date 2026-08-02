(() => {
  const TOKEN_KEY = "gs334-cloud-token";
  let token = localStorage.getItem(TOKEN_KEY) || "";
  let revision = 0;
  const listeners = new Set();

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  function download(name, content, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(String(text));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  window.__GS334Cloud = {
    get token() { return token; },
    setSession(nextToken) { token = nextToken || ""; nextToken ? localStorage.setItem(TOKEN_KEY, nextToken) : localStorage.removeItem(TOKEN_KEY); },
    api,
    async session() { if (!token) return { ok:false }; return api("/api/session"); },
    async recover(payload) { return api("/api/recover", { method:"POST", body:JSON.stringify(payload) }); }
  };

  window.posAPI = {
    loadData: async () => {
      if (!token) return null;
      const result = await api("/api/data");
      revision = Number(result.revision || 0);
      return result.data;
    },
    saveData: async data => {
      if (!token) return { ok:false, error:"Chưa đăng nhập" };
      const result = await api("/api/data", { method:"PUT", body:JSON.stringify({ data, revision }) });
      revision = Number(result.revision || revision + 1);
      listeners.forEach(fn => { try { fn(); } catch {} });
      return result;
    },
    login: async payload => {
      const result = await api("/api/login", { method:"POST", body:JSON.stringify(payload) });
      token = result.token;
      localStorage.setItem(TOKEN_KEY, token);
      revision = Number(result.revision || 0);
      return result;
    },
    logout: async () => { try { if(token) await api("/api/logout", {method:"POST"}); } catch {} token=""; localStorage.removeItem(TOKEN_KEY); },
    hashPassword: sha256,
    listPrinters: async () => [],
    printHtml: async payload => {
      const html = payload?.html || payload?.content || "";
      const w = window.open("", "_blank", "width=460,height=720");
      if (!w) return { ok:false, error:"Trình duyệt đang chặn cửa sổ in" };
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 250);
      return { ok:true };
    },
    quickBackup: async () => {
      const result = await api("/api/data");
      download(`GS334-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(result.data,null,2));
      return {ok:true,path:"Đã tải xuống"};
    },
    exportBackup: async () => window.posAPI.quickBackup(),
    importBackup: async () => new Promise(resolve => {
      const input=document.createElement("input"); input.type="file"; input.accept="application/json,.json";
      input.onchange=async()=>{try{const data=JSON.parse(await input.files[0].text());await window.posAPI.saveData(data);resolve({ok:true,data})}catch(e){resolve({ok:false,error:e.message})}};
      input.click();
    }),
    openBackupFolder: async () => ({ok:false,error:"Bản web tải file sao lưu vào thư mục Downloads"}),
    getBackupInfo: async () => ({ok:true,folder:"Downloads",latest:"Dữ liệu đang lưu trên Cloudflare D1"}),
    exportExcel: async ({orders=[]}={}) => {
      const escCsv=v=>`"${String(v??"").replaceAll('"','""')}"`;
      const rows=[["Mã đơn","Ngày nhận","Khách hàng","Số điện thoại","Trạng thái","Tổng tiền","Đã trả","Còn lại"]];
      for(const o of orders) rows.push([o.code,o.createdAt,o.customerName,o.phone,o.status,o.total,o.paidAmount,Math.max(0,Number(o.total||0)-Number(o.paidAmount||0))]);
      const csv="\ufeff"+rows.map(r=>r.map(escCsv).join(",")).join("\r\n");
      download(`GS334-bao-cao-${new Date().toISOString().slice(0,10)}.csv`,csv,"text/csv;charset=utf-8");
      return {ok:true,path:"Downloads"};
    },
    testNetworkPrinter: async payload => {
      const nativePrinter=window.Capacitor?.Plugins?.GS334Printer;
      if(nativePrinter){
        try{return await nativePrinter.testConnection({host:String(payload?.host||""),port:Number(payload?.port||9100),timeoutMs:5000})}
        catch(error){return {ok:false,error:error?.message||String(error)}}
      }
      const status=await api("/api/print/status");
      if(!status.online)return {ok:false,error:"Print Gateway trên máy tính chưa chạy"};
      const result=await api("/api/print/jobs",{method:"POST",body:JSON.stringify({kind:"test",payload})});
      return {ok:true,message:result.message||"Đã gửi phiếu in thử"};
    },
    printNetwork: async payload => {
      const nativePrinter=window.Capacitor?.Plugins?.GS334Printer;
      if(nativePrinter&&payload?.type!=="label"&&Array.isArray(payload?.rasterCopies)&&payload.rasterCopies.length){
        try{
          return await nativePrinter.printRaster({
            host:String(payload.host||""),port:Number(payload.port||9100),
            rasterCopies:payload.rasterCopies,
            feedLines:Number(payload.settings?.receiptFeedBeforeCut??3),
            cutMode:payload.settings?.receiptCutMode==="partial"?"partial":"full",
            cutAfterLast:payload.settings?.receiptCutAfterLast!==false,delayMs:350
          });
        }catch(error){return {ok:false,error:error?.message||String(error)}}
      }
      const kind=payload?.type==="label"?"label":"receipt";
      const result=await api("/api/print/jobs",{method:"POST",body:JSON.stringify({kind,payload})});
      return {ok:true,message:result.message||"Đã gửi lệnh in"};
    },
    openChatChannel: async channel => { const url=channel==="zalo"?"https://chat.zalo.me":"https://www.messenger.com"; window.open(url,"_blank"); return {ok:true}; },
    copyText: async text => { await navigator.clipboard.writeText(String(text||"")); return {ok:true}; },
    copyImage: async () => ({ok:false,error:"Trình duyệt chưa hỗ trợ sao chép QR trực tiếp"}),
    getMobileInfo: async () => ({status:"online",onlineUrl:location.origin,lanUrls:[],fixedWorkerUrl:location.origin,fixedWorkerReady:true}),
    restartMobileOnline: async () => ({ok:true}),
    getMobileQr: async url => `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,
    onDataChanged: callback => listeners.add(callback),
    onMobileInfoChanged: () => {}
  };
})();
