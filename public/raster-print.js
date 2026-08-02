(()=>{
  'use strict';
  const num=v=>Number(v||0);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const money=v=>new Intl.NumberFormat('vi-VN').format(num(v))+'đ';
  const fmt=v=>{if(!v)return '';try{return new Date(v).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});}catch{return String(v)}};

  function paperWidth(settings={}){
    const mm=num(settings.paperWidth==='custom'?settings.customPaperWidth:(settings.paperWidth||80));
    return mm<=58?384:576;
  }

  function render(order,settings={},copyIndex=0,totalCopies=1){
    const W=paperWidth(settings);
    const is58=W<=384;
    // Không cho cấu hình cũ thu bill xuống quá nhỏ. 80mm luôn ưu tiên dễ đọc.
    const requested=num(settings.receiptScale||100)/100;
    const scale=clamp(requested,is58?.94:.98,1.12);
    const px=v=>Math.max(1,Math.round(v*scale*(is58?.78:1)));
    const edge=is58?18:34;
    const L=edge+Math.round(num(settings.receiptMarginLeft||0)*1.1);
    const R=W-edge-Math.round(num(settings.receiptMarginRight||0)*1.1);
    const C=W/2, CW=R-L;
    const family=(settings.receiptFont||'Arial').replace(/["']/g,'');
    const canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=4800;
    const g=canvas.getContext('2d',{alpha:false,willReadFrequently:true});
    g.fillStyle='#fff';g.fillRect(0,0,canvas.width,canvas.height);
    g.fillStyle='#000';g.textBaseline='top';g.imageSmoothingEnabled=true;
    let y=px(12)+Math.round(num(settings.receiptMarginTop||0)*1.5);

    const setFont=(size,weight=400,italic=false)=>{g.font=`${italic?'italic ':''}${weight} ${px(size)}px "${family}", Arial, sans-serif`};
    const lineH=(size,m=1.18)=>Math.ceil(px(size)*m);
    const width=(t,size,w=400)=>{setFont(size,w);return g.measureText(String(t??'')).width};
    const draw=(t,x,yy,size,w=400,align='left',italic=false)=>{setFont(size,w,italic);g.textAlign=align;g.fillText(String(t??''),x,yy)};
    const drawIcon=(type,x,yy,size=24)=>{
      const s=px(size), cx=x+s/2, cy=yy+s/2, lw=Math.max(1,px(1.45));
      g.save();g.strokeStyle='#000';g.fillStyle='#000';g.lineWidth=lw;g.lineCap='round';g.lineJoin='round';
      const r=(a,b,c,d)=>g.strokeRect(a,b,c,d);
      const line=(a,b,c,d)=>{g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.stroke()};
      const circ=(a,b,r0)=>{g.beginPath();g.arc(a,b,r0,0,Math.PI*2);g.stroke()};
      if(type==='pin'){
        g.beginPath();g.moveTo(cx,yy+s*.9);g.bezierCurveTo(x+s*.13,yy+s*.53,x+s*.16,yy+s*.14,cx,yy+s*.1);g.bezierCurveTo(x+s*.84,yy+s*.14,x+s*.87,yy+s*.53,cx,yy+s*.9);g.stroke();circ(cx,yy+s*.38,s*.11);
      }else if(type==='phone'){
        g.beginPath();g.moveTo(x+s*.26,yy+s*.13);g.bezierCurveTo(x+s*.17,yy+s*.16,x+s*.14,yy+s*.25,x+s*.17,yy+s*.35);g.bezierCurveTo(x+s*.29,yy+s*.68,x+s*.48,yy+s*.84,x+s*.72,yy+s*.9);g.bezierCurveTo(x+s*.82,yy+s*.92,x+s*.9,yy+s*.86,x+s*.91,yy+s*.77);g.lineTo(x+s*.72,yy+s*.63);g.bezierCurveTo(x+s*.68,yy+s*.6,x+s*.63,yy+s*.6,x+s*.59,yy+s*.64);g.lineTo(x+s*.51,yy+s*.71);g.bezierCurveTo(x+s*.38,yy+s*.62,x+s*.29,yy+s*.52,x+s*.23,yy+s*.39);g.lineTo(x+s*.32,yy+s*.31);g.bezierCurveTo(x+s*.36,yy+s*.27,x+s*.36,yy+s*.22,x+s*.33,yy+s*.18);g.closePath();g.stroke();
      }else if(type==='doc'){
        r(x+s*.2,yy+s*.12,s*.58,s*.76);line(x+s*.56,yy+s*.12,x+s*.78,yy+s*.34);line(x+s*.56,yy+s*.12,x+s*.56,yy+s*.34);line(x+s*.56,yy+s*.34,x+s*.78,yy+s*.34);line(x+s*.31,yy+s*.5,x+s*.67,yy+s*.5);line(x+s*.31,yy+s*.64,x+s*.63,yy+s*.64);
      }else if(type==='calendar'){
        r(x+s*.15,yy+s*.2,s*.7,s*.65);line(x+s*.15,yy+s*.38,x+s*.85,yy+s*.38);line(x+s*.32,yy+s*.1,x+s*.32,yy+s*.28);line(x+s*.68,yy+s*.1,x+s*.68,yy+s*.28);circ(x+s*.34,yy+s*.54,s*.035);circ(x+s*.5,yy+s*.54,s*.035);circ(x+s*.66,yy+s*.54,s*.035);circ(x+s*.34,yy+s*.7,s*.035);circ(x+s*.5,yy+s*.7,s*.035);
      }else if(type==='user'){
        circ(cx,yy+s*.28,s*.16);g.beginPath();g.moveTo(x+s*.2,yy+s*.88);g.bezierCurveTo(x+s*.23,yy+s*.58,x+s*.77,yy+s*.58,x+s*.8,yy+s*.88);g.stroke();
      }else if(type==='basket'){
        g.beginPath();g.moveTo(x+s*.15,yy+s*.36);g.lineTo(x+s*.85,yy+s*.36);g.lineTo(x+s*.75,yy+s*.82);g.lineTo(x+s*.25,yy+s*.82);g.closePath();g.stroke();line(x+s*.32,yy+s*.36,x+s*.42,yy+s*.15);line(x+s*.68,yy+s*.36,x+s*.58,yy+s*.15);line(x+s*.38,yy+s*.48,x+s*.4,yy+s*.7);line(cx,yy+s*.48,cx,yy+s*.7);line(x+s*.62,yy+s*.48,x+s*.6,yy+s*.7);
      }else if(type==='moneybag'){
        g.beginPath();g.moveTo(x+s*.38,yy+s*.18);g.lineTo(x+s*.62,yy+s*.18);g.lineTo(x+s*.68,yy+s*.3);g.bezierCurveTo(x+s*.87,yy+s*.45,x+s*.84,yy+s*.83,cx,yy+s*.88);g.bezierCurveTo(x+s*.16,yy+s*.83,x+s*.13,yy+s*.45,x+s*.32,yy+s*.3);g.closePath();g.stroke();line(x+s*.36,yy+s*.31,x+s*.64,yy+s*.31);draw('$',cx,yy+s*.41,size*.38,800,'center');
      }else if(type==='cash'){
        r(x+s*.12,yy+s*.25,s*.76,s*.52);circ(cx,cy,s*.12);line(x+s*.2,yy+s*.34,x+s*.28,yy+s*.34);line(x+s*.72,yy+s*.68,x+s*.8,yy+s*.68);
      }else if(type==='wallet'){
        r(x+s*.13,yy+s*.25,s*.72,s*.58);r(x+s*.56,yy+s*.42,s*.36,s*.25);circ(x+s*.7,yy+s*.55,s*.025);
      }else if(type==='note'){
        r(x+s*.19,yy+s*.12,s*.62,s*.76);line(x+s*.33,yy+s*.28,x+s*.67,yy+s*.28);line(x+s*.33,yy+s*.44,x+s*.67,yy+s*.44);line(x+s*.33,yy+s*.6,x+s*.6,yy+s*.6);line(x+s*.28,yy+s*.08,x+s*.28,yy+s*.18);line(x+s*.5,yy+s*.08,x+s*.5,yy+s*.18);line(x+s*.72,yy+s*.08,x+s*.72,yy+s*.18);
      }else if(type==='heart'){
        g.beginPath();g.moveTo(cx,yy+s*.84);g.bezierCurveTo(x+s*.12,yy+s*.58,x+s*.14,yy+s*.22,x+s*.36,yy+s*.2);g.bezierCurveTo(x+s*.47,yy+s*.19,cx,yy+s*.29,cx,yy+s*.29);g.bezierCurveTo(cx,yy+s*.29,x+s*.53,yy+s*.19,x+s*.64,yy+s*.2);g.bezierCurveTo(x+s*.86,yy+s*.22,x+s*.88,yy+s*.58,cx,yy+s*.84);g.stroke();
      }
      g.restore();
    };
    const wrap=(value,max,size,weight=400)=>{
      const out=[];
      for(const para of String(value??'').split(/\n/)){
        const words=para.trim().split(/\s+/).filter(Boolean);let line='';
        for(const raw of words){
          if(width(raw,size,weight)>max){for(const ch of raw){const n=line+ch;if(line&&width(n,size,weight)>max){out.push(line);line=ch}else line=n}continue}
          const n=line?line+' '+raw:raw;
          if(!line||width(n,size,weight)<=max)line=n;else{out.push(line);line=raw}
        }
        if(line)out.push(line);if(!words.length)out.push('');
      }
      return out.length?out:[''];
    };
    const centered=(t,size,w=400,after=0,italic=false)=>{for(const line of wrap(t,CW,size,w)){draw(line,C,y,size,w,'center',italic);y+=lineH(size,1.12)}y+=px(after)};
    const dashedRule=(before=7,after=8)=>{
      y+=px(before);g.save();g.strokeStyle='#000';g.lineWidth=Math.max(1,px(.8));g.setLineDash([px(5),px(4)]);g.beginPath();g.moveTo(L,y+.5);g.lineTo(R,y+.5);g.stroke();g.restore();y+=px(after);
    };
    const solidRule=(before=6,after=7)=>{y+=px(before);g.fillRect(L,y,CW,Math.max(1,px(1)));y+=px(1)+px(after)};
    const iconCol=px(is58?27:31), textX=L+iconCol+px(8);
    const section=(t,icon)=>{
      if(icon)drawIcon(icon,L,y+px(1),is58?22:25);
      draw(t,icon?textX:L,y,25,850);y+=lineH(25,1.12)+px(5);
    };

    // Mỗi hàng có icon riêng, nhãn trái và dữ liệu phải; khoảng cách thoáng nhưng không lãng phí giấy.
    const infoRow=(icon,label,value,{size=23,valueWeight=750,after=9}={})=>{
      const labelX=textX, labelW=Math.min(px(140),CW*.31);
      const valueMax=R-(labelX+labelW+px(8));
      const lines=wrap(value,valueMax,size,valueWeight);
      drawIcon(icon,L,y+px(1),is58?21:24);
      draw(label,labelX,y,20,500);
      for(let i=0;i<lines.length;i++)draw(lines[i],R,y+i*lineH(size,1.08),size,valueWeight,'right');
      y+=Math.max(lineH(20,1.08),lines.length*lineH(size,1.08))+px(after);
    };
    const priceRow=(left,right,{size=25,leftWeight=750,rightWeight=850,after=4,x=L}={})=>{
      const rightW=Math.min(CW*.38,Math.max(px(105),width(right,size,rightWeight)));
      const leftLines=wrap(left,R-x-rightW-px(12),size,leftWeight);
      leftLines.forEach((line,i)=>draw(line,x,y+i*lineH(size,1.08),size,leftWeight));
      draw(right,R,y,size,rightWeight,'right');
      y+=Math.max(leftLines.length*lineH(size,1.08),lineH(size,1.08))+px(after);
    };

    const labels=[settings.receiptCopy1Label||'PHIẾU KHÁCH',settings.receiptCopy2Label||'PHIẾU TIỆM',settings.receiptCopy3Label||'PHIẾU LƯU'];
    if(settings.receiptShowCopyLabel!==false&&totalCopies>1)centered(labels[copyIndex]||`LIÊN ${copyIndex+1}`,22,800,2);
    if(settings.receiptShowShopName!==false)centered(settings.shopName||'GIẶT SẤY 334',38,900,5);
    if(settings.receiptShowAddress!==false&&settings.address){
      const lines=wrap(settings.address,CW-px(42),21,500);for(const line of lines){const tw=width(line,21,500),sx=C-tw/2-px(16);drawIcon('pin',sx,y+px(1),19);draw(line,C+px(6),y,21,500,'center');y+=lineH(21,1.12)}y+=px(2);
    }
    if(settings.receiptShowPhone!==false&&settings.phone){const t=`ĐT: ${settings.phone}`,tw=width(t,21,600),sx=C-tw/2-px(16);drawIcon('phone',sx,y+px(1),19);draw(t,C+px(6),y,21,600,'center');y+=lineH(21,1.12)+px(3);}
    if(settings.receiptShowHeaderText===true&&settings.receiptHeaderText)centered(settings.receiptHeaderText,20,500,2);

    dashedRule(7,9);
    infoRow('doc','Mã đơn',order.code||'',{size:24,valueWeight:850,after:9});
    if(settings.receiptShowOrderDate!==false)infoRow('calendar','Ngày nhận',fmt(order.createdAt),{after:9});
    if(settings.receiptShowCustomer!==false)infoRow('user','Khách hàng',order.customerName||'Khách lẻ',{after:9});
    if(settings.receiptShowCustomerPhone!==false&&order.phone)infoRow('phone','Điện thoại',order.phone,{after:9});
    if(settings.receiptShowDueDate!==false&&order.dueDate)infoRow('calendar','Hẹn trả',fmt(order.dueDate),{after:9});

    dashedRule(5,8);
    section('DỊCH VỤ','basket');
    for(const item of order.items||[]){
      priceRow(item.name||'Dịch vụ',money(item.total),{size:25,leftWeight:800,rightWeight:850,after:2,x:textX});
      const qty=`${item.quantity||1} ${item.unit||''} × ${money(item.price)}`.replace(/\s+/g,' ').trim();
      draw(qty,textX,y,21,450);y+=lineH(21,1.1)+px(8);
    }
    if(num(order.discount)>0)priceRow('Giảm giá','-'+money(order.discount),{size:22,leftWeight:500,rightWeight:700,after:3});

    dashedRule(3,7);
    drawIcon('moneybag',L,y+px(1),is58?24:28);
    draw('TỔNG CỘNG',textX,y,29,900);
    draw(money(order.total),R,y,35,900,'right');
    y+=Math.max(lineH(29,1.08),lineH(35,1.08))+px(5);
    dashedRule(2,7);

    if(settings.receiptShowPaid!==false){
      drawIcon('cash',L,y+px(1),is58?22:25);priceRow('Khách đưa',money(order.paidAmount),{size:23,leftWeight:500,rightWeight:750,after:8,x:textX});
      drawIcon('wallet',L,y+px(1),is58?22:25);priceRow('Còn lại',money(Math.max(0,num(order.total)-num(order.paidAmount))),{size:24,leftWeight:700,rightWeight:850,after:7,x:textX});
    }
    if(settings.receiptShowNote!==false&&order.note){
      dashedRule(4,8);section('GHI CHÚ','note');
      for(const line of wrap(order.note,CW,21,450)){draw(line,textX,y,21,450);y+=lineH(21,1.1)}
      y+=px(2);
    }

    solidRule(4,7);
    if(settings.receiptShowFooter!==false&&settings.receiptFooter){
      const t=settings.receiptFooter,tw=width(t,24,850),ix=C-tw/2-px(27);drawIcon('heart',ix,y+px(1),21);draw(t,C+px(9),y,24,850,'center');y+=lineH(24,1.12)+px(3);
    }
    if(settings.receiptShowBottomNote!==false&&settings.receiptBottomNote)centered(settings.receiptBottomNote,20,400,0,true);
    y+=px(7)+Math.round(num(settings.receiptMarginBottom||0)*1.5);

    const out=document.createElement('canvas');out.width=W;out.height=Math.ceil(y);
    const ox=out.getContext('2d',{alpha:false,willReadFrequently:true});ox.fillStyle='#fff';ox.fillRect(0,0,out.width,out.height);ox.drawImage(canvas,0,0,W,out.height,0,0,W,out.height);
    return out;
  }

  function raster(canvas,settings={}){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const img=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const bpr=Math.ceil(canvas.width/8);
    const threshold=clamp(num(settings.receiptRasterThreshold||178),135,220);
    const stripeRows=128, chunks=[];
    for(let y0=0;y0<canvas.height;y0+=stripeRows){
      const rows=Math.min(stripeRows,canvas.height-y0),data=new Uint8Array(bpr*rows);
      for(let yy=0;yy<rows;yy++)for(let x=0;x<canvas.width;x++){
        const i=((y0+yy)*canvas.width+x)*4,lum=(img[i]*299+img[i+1]*587+img[i+2]*114)/1000;
        if(lum<threshold)data[yy*bpr+(x>>3)]|=0x80>>(x&7);
      }
      chunks.push(Uint8Array.from([0x1d,0x76,0x30,0,bpr&255,(bpr>>8)&255,rows&255,(rows>>8)&255]),data);
    }
    const total=chunks.reduce((n,a)=>n+a.length,0),out=new Uint8Array(total);let off=0;
    for(const c of chunks){out.set(c,off);off+=c.length}
    let bin='';for(let i=0;i<out.length;i+=0x8000)bin+=String.fromCharCode(...out.subarray(i,i+0x8000));
    return btoa(bin);
  }

  function copies(order,settings={}){const n=clamp(num(settings.receiptCopies||1),1,3);return Array.from({length:n},(_,i)=>raster(render(order,settings,i,n),settings))}
  function previewDataURL(order,settings,copyIndex=0,totalCopies=1){return render(order,settings,copyIndex,totalCopies).toDataURL('image/png')}
  window.GS334Raster={render,raster,copies,previewDataURL,version:'3.5.0'};
})();
