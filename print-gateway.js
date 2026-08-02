const net = require('net');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG_PATH = path.join(__dirname, 'print-gateway-config.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ask = (rl, q, def='') => new Promise(r => rl.question(`${q}${def?` [${def}]`:''}: `, a => r(a.trim() || def)));
const normalizeWorkerUrl = value => {
  let url=String(value||'').trim().replace(/^link\s*:\s*/i,'');
  if(url&&!/^https?:\/\//i.test(url))url='https://'+url;
  try{return new URL(url).origin}catch{return ''}
};
const noAccent = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^\x20-\x7E\n]/g,'?');
const money = v => new Intl.NumberFormat('vi-VN').format(Number(v||0))+'d';
const pad = (a,b,w=48) => { a=noAccent(a); b=noAccent(b); const n=Math.max(1,w-a.length-b.length); return a+' '.repeat(n)+b; };

function feedLines(count=3){
  return Buffer.from([0x1b,0x64,Math.max(0,Math.min(10,Number(count)||0))]);
}
function cutCommand(mode='full'){
  return Buffer.from(mode==='partial'?[0x1d,0x56,0x01]:[0x1d,0x56,0x00]);
}
function charsPerLine(settings={}){
  const width=Number(settings.paperWidth==="custom"?settings.customPaperWidth:settings.paperWidth||80);
  // Chừa lề an toàn vì nhiều máy Xprinter 80 mm chỉ in ổn định khoảng 42–44 cột Font A.
  return width<=58?30:42;
}

function bodyPrintMode(settings={}){
  // Chỉ dùng chiều cao kép, tuyệt đối không dùng chiều rộng kép cho nội dung dài.
  // Double-width là nguyên nhân làm mất chữ ở hai mép trên Xprinter X200.
  const fontSize=Number(settings.receiptFontSize||14);
  return fontSize>=18?0x10:0x00;
}
function hr(width=48,char='-'){return char.repeat(width)+'\n';}
function center(text,width=48){
  text=noAccent(text).slice(0,width);
  const left=Math.max(0,Math.floor((width-text.length)/2));
  return ' '.repeat(left)+text+'\n';
}
function wrapText(text,width=48){
  const words=noAccent(text).trim().split(/\s+/).filter(Boolean), lines=[];
  let line='';
  for(const word of words){
    if(!line){line=word.slice(0,width);continue;}
    if((line+' '+word).length<=width)line+=' '+word;
    else{lines.push(line);line=word.slice(0,width);}
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}
function twoCol(left,right,width=48){
  left=noAccent(left);right=noAccent(right);
  const maxLeft=Math.max(8,width-right.length-1);
  if(left.length>maxLeft)left=left.slice(0,maxLeft);
  const spaces=Math.max(1,width-left.length-right.length);
  return left+' '.repeat(spaces)+right+'\n';
}
function formatDate(value){
  if(!value)return '';
  try{return new Date(value).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});}catch{return String(value)}
}
function receiptCopy(job,copyIndex,totalCopies,includeCut=true){
  const p=job.payload||{},o=p.order||{},s=p.settings||{},chunks=[];
  const width=charsPerLine(s);
  const push=x=>chunks.push(Buffer.isBuffer(x)?x:Buffer.from(noAccent(x),'ascii'));
  const bold=on=>push(Buffer.from([0x1b,0x45,on?0x01:0x00]));
  const align=n=>push(Buffer.from([0x1b,0x61,n]));
  const mode=n=>push(Buffer.from([0x1b,0x21,n]));
  const normal=()=>{align(0);bold(false);mode(0x00)};
  const section=title=>{push('\n');bold(true);push(title.toUpperCase()+'\n');bold(false);push(hr(width,'-'))};
  push(Buffer.from([0x1b,0x40]));
  normal();

  if(s.receiptShowCopyLabel!==false&&totalCopies>1){
    const labels=[s.receiptCopy1Label||'PHIEU KHACH',s.receiptCopy2Label||'PHIEU TIEM',s.receiptCopy3Label||'PHIEU LUU'];
    align(1);bold(true);push(center(labels[copyIndex]||`LIEN ${copyIndex+1}`,width));bold(false);
    push(hr(width,'='));
  }

  // Tiêu đề lớn theo chiều cao, giữ chiều rộng bình thường để không mất chữ.
  align(1);bold(true);mode(0x10);push(center(s.shopName||'GIAT SAY 334',width));mode(0x00);bold(false);
  if(s.address)for(const line of wrapText(s.address,width))push(center(line,width));
  if(s.phone)push(center(`SDT: ${s.phone}`,width));
  align(0);push(hr(width,'='));

  bold(true);push(twoCol('MA DON',o.code||'',width));bold(false);
  if(s.receiptShowOrderDate!==false)push(twoCol('NGAY NHAN',formatDate(o.createdAt||Date.now()),width));
  if(s.receiptShowCustomer!==false)push(twoCol('KHACH',o.customerName||'Khach le',width));
  if(s.receiptShowCustomerPhone!==false&&o.phone)push(twoCol('DIEN THOAI',o.phone,width));
  if(s.receiptShowDueDate!==false&&o.dueDate)push(twoCol('HEN TRA',formatDate(o.dueDate),width));

  section('DICH VU');
  for(const item of(o.items||[])){
    bold(true);for(const line of wrapText(item.name||'Dich vu',width))push(line+'\n');bold(false);
    const qty=`${item.quantity||1} ${item.unit||''} x ${money(item.price)}`;
    push(twoCol(qty,money(item.total),width));
  }

  push(hr(width,'='));
  if(Number(o.discount||0)>0)push(twoCol('GIAM GIA',`-${money(o.discount)}`,width));
  // Tổng cộng nổi bật bằng double-height, không double-width.
  bold(true);mode(0x10);push(twoCol('TONG CONG',money(o.total),width));mode(0x00);bold(false);
  push(hr(width,'-'));
  if(s.receiptShowPaid!==false){
    push(twoCol('KHACH DUA',money(o.paidAmount),width));
    bold(true);push(twoCol('CON LAI',money(Math.max(0,Number(o.total||0)-Number(o.paidAmount||0))),width));bold(false);
  }
  if(s.receiptShowNote!==false&&o.note){section('GHI CHU');for(const line of wrapText(o.note,width))push(line+'\n');}

  push('\n');align(1);
  if(s.receiptShowFooter!==false&&s.receiptFooter){bold(true);for(const line of wrapText(s.receiptFooter,width))push(center(line,width));bold(false);}
  if(s.receiptShowBottomNote!==false&&s.receiptBottomNote)for(const line of wrapText(s.receiptBottomNote,width))push(center(line,width));
  normal();
  if(includeCut){push(feedLines(s.receiptFeedBeforeCut??3));push(cutCommand(s.receiptCutMode||'full'));}
  return Buffer.concat(chunks);
}
function receiptBuffers(job){
  const p=job.payload||{},s=p.settings||{};
  const copies=Math.max(1,Math.min(3,Number(p.copies??s.receiptCopies??1)||1));
  const cutBetween=s.receiptCutBetweenCopies!==false;
  const finalCut=s.receiptFinalCut!==false;
  const result=[];
  for(let i=0;i<copies;i++){
    const includeCut=(i<copies-1&&cutBetween)||(i===copies-1&&finalCut);
    result.push(receiptCopy(job,i,copies,includeCut));
  }
  return result;
}
function escpos(job){
  const p=job.payload||{},o=p.order||{},s=p.settings||{},chunks=[];
  const push=x=>chunks.push(Buffer.isBuffer(x)?x:Buffer.from(noAccent(x),'ascii'));
  if(job.kind==='test'){
    push(Buffer.from([0x1b,0x40,0x1b,0x61,0x01,0x1b,0x45,0x01]));push('GS334 - TEST MAY IN\n');
    push(Buffer.from([0x1b,0x45,0x00,0x1b,0x61,0x00]));push(`IP: ${p.host||'192.168.1.150'}:${p.port||9100}\n`);push(`Thoi gian: ${new Date().toLocaleString('vi-VN')}\n`);push('Ket noi ESC/POS thanh cong.\n');
    push(feedLines(s.receiptFeedBeforeCut??3));push(cutCommand(s.receiptCutMode));return Buffer.concat(chunks);
  }
  if(job.kind==='label'){
    push(Buffer.from([0x1b,0x40,0x1b,0x61,0x01,0x1b,0x45,0x01]));push(`${s.shopName||'GIAT SAY 334'}\n${o.code||'DON HANG'}\n`);
    push(Buffer.from([0x1b,0x45,0x00,0x1b,0x61,0x00]));push(`${o.customerName||'Khach le'}\n${o.phone||''}\n`);
    for(const i of(o.items||[]))push(`${i.name}: ${i.quantity} ${i.unit||''}\n`);if(o.dueDate)push(`Hen: ${new Date(o.dueDate).toLocaleString('vi-VN')}\n`);
    push(feedLines(s.receiptFeedBeforeCut??3));push(cutCommand(s.receiptCutMode));return Buffer.concat(chunks);
  }
  return receiptBuffers(job)[0];
}
function sendRaw(host,port,data){return new Promise((resolve,reject)=>{const socket=new net.Socket();let done=false;const finish=e=>{if(done)return;done=true;socket.destroy();e?reject(e):resolve()};socket.setTimeout(7000);socket.once('error',finish);socket.once('timeout',()=>finish(new Error('Het thoi gian ket noi may in')));socket.connect(port,host,()=>socket.end(data,()=>finish()));});}
async function req(cfg,url,opt={}){const h={'content-type':'application/json',...(opt.headers||{})};if(cfg.token)h.authorization=`Bearer ${cfg.token}`;const r=await fetch(cfg.workerUrl.replace(/\/$/,'')+url,{...opt,headers:h});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||`HTTP ${r.status}`);return b;}
async function login(cfg,rl){const username=await ask(rl,'Tai khoan admin',cfg.username||'admin');const password=await ask(rl,'Mat khau admin');const b=await req({...cfg,token:''},'/api/login',{method:'POST',body:JSON.stringify({username,password})});cfg.username=username;cfg.token=b.token;fs.writeFileSync(CONFIG_PATH,JSON.stringify(cfg,null,2));}
async function main(){
  let cfg={workerUrl:'https://appgs334.giatsay334-7d8.workers.dev',host:'192.168.1.150',port:9100,pollMs:2000};
  if(fs.existsSync(CONFIG_PATH))try{cfg={...cfg,...JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8'))}}catch{}
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  cfg.workerUrl=normalizeWorkerUrl(await ask(rl,'Link GS334 Cloud',cfg.workerUrl));
  if(!cfg.workerUrl)throw new Error('Link GS334 Cloud khong hop le');
  cfg.host=await ask(rl,'IP may in',cfg.host);cfg.port=Number(await ask(rl,'Port',String(cfg.port)))||9100;
  if(!cfg.token)await login(cfg,rl);fs.writeFileSync(CONFIG_PATH,JSON.stringify(cfg,null,2));rl.close();
  console.log(`GS334 Print Gateway dang chay -> ${cfg.host}:${cfg.port}`);
  for(;;){
    try{
      await req(cfg,'/api/print/gateway/heartbeat',{method:'POST',body:JSON.stringify({host:cfg.host,port:cfg.port,computer:process.env.COMPUTERNAME||''})});
      const b=await req(cfg,'/api/print/jobs/next');
      if(b.job){const host=b.job.payload?.host||cfg.host,port=Number(b.job.payload?.port||cfg.port);try{if(b.job.kind==='receipt'){
        let buffers;
        if(Array.isArray(b.job.payload?.rasterCopies)&&b.job.payload.rasterCopies.length){
          const st=b.job.payload.settings||{};
          buffers=b.job.payload.rasterCopies.map((base64,i)=>{
            const chunks=[Buffer.from([0x1b,0x40]),Buffer.from(base64,'base64')];
            const includeCut=(i<b.job.payload.rasterCopies.length-1&&st.receiptCutBetweenCopies!==false)||(i===b.job.payload.rasterCopies.length-1&&st.receiptFinalCut!==false);
            if(includeCut){chunks.push(feedLines(st.receiptFeedBeforeCut??3));chunks.push(cutCommand(st.receiptCutMode||'full'));}
            return Buffer.concat(chunks);
          });
        }else buffers=receiptBuffers(b.job);
        for(let i=0;i<buffers.length;i++){await sendRaw(host,port,buffers[i]);console.log(`[IN RASTER] Lien ${i+1}/${buffers.length}`);if(i<buffers.length-1)await sleep(450)}
      }else{await sendRaw(host,port,escpos(b.job))}await req(cfg,`/api/print/jobs/${b.job.id}/complete`,{method:'POST',body:JSON.stringify({ok:true})});console.log(`[OK] ${b.job.kind} ${b.job.id}`)}catch(e){await req(cfg,`/api/print/jobs/${b.job.id}/complete`,{method:'POST',body:JSON.stringify({ok:false,error:e.message})});console.error(`[LOI] ${e.message}`)}}
    }catch(e){if(/401|Phiên|het han/i.test(e.message)){cfg.token='';const r=readline.createInterface({input:process.stdin,output:process.stdout});await login(cfg,r);r.close()}else console.error('Gateway:',e.message)}
    await sleep(cfg.pollMs);
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
module.exports={receiptBuffers,receiptCopy,escpos,cutCommand,feedLines,normalizeWorkerUrl,bodyPrintMode,sendRaw};
