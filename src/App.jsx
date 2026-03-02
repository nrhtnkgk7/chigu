import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";

const STORAGE_KEYS = { cases: "cases-data", settings: "monthly-settings", pin: "app-pin", sender: "sender-info" };
const defaultSettings = { maxMonthly: 10, maxConcurrent: 5 };
const defaultSender = { company:"株式会社M-True", representative:"代表取締役 山下 真由", zip:"〒6590043", address:"兵庫県芦屋市潮見町28-1", tel:"TEL: 0797-23-6614", email:"7mayu2mayu@gmail.com", registration:"登録番号: T7140001038168", bank:"三菱UFJ銀行 芦屋支店 店番483 普通 0207348 カブシキガイシャ エムトゥルー" };

const GENRES = [
  { id: "food", label: "食べ物", emoji: "🍽", color: "#c97a1e", dim: "rgba(201,122,30,0.10)" },
  { id: "beauty", label: "美容", emoji: "💄", color: "#a8568e", dim: "rgba(168,86,142,0.10)" },
  { id: "other", label: "その他", emoji: "📁", color: "#6b6880", dim: "rgba(107,104,128,0.08)" },
];

const STATUSES = [
  { id: "acquired", label: "撮影前", emoji: "📋", color: "#2b7dd6", dim: "rgba(43,125,214,0.10)", step: 0 },
  { id: "shot",     label: "編集待ち", emoji: "✂️", color: "#8b5cf6", dim: "rgba(139,92,246,0.10)", step: 1 },
  { id: "delivered", label: "納品済み", emoji: "✅", color: "#2a8a5a", dim: "rgba(42,138,90,0.10)", step: 2 },
];
const getStatus = (c) => STATUSES.find(s=>s.id===c.status) || (c.done ? STATUSES[3] : STATUSES[0]);

const C = {
  bg: "#f7f6f3", surface: "#ffffff", surfaceAlt: "#f0efec",
  border: "#e2e0db", borderLight: "#d4d2cc",
  accent: "#2b7dd6", accentDim: "rgba(43,125,214,0.08)",
  text: "#2c2c31", textDim: "#6b6880", textMuted: "#9e9baa",
  danger: "#d04440", dangerDim: "rgba(208,68,64,0.08)",
  success: "#2a8a5a", successDim: "rgba(42,138,90,0.08)",
  shooting: "#2b7dd6", shootingDim: "rgba(43,125,214,0.08)",
  deadline: "#c47a14", deadlineDim: "rgba(196,122,20,0.08)",
  payment: "#2a8a5a", paymentDim: "rgba(42,138,90,0.08)",
  done: "#b0adba", doneDim: "rgba(176,173,186,0.10)",
};

const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
const parseLocal = (ds) => { if(!ds) return null; if(ds instanceof Date) return ds; if(typeof ds !== 'string') return new Date(ds); const parts = ds.split('-'); if(parts.length!==3) return new Date(ds); const [y,m,d] = parts.map(Number); return new Date(y, m-1, d); };
const fmtDate = (d) => { if (!d) return ""; const x = parseLocal(d) || new Date(d); return `${x.getFullYear()}/${(x.getMonth()+1).toString().padStart(2,"0")}/${x.getDate().toString().padStart(2,"0")}`; };
const fmtShortDate = (d) => { if (!d) return ""; const x = parseLocal(d) || new Date(d); return `${(x.getMonth()+1)}/${x.getDate()}`; };
const fmtCurrency = (n) => { if (!n && n !== 0) return ""; return "¥" + Number(n).toLocaleString(); };
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${(x.getMonth()+1).toString().padStart(2,"0")}-${x.getDate().toString().padStart(2,"0")}`; };
const todayStr = () => toISO(new Date());
const twoWeeksStr = () => { const d = new Date(); d.setDate(d.getDate() + 14); return toISO(d); };

function urgency(dl) {
  if (dl < 0) return { color: "#fff", bg: "#d04440", label: `${Math.abs(dl)}日超過` };
  if (dl === 0) return { color: "#fff", bg: "#d04440", label: "今日" };
  if (dl <= 2) return { color: "#fff", bg: "#e06820", label: `あと${dl}日` };
  if (dl <= 5) return { color: "#2c2c31", bg: "#f5c842", label: `あと${dl}日` };
  return { color: "#2c2c31", bg: "rgba(42,138,90,0.15)", label: `あと${dl}日` };
}
function daysUntil(ds) { const d=parseLocal(ds); if(!d)return null; const t=new Date(); t.setHours(0,0,0,0); d.setHours(0,0,0,0); return Math.ceil((d-t)/86400000); }

/* ── Shared UI ── */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16,backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.12)" }}>
        <div style={{ padding:"20px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.surface,zIndex:1,borderRadius:"16px 16px 0 0" }}>
          <span style={{ fontSize:17,fontWeight:700,color:C.text,fontFamily:"'Noto Sans JP',sans-serif" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:C.textDim,fontSize:22,cursor:"pointer",padding:"0 4px",lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}
function Input({ label, ...props }) {
  return (<div style={{ marginBottom:16 }}>
    <label style={{ display:"block",fontSize:12,color:C.textDim,marginBottom:6,fontWeight:500,letterSpacing:0.5 }}>{label}</label>
    <input {...props} style={{ width:"100%",padding:"10px 14px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:16,outline:"none",boxSizing:"border-box",fontFamily:"'Noto Sans JP',sans-serif",WebkitAppearance:"none",MozAppearance:"none",appearance:"none",maxWidth:"100%",...(props.style||{}) }} />
  </div>);
}
function TextArea({ label, ...props }) {
  return (<div style={{ marginBottom:16 }}>
    <label style={{ display:"block",fontSize:12,color:C.textDim,marginBottom:6,fontWeight:500,letterSpacing:0.5 }}>{label}</label>
    <textarea {...props} style={{ width:"100%",padding:"10px 14px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:16,outline:"none",boxSizing:"border-box",fontFamily:"'Noto Sans JP',sans-serif",minHeight:80,resize:"vertical",...(props.style||{}) }} />
  </div>);
}
function Btn({ children, variant="primary", small, ...props }) {
  const s = { primary:{background:C.accent,color:"#fff",fontWeight:700}, secondary:{background:C.surfaceAlt,color:C.text,border:`1px solid ${C.border}`}, danger:{background:C.dangerDim,color:C.danger,border:"1px solid rgba(208,68,64,0.2)"}, ghost:{background:"transparent",color:C.textDim}, success:{background:C.successDim,color:C.success,border:"1px solid rgba(42,138,90,0.2)"} };
  return <button {...props} style={{ padding:small?"6px 12px":"10px 20px",borderRadius:10,border:"none",cursor:"pointer",fontSize:small?12:14,fontFamily:"'Noto Sans JP',sans-serif",transition:"all 0.2s",letterSpacing:0.3,...s[variant],...(props.disabled?{opacity:0.4,cursor:"not-allowed"}:{}),...(props.style||{}) }}>{children}</button>;
}
function Badge({ color, dimColor, children, style }) {
  return <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:dimColor,color,letterSpacing:0.3,whiteSpace:"nowrap",...(style||{}) }}>{children}</span>;
}
function UrgencyBadge({ daysLeft }) {
  const u = urgency(daysLeft);
  return <span style={{ display:"inline-block",padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,background:u.bg,color:u.color,whiteSpace:"nowrap" }}>{u.label}</span>;
}
function GenreSelect({ value, onChange }) {
  return (<div style={{ marginBottom:16 }}>
    <label style={{ display:"block",fontSize:12,color:C.textDim,marginBottom:6,fontWeight:500 }}>ジャンル</label>
    <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
      {GENRES.map(g => (
        <button key={g.id} onClick={()=>onChange(g.id)} style={{ flex:1,padding:"10px 8px",borderRadius:10,cursor:"pointer",background:value===g.id?g.dim:C.bg,border:value===g.id?`2px solid ${g.color}`:`1px solid ${C.border}`,color:value===g.id?g.color:C.textDim,fontSize:13,fontWeight:value===g.id?700:400,fontFamily:"'Noto Sans JP',sans-serif",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>
          {g.emoji} {g.label}
        </button>
      ))}
    </div>
  </div>);
}
function StatusSelect({ value, onChange }) {
  const cur = STATUSES.findIndex(s=>s.id===value);
  return (<div style={{ marginBottom:16 }}>
    <label style={{ display:"block",fontSize:12,color:C.textDim,marginBottom:6,fontWeight:500 }}>進捗ステータス</label>
    <div style={{ display:"flex",gap:0,background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden" }}>
      {STATUSES.map(s=>(
        <button key={s.id} onClick={()=>onChange(s.id)} style={{ flex:1,padding:"10px 4px",cursor:"pointer",border:"none",background:value===s.id?s.color:"transparent",color:value===s.id?"#fff":C.textDim,fontSize:11,fontWeight:value===s.id?700:400,fontFamily:"'Noto Sans JP',sans-serif",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:3 }}>
          {s.emoji} {s.label}
        </button>
      ))}
    </div>
    <div style={{ display:"flex",alignItems:"center",marginTop:8 }}>
      {STATUSES.map((s,i)=>(<div key={s.id} style={{ display:"flex",alignItems:"center",flex:1 }}>
        <div style={{ width:10,height:10,borderRadius:"50%",background:i<=cur?s.color:C.border,transition:"all 0.3s",flexShrink:0 }} />
        {i<STATUSES.length-1&&<div style={{ flex:1,height:2,background:i<cur?STATUSES[i+1].color:C.border,transition:"all 0.3s" }}/>}
      </div>))}
    </div>
  </div>);
}

/* ── Naver Map ── */
function parseNaverMap(text) {
  if(!text||!text.trim()) return null;
  const lines=text.trim().split("\n").map(l=>l.trim()).filter(Boolean);
  const filtered=lines.filter(l=>!l.match(/^\[NAVER/i));
  let url="",nameLines=[...filtered];
  if(filtered.length>0&&filtered[filtered.length-1].match(/^https?:\/\//)){url=filtered[filtered.length-1];nameLines=filtered.slice(0,-1);}
  return {name:nameLines[0]||"",address:nameLines.slice(1).join(" ")||"",url};
}
function CopyableText({label,text}){
  const [copied,setCopied]=useState(false);
  const copy=async()=>{try{await navigator.clipboard.writeText(text)}catch(e){const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta)}setCopied(true);setTimeout(()=>setCopied(false),1500)};
  if(!text) return null;
  return (<div onClick={copy} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"8px 12px",background:C.bg,borderRadius:8,cursor:"pointer",border:`1px solid ${copied?"rgba(42,138,90,0.4)":C.border}`,transition:"all 0.2s",marginBottom:6}}>
    <div style={{minWidth:0}}><div style={{fontSize:10,color:C.textMuted,marginBottom:2}}>{label}</div><div style={{fontSize:13,color:C.text,wordBreak:"break-all"}}>{text}</div></div>
    <span style={{fontSize:11,color:copied?C.success:C.textDim,flexShrink:0,fontWeight:600}}>{copied?"✓":"📋"}</span>
  </div>);
}
function NaverMapInput({shopInfo,onChange}){
  const [raw,setRaw]=useState("");
  const hc=text=>{setRaw(text);const p=parseNaverMap(text);if(p&&p.name)onChange({nameJa:p.name,addressJa:p.address,url:p.url})};
  const has=shopInfo?.nameJa||shopInfo?.addressJa;
  return (<div style={{marginBottom:16}}>
    <label style={{display:"block",fontSize:12,color:C.textDim,marginBottom:6,fontWeight:500}}>店舗情報（NAVER マップ貼り付け）</label>
    <textarea value={raw} onChange={e=>hc(e.target.value)} placeholder={"[NAVER マップ]\n店名\n住所\nhttps://naver.me/..."} style={{width:"100%",padding:"10px 14px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:16,outline:"none",boxSizing:"border-box",fontFamily:"'Noto Sans JP',sans-serif",minHeight:70,resize:"vertical"}}/>
    {has&&<div style={{marginTop:8,padding:10,background:C.surfaceAlt,borderRadius:8,border:`1px solid ${C.border}`}}>
      <div style={{fontSize:11,color:C.textDim,marginBottom:4}}>📍 {shopInfo.nameJa}</div>
      <div style={{fontSize:11,color:C.textMuted}}>{shopInfo.addressJa}</div>
      {shopInfo.url&&<div style={{fontSize:10,color:C.shooting,marginTop:4}}>🔗 {shopInfo.url}</div>}
    </div>}
  </div>);
}

/* ── Case Form ── */
function CaseForm({initial,onSave,onCancel}){
  const [form,setForm]=useState(initial||{title:"",content:"",shootingDate:todayStr(),deadlines:[twoWeeksStr()],paymentDate:todayStr(),paymentAmount:"50000",genre:"food",status:"acquired",shopInfo:{nameJa:"",addressJa:"",url:""}});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const addDL=()=>set("deadlines",[...form.deadlines,""]);
  const rmDL=i=>set("deadlines",form.deadlines.filter((_,idx)=>idx!==i));
  const upDL=(i,v)=>{const d=[...form.deadlines];d[i]=v;set("deadlines",d)};
  const valid=form.title.trim();
  return (<div>
    <Input label="タイトル *" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="〇〇サムギョプサル"/>
    <GenreSelect value={form.genre} onChange={v=>set("genre",v)}/>
    <StatusSelect value={form.status||"acquired"} onChange={v=>set("status",v)}/>
    <TextArea label="内容" value={form.content} onChange={e=>set("content",e.target.value)} placeholder="案件の詳細..."/>
    <Input label="撮影日" type="date" value={form.shootingDate} onChange={e=>set("shootingDate",e.target.value)}/>
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <label style={{fontSize:12,color:C.textDim,fontWeight:500}}>期日（複数設定可）</label>
        <Btn variant="ghost" small onClick={addDL} style={{fontSize:11,color:C.accent}}>＋ 追加</Btn>
      </div>
      {form.deadlines.map((d,i)=>(<div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
        <input type="date" value={d} onChange={e=>upDL(i,e.target.value)} style={{flex:1,padding:"10px 14px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:16,outline:"none",fontFamily:"'Noto Sans JP',sans-serif",boxSizing:"border-box",WebkitAppearance:"none",MozAppearance:"none",appearance:"none",minWidth:0}}/>
        {form.deadlines.length>1&&<button onClick={()=>rmDL(i)} style={{background:"none",border:"none",color:C.danger,cursor:"pointer",fontSize:16,padding:"4px 8px"}}>✕</button>}
      </div>))}
    </div>
    <Input label="入金日" type="date" value={form.paymentDate} onChange={e=>set("paymentDate",e.target.value)}/>
    <Input label="入金額" type="number" value={form.paymentAmount} onChange={e=>set("paymentAmount",e.target.value)} placeholder="¥50,000"/>
    <NaverMapInput shopInfo={form.shopInfo||{}} onChange={v=>set("shopInfo",v)}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
      <Btn variant="secondary" onClick={onCancel}>キャンセル</Btn>
      <Btn disabled={!valid} onClick={()=>onSave(form)}>保存</Btn>
    </div>
  </div>);
}

/* ── Case Detail ── */
function CaseDetail({c,onEdit,onDelete,onStatusChange}){
  const genre=GENRES.find(g=>g.id===c.genre)||GENRES[2];
  const st=getStatus(c);
  const isDone=st.id==="delivered";
  const shop=c.shopInfo;
  const hasShop=shop&&(shop.nameJa||shop.addressJa);
  const [confirmDel,setConfirmDel]=useState(false);
  const nextIdx=STATUSES.findIndex(s=>s.id===st.id)+1;
  const nextSt=nextIdx<STATUSES.length?STATUSES[nextIdx]:null;
  const prevIdx=STATUSES.findIndex(s=>s.id===st.id)-1;
  const prevSt=prevIdx>=0?STATUSES[prevIdx]:null;
  return (<div>
    {/* Progress bar */}
    <div style={{display:"flex",alignItems:"center",marginBottom:20}}>
      {STATUSES.map((s,i)=>{const ci=STATUSES.findIndex(x=>x.id===st.id);const done=i<=ci;return(
        <div key={s.id} style={{display:"flex",alignItems:"center",flex:1}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:done?s.color:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,transition:"all 0.3s"}}>
              {done&&<span style={{color:"#fff",fontSize:10}}>{i<ci?"✓":s.emoji}</span>}
            </div>
            <span style={{fontSize:8,color:done?s.color:C.textMuted,fontWeight:done?600:400}}>{s.label}</span>
          </div>
          {i<STATUSES.length-1&&<div style={{flex:1,height:2,background:i<ci?STATUSES[i+1].color:C.border,margin:"0 2px",marginBottom:14,transition:"all 0.3s"}}/>}
        </div>
      );})}
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
      <Badge color={genre.color} dimColor={genre.dim}>{genre.emoji} {genre.label}</Badge>
      {c.shootingDate?<Badge color={C.shooting} dimColor={C.shootingDim}>📷 {fmtDate(c.shootingDate)}</Badge>:<Badge color={C.textMuted} dimColor={C.doneDim}>📷 撮影日未定</Badge>}
    </div>
    {c.content&&<p style={{color:C.textDim,fontSize:14,lineHeight:1.7,margin:"0 0 16px",whiteSpace:"pre-wrap"}}>{c.content}</p>}
    {c.deadlines.filter(Boolean).length>0&&<div style={{marginBottom:16}}>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:8,fontWeight:500}}>期日</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{c.deadlines.filter(Boolean).map((d,i)=>{const dl=daysUntil(d);return <span key={i} style={{display:"inline-flex",alignItems:"center",gap:6}}><Badge color={C.deadline} dimColor={C.deadlineDim}>🎯 {fmtDate(d)}</Badge>{dl!==null&&<UrgencyBadge daysLeft={dl}/>}</span>})}</div>
    </div>}
    {(c.paymentDate||c.paymentAmount)&&<div style={{marginBottom:16}}>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:8,fontWeight:500}}>入金情報</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {c.paymentDate&&<Badge color={C.success} dimColor={C.successDim}>💰 {fmtDate(c.paymentDate)}</Badge>}
        {c.paymentAmount&&<Badge color={C.success} dimColor={C.successDim}>{fmtCurrency(c.paymentAmount)}</Badge>}
      </div>
    </div>}
    {hasShop&&<div style={{marginBottom:16}}>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:8,fontWeight:500}}>📍 店舗情報 <span style={{fontSize:10,fontWeight:400}}>（タップでコピー）</span></div>
      {shop.nameJa&&<CopyableText label="店名" text={shop.nameJa}/>}
      {shop.addressJa&&<CopyableText label="住所" text={shop.addressJa}/>}
      {shop.url&&<a href={shop.url} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:C.shooting,textDecoration:"none",padding:"4px 0"}}>🔗 NAVER マップで開く</a>}
    </div>}
    <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,marginTop:24}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {nextSt&&<button onClick={()=>onStatusChange(nextSt.id)} style={{flex:1,padding:"12px 16px",borderRadius:12,border:"none",cursor:"pointer",background:nextSt.color,color:"#fff",fontSize:14,fontWeight:700,fontFamily:"'Noto Sans JP',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{nextSt.emoji} {nextSt.label}にする →</button>}
        {prevSt&&<button onClick={()=>onStatusChange(prevSt.id)} style={{padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,cursor:"pointer",background:C.surfaceAlt,color:C.textDim,fontSize:12,fontWeight:500,fontFamily:"'Noto Sans JP',sans-serif"}}>← 戻す</button>}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        {!confirmDel?<Btn variant="danger" small onClick={()=>setConfirmDel(true)}>削除</Btn>:<><Btn variant="secondary" small onClick={()=>setConfirmDel(false)}>やめる</Btn><Btn variant="danger" small onClick={onDelete}>本当に削除</Btn></>}
        <Btn variant="secondary" small onClick={onEdit}>編集</Btn>
      </div>
    </div>
  </div>);
}

/* ── Today View ── */
function TodayView({cases,onCaseClick}){
  const today=new Date();today.setHours(0,0,0,0);
  const sections=useMemo(()=>{
    const ac=cases.filter(c=>(c.status||"acquired")!=="delivered"&&!c.done);

    // Overdue: any active case with a deadline in the past
    const overdue=[];
    ac.forEach(c=>c.deadlines.filter(Boolean).forEach(d=>{
      const dl=daysUntil(d);if(dl!==null&&dl<0)overdue.push({...c,deadlineDate:d,daysLeft:dl});
    }));
    overdue.sort((a,b)=>a.daysLeft-b.daysLeft);

    // Shooting today
    const shootToday=ac.filter(c=>{
      const sd=parseLocal(c.shootingDate);if(!sd)return false;sd.setHours(0,0,0,0);
      return sd.getTime()===today.getTime()&&(c.status||"acquired")==="acquired";
    });

    // Needs editing (shot status) — with nearest deadline info attached
    const needsEdit=ac.filter(c=>(c.status||"acquired")==="shot").map(c=>{
      const dls=c.deadlines.filter(Boolean).map(d=>({d,dl:daysUntil(d)})).filter(x=>x.dl!==null).sort((a,b)=>a.dl-b.dl);
      return {...c, nearestDL:dls[0]||null};
    }).sort((a,b)=>(a.nearestDL?.dl??999)-(b.nearestDL?.dl??999));

    // Upcoming shoots (within 7 days, not today)
    const upcoming=ac.filter(c=>{
      if((c.status||"acquired")!=="acquired")return false;
      const sd=parseLocal(c.shootingDate);if(!sd)return false;sd.setHours(0,0,0,0);
      const diff=Math.ceil((sd-today)/86400000);
      return diff>0&&diff<=7;
    }).map(c=>{
      const sd=parseLocal(c.shootingDate);sd.setHours(0,0,0,0);
      return {...c,shootDaysLeft:Math.ceil((sd-today)/86400000)};
    }).sort((a,b)=>a.shootDaysLeft-b.shootDaysLeft);

    // Undated: acquired but no shooting date set
    const undated=ac.filter(c=>(c.status||"acquired")==="acquired"&&!c.shootingDate);

    return {overdue,shootToday,needsEdit,upcoming,undated};
  },[cases]);

  const {overdue,shootToday,needsEdit,upcoming,undated}=sections;
  const empty=!overdue.length&&!shootToday.length&&!needsEdit.length&&!upcoming.length&&!undated.length;

  const Card=({c,extra})=>{
    const g=GENRES.find(x=>x.id===c.genre)||GENRES[2];
    const s=getStatus(c);
    return(
      <div onClick={()=>onCaseClick(c)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,marginBottom:6,cursor:"pointer",borderLeft:`4px solid ${s.color}`,transition:"all 0.15s"}}
        onMouseEnter={e=>{e.currentTarget.style.background=C.surfaceAlt}} onMouseLeave={e=>{e.currentTarget.style.background=C.surface}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>{c.title}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <Badge color={g.color} dimColor={g.dim}>{g.emoji} {g.label}</Badge>
            {c.deadlineDate&&<UrgencyBadge daysLeft={c.daysLeft}/>}
            {c.nearestDL&&<UrgencyBadge daysLeft={c.nearestDL.dl}/>}
            {c.shootDaysLeft&&<span style={{fontSize:10,color:C.textDim}}>📷 {c.shootDaysLeft}日後</span>}
            {c.paymentAmount&&<Badge color={C.success} dimColor={C.successDim}>{fmtCurrency(c.paymentAmount)}</Badge>}
            {extra}
          </div>
        </div>
        <span style={{color:C.textMuted,fontSize:18,flexShrink:0}}>›</span>
      </div>
    );
  };

  const Sec=({title,emoji,items,color,renderCard})=>items.length>0&&<div style={{marginBottom:20}}>
    <div style={{fontSize:13,fontWeight:700,color,marginBottom:8,display:"flex",alignItems:"center",gap:4}}>{emoji} {title}</div>
    {items.map((c,i)=>renderCard?renderCard(c,i):<Card key={c.id+"-"+i} c={c}/>)}
  </div>;

  return <div>
    {empty?<div style={{textAlign:"center",padding:"48px 20px"}}><div style={{fontSize:36,marginBottom:10}}>☀️</div><div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:4}}>今日のタスクはありません</div><div style={{fontSize:12,color:C.textMuted}}>お疲れさまです！</div></div>:<>
      <Sec title={`期日超過（${overdue.length}件）`} emoji="🚨" items={overdue} color={C.danger} renderCard={(c,i)=><Card key={c.id+"-ov-"+i} c={c}/>}/>
      <Sec title="今日の撮影" emoji="📷" items={shootToday} color={C.shooting} renderCard={(c,i)=><Card key={c.id+"-st-"+i} c={c}/>}/>
      <Sec title={`編集・納品待ち（${needsEdit.length}件）`} emoji="✂️" items={needsEdit} color="#8b5cf6" renderCard={(c,i)=><Card key={c.id+"-ne-"+i} c={c}/>}/>
      <Sec title={`今後の撮影予定（${upcoming.length}件）`} emoji="📅" items={upcoming} color="#1a8a9a" renderCard={(c,i)=><Card key={c.id+"-up-"+i} c={c}/>}/>
      {undated.length>0&&<Sec title={`撮影日未定（${undated.length}件）`} emoji="📋" items={undated} color={C.textMuted} renderCard={(c,i)=><Card key={c.id+"-ud-"+i} c={c}/>}/>}
    </>}
  </div>;
}

/* ── MonthNav ── */
function MonthNav({currentMonth,setCurrentMonth}){
  const yr=currentMonth.getFullYear(),mo=currentMonth.getMonth();
  return <div style={{display:"flex",alignItems:"center",gap:8}}>
    <button onClick={()=>setCurrentMonth(new Date(yr,mo-1,1))} style={{background:"none",border:"none",color:C.textDim,fontSize:18,cursor:"pointer",padding:"2px 8px"}}>‹</button>
    <span style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"'Noto Sans JP',sans-serif",minWidth:100,textAlign:"center"}}>{yr}年 {mo+1}月</span>
    <button onClick={()=>setCurrentMonth(new Date(yr,mo+1,1))} style={{background:"none",border:"none",color:C.textDim,fontSize:18,cursor:"pointer",padding:"2px 8px"}}>›</button>
  </div>;
}

/* ── Monthly Calendar ── */
function MonthCalendar({cases,currentMonth,setCurrentMonth,onDayClick}){
  const yr=currentMonth.getFullYear(),mo=currentMonth.getMonth();
  const off=new Date(yr,mo,1).getDay(),total=new Date(yr,mo+1,0).getDate();
  const dayEv=useMemo(()=>{const m={};cases.forEach(c=>{const add=(ds,t)=>{if(!ds)return;const d=parseLocal(ds);if(!d)return;if(d.getFullYear()===yr&&d.getMonth()===mo){const k=d.getDate();if(!m[k])m[k]=[];m[k].push({type:t,caseTitle:c.title,caseId:c.id,done:!!c.done})}};add(c.shootingDate,"shooting");c.deadlines.forEach(dl=>add(dl,"deadline"));add(c.paymentDate,"payment")});return m},[cases,yr,mo]);
  const td=new Date();
  return <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
    <div style={{display:"flex",justifyContent:"center",padding:"16px 20px",borderBottom:`1px solid ${C.border}`}}><MonthNav currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}/></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
      {["日","月","火","水","木","金","土"].map(d=><div key={d} style={{textAlign:"center",padding:"8px 0",fontSize:11,color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>{d}</div>)}
      {Array.from({length:42},(_,i)=>{const day=i-off+1;if(day<1||day>total)return <div key={i} style={{borderBottom:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`}}/>;const ev=dayEv[day]||[];const isT=td.getFullYear()===yr&&td.getMonth()===mo&&td.getDate()===day;const hasA=ev.some(e=>!e.done);return(
        <div key={i} onClick={()=>{if(ev.length)onDayClick(toISO(new Date(yr,mo,day)),ev)}} style={{minHeight:64,padding:"4px 6px",borderBottom:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,cursor:ev.length?"pointer":"default",background:isT?"rgba(43,125,214,0.06)":"transparent",transition:"background 0.15s"}} onMouseEnter={e=>{if(ev.length)e.currentTarget.style.background=C.surfaceAlt}} onMouseLeave={e=>{e.currentTarget.style.background=isT?"rgba(43,125,214,0.06)":"transparent"}}>
          <div style={{fontSize:12,fontWeight:isT?700:400,color:isT?C.accent:C.text,marginBottom:3}}>{day}</div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {ev.some(e=>e.type==="shooting")&&<div style={{height:4,borderRadius:2,background:hasA?C.shooting:"rgba(43,125,214,0.2)"}}/>}
            {ev.some(e=>e.type==="deadline")&&<div style={{height:4,borderRadius:2,background:hasA?C.deadline:"rgba(196,122,20,0.2)"}}/>}
            {ev.some(e=>e.type==="payment")&&<div style={{height:4,borderRadius:2,background:hasA?C.success:"rgba(42,138,90,0.2)"}}/>}
          </div>
          {ev.length>0&&<div style={{fontSize:9,color:C.textMuted,marginTop:2}}>{ev.length}件</div>}
        </div>);})}
    </div>
    <div style={{display:"flex",gap:12,padding:"12px 20px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      {[["● 撮影日",C.shooting],["◆ 期日",C.deadline],["▲ 入金日",C.success]].map(([l,c])=><div key={l} style={{display:"flex",alignItems:"center",gap:5}}><span style={{color:c,fontSize:10,fontWeight:700}}>{l.charAt(0)}</span><span style={{fontSize:10,color:C.textDim}}>{l.slice(2)}</span></div>)}
    </div>
  </div>;
}

/* ── Continuous Timeline ── */
function GanttView({cases,onCaseClick}){
  const scrollRef=useRef(null);
  const COL_W=38;
  
  // Generate 3 months of dates: previous, current, next
  const today=new Date();
  const allDates=useMemo(()=>{
    const dates=[];
    const start=new Date(today.getFullYear(),today.getMonth()-1,1);
    const end=new Date(today.getFullYear(),today.getMonth()+2,0);
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      dates.push(new Date(d));
    }
    return dates;
  },[]);
  
  const GRID_W=allDates.length*COL_W;
  const todayIdx=allDates.findIndex(d=>d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()&&d.getDate()===today.getDate());

  // Scroll to today on mount
  useLayoutEffect(()=>{
    const el=scrollRef.current;if(!el)return;
    el.scrollLeft=Math.max(0,todayIdx*COL_W-el.clientWidth/2+COL_W/2);
  },[todayIdx]);

  // dateStr → index in allDates
  const dateToIdx=(ds)=>{
    if(!ds)return null;
    const d=parseLocal(ds);if(!d)return null;
    d.setHours(0,0,0,0);
    const idx=allDates.findIndex(x=>x.getFullYear()===d.getFullYear()&&x.getMonth()===d.getMonth()&&x.getDate()===d.getDate());
    return idx>=0?idx:null;
  };

  // Relevant cases: any case with dates within the range
  const rangeStart=allDates[0],rangeEnd=allDates[allDates.length-1];
  const rel=useMemo(()=>{
    const a=[],dn=[];
    cases.forEach(c=>{
      const ad=[c.shootingDate,...c.deadlines.filter(Boolean),c.paymentDate].filter(Boolean).map(d=>parseLocal(d)).filter(Boolean);
      if(!ad.length)return;
      const mn=new Date(Math.min(...ad.map(d=>d.getTime()))),mx=new Date(Math.max(...ad.map(d=>d.getTime())));
      if(mx>=rangeStart&&mn<=rangeEnd){
        if(c.done||(c.status||"acquired")==="delivered")dn.push(c);else a.push(c);
      }
    });
    a.sort((x,y)=>(parseLocal(x.shootingDate)||0)-(parseLocal(y.shootingDate)||0));
    dn.sort((x,y)=>(parseLocal(x.shootingDate)||0)-(parseLocal(y.shootingDate)||0));
    return [...a,...dn];
  },[cases,rangeStart,rangeEnd]);

  // Scroll by month via buttons
  const scrollBy=(dir)=>{
    const el=scrollRef.current;if(!el)return;
    const shift=30*COL_W*dir;
    el.scrollTo({left:el.scrollLeft+shift,behavior:"smooth"});
  };

  return <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",borderBottom:`1px solid ${C.border}`}}>
      <button onClick={()=>scrollBy(-1)} style={{background:"none",border:"none",color:C.textDim,fontSize:18,cursor:"pointer",padding:"2px 12px"}}>‹ 前月</button>
      <button onClick={()=>{const el=scrollRef.current;if(el)el.scrollTo({left:todayIdx*COL_W-el.clientWidth/2+COL_W/2,behavior:"smooth"})}} style={{background:C.accentDim,border:`1px solid rgba(43,125,214,0.2)`,color:C.accent,fontSize:11,fontWeight:600,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>今日</button>
      <button onClick={()=>scrollBy(1)} style={{background:"none",border:"none",color:C.textDim,fontSize:18,cursor:"pointer",padding:"2px 12px"}}>次月 ›</button>
    </div>
    <div style={{display:"flex"}}>
      <div style={{minWidth:140,maxWidth:140,flexShrink:0,borderRight:`2px solid ${C.border}`,zIndex:2,background:C.surface}}>
        <div style={{height:52,display:"flex",alignItems:"center",padding:"0 12px",borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.textMuted,fontWeight:600}}>案件名</div>
        {rel.map(c=>{const g=GENRES.find(x=>x.id===c.genre)||GENRES[2];const dn=c.done||(c.status||"acquired")==="delivered";return(
          <div key={c.id} onClick={()=>onCaseClick&&onCaseClick(c)} style={{height:44,display:"flex",alignItems:"center",gap:5,padding:"0 8px",borderBottom:`1px solid ${C.border}`,overflow:"hidden",opacity:dn?0.4:1,cursor:"pointer",transition:"background 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background=C.surfaceAlt}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
            {dn&&<span style={{fontSize:10,color:C.done}}>✓</span>}
            <span style={{fontSize:11}}>{g.emoji}</span>
            <span style={{fontSize:11,color:dn?C.textMuted:C.text,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:dn?"line-through":"none"}}>{c.title}</span>
          </div>)})}
        {rel.length===0&&<div style={{padding:20,fontSize:12,color:C.textMuted,textAlign:"center"}}>案件なし</div>}
      </div>
      <div ref={scrollRef} style={{flex:1,overflowX:"scroll",overflowY:"hidden",WebkitOverflowScrolling:"touch",scrollbarWidth:"thin"}}>
        <div style={{width:GRID_W,minWidth:GRID_W}}>
          {/* Header */}
          <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,height:52}}>
            {allDates.map((dt,i)=>{
              const dow=dt.getDay(),isW=dow===0||dow===6,isT=i===todayIdx;
              const isFirst=dt.getDate()===1;
              return(
              <div key={i} style={{width:COL_W,minWidth:COL_W,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRight:`1px solid ${isFirst?"#bbb":C.border}`,background:isT?"rgba(43,125,214,0.10)":isW?"rgba(0,0,0,0.02)":"transparent",borderLeft:isFirst?`2px solid ${C.borderLight}`:"none"}}>
                {isFirst&&<span style={{fontSize:8,color:C.accent,fontWeight:700,lineHeight:1}}>{dt.getMonth()+1}月</span>}
                {!isFirst&&<span style={{fontSize:9,color:isT?C.accent:C.textMuted}}>{["日","月","火","水","木","金","土"][dow]}</span>}
                <span style={{fontSize:12,fontWeight:isT?800:isFirst?700:400,color:isT?"#fff":isFirst?C.accent:isW?C.textMuted:C.text,background:isT?C.accent:"none",borderRadius:isT?10:0,padding:isT?"1px 7px":"0"}}>{dt.getDate()}</span>
              </div>);
            })}
          </div>
          {/* Rows */}
          {rel.map(c=>{
            const dn=c.done||(c.status||"acquired")==="delivered";
            const g=GENRES.find(x=>x.id===c.genre)||GENRES[2];
            const sdIdx=dateToIdx(c.shootingDate);
            const dlIdxs=c.deadlines.filter(Boolean).map(d=>dateToIdx(d)).filter(x=>x!==null);
            const pdIdx=dateToIdx(c.paymentDate);
            const al=dn?0.3:1;
            // Line from shooting to last marker
            const allMarkers=[...dlIdxs];if(pdIdx!==null)allMarkers.push(pdIdx);
            const lineStart=sdIdx;
            const lineEnd=allMarkers.length>0?Math.max(...allMarkers):null;
            const hasLine=lineStart!==null&&lineEnd!==null&&lineEnd>lineStart;
            return(
            <div key={c.id} style={{display:"flex",height:44,position:"relative",borderBottom:`1px solid ${C.border}`}}>
              {allDates.map((dt,i)=>{const isT=i===todayIdx,dow=dt.getDay(),isW=dow===0||dow===6,isFirst=dt.getDate()===1;
                return <div key={i} style={{width:COL_W,minWidth:COL_W,borderRight:`1px solid ${isFirst?"#bbb":C.border}`,background:isT?"rgba(43,125,214,0.05)":isW?"rgba(0,0,0,0.015)":"transparent",borderLeft:isFirst?`2px solid ${C.borderLight}`:"none"}}/>})}
              {todayIdx>=0&&<div style={{position:"absolute",top:0,bottom:0,left:todayIdx*COL_W+COL_W/2,width:2,background:"rgba(43,125,214,0.25)",zIndex:0}}/>}
              {hasLine&&<div style={{position:"absolute",top:17,height:10,borderRadius:5,left:lineStart*COL_W+COL_W/2,width:(lineEnd-lineStart)*COL_W,background:dn?"rgba(176,173,186,0.3)":`linear-gradient(90deg, ${C.shooting}, ${g.color})`,opacity:dn?0.4:0.7,zIndex:1}}/>}
              {sdIdx!==null&&<div style={{position:"absolute",top:15,left:sdIdx*COL_W+COL_W/2-7,zIndex:2}}><div style={{width:14,height:14,borderRadius:"50%",background:C.shooting,opacity:al,boxShadow:dn?"none":`0 0 8px ${C.shooting}`,border:"2px solid rgba(255,255,255,0.9)"}}/></div>}
              {dlIdxs.map((idx,i)=><div key={`dl${i}`} style={{position:"absolute",top:15,left:idx*COL_W+COL_W/2-7,zIndex:2}}><div style={{width:14,height:14,borderRadius:3,background:C.deadline,opacity:al,boxShadow:dn?"none":`0 0 8px ${C.deadline}`,transform:"rotate(45deg)",border:"2px solid rgba(255,255,255,0.9)"}}/></div>)}
              {pdIdx!==null&&<div style={{position:"absolute",top:15,left:pdIdx*COL_W+COL_W/2-7,zIndex:2}}><div style={{width:0,height:0,borderLeft:"7px solid transparent",borderRight:"7px solid transparent",borderBottom:`14px solid ${C.success}`,opacity:al,filter:dn?"none":`drop-shadow(0 0 4px ${C.success})`}}/></div>}
            </div>);
          })}
        </div>
      </div>
    </div>
    <div style={{display:"flex",gap:12,padding:"12px 20px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      {[["● 撮影日",C.shooting],["◆ 期日",C.deadline],["▲ 入金日",C.success],["━ 撮影〜期日",C.shooting],["● 完了",C.done]].map(([l,co])=><div key={l} style={{display:"flex",alignItems:"center",gap:5}}><span style={{color:co,fontSize:10,fontWeight:700}}>{l.charAt(0)}</span><span style={{fontSize:10,color:C.textDim}}>{l.slice(2)}</span></div>)}
    </div>
  </div>;
}

/* ── Stats ── */
function MonthlyStats({cases,currentMonth,setCurrentMonth,settings,onOpenSettings,onOpenSenderSettings}){
  const yr=currentMonth.getFullYear(),mo=currentMonth.getMonth();
  const mc=cases.filter(c=>{const sd=parseLocal(c.shootingDate);return sd&&sd.getFullYear()===yr&&sd.getMonth()===mo});
  const cc=cases.filter(c=>{if(c.done||(c.status||"acquired")==="delivered")return false;const sd=parseLocal(c.shootingDate);if(!sd)return false;const ld=c.deadlines.filter(Boolean).sort().pop();const end=ld?parseLocal(ld):sd;return sd<=new Date(yr,mo+1,0)&&end>=new Date(yr,mo,1)});
  const mR=settings.maxMonthly>0?mc.length/settings.maxMonthly:0,cR=settings.maxConcurrent>0?cc.length/settings.maxConcurrent:0;
  const mp=mc.reduce((s,c)=>s+(Number(c.paymentAmount)||0),0);
  const bC=r=>r>=1?C.danger:r>=0.75?C.accent:C.success;
  const cr=Math.max(settings.maxConcurrent-cc.length,0),mr=Math.max(settings.maxMonthly-mc.length,0);
  const dc=mc.filter(c=>c.done||(c.status||"acquired")==="delivered").length;
  return <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:8}}>
      <MonthNav currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}/>
      <div style={{display:"flex",gap:6}}><Btn variant="ghost" small onClick={onOpenSenderSettings} style={{fontSize:11}}>📄 発行者設定</Btn><Btn variant="ghost" small onClick={onOpenSettings} style={{fontSize:11}}>⚙ 設定</Btn></div>
    </div>
    {[{label:"今月の案件数",cur:mc.length,max:settings.maxMonthly,ratio:mR,extra:dc>0?`（完了 ${dc}件）`:null},{label:"同時進行案件数",cur:cc.length,max:settings.maxConcurrent,ratio:cR}].map(({label,cur,max,ratio,extra})=><div key={label} style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:C.textDim}}>{label} {extra&&<span style={{color:C.done,fontSize:11}}>{extra}</span>}</span><span style={{fontSize:13,fontWeight:700,color:ratio>=1?C.danger:C.text}}>{cur} / {max}</span></div>
      <div style={{height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,transition:"width 0.5s",width:`${Math.min(ratio*100,100)}%`,background:bC(ratio)}}/></div>
    </div>)}
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 100px",minWidth:0,background:cR>=0.85?C.dangerDim:C.bg,borderRadius:12,padding:14,textAlign:"center",border:cR>=0.85?"1px solid rgba(208,68,64,0.2)":"1px solid transparent",position:"relative"}}>
        {cr<=1&&<div style={{position:"absolute",top:6,right:8,width:8,height:8,borderRadius:"50%",background:C.danger,animation:"pulse 1.5s infinite"}}/>}
        <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>同時進行可能枠</div>
        <div style={{fontSize:22,fontWeight:800,color:cR>=1?C.danger:cR>=0.75?C.accent:C.success,fontFamily:"monospace"}}>{cr}件</div>
      </div>
      <div style={{flex:"1 1 100px",minWidth:0,background:C.bg,borderRadius:12,padding:14,textAlign:"center"}}>
        <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>今月の残り枠</div>
        <div style={{fontSize:22,fontWeight:800,color:mR>=1?C.danger:C.accent,fontFamily:"monospace"}}>{mr}件</div>
      </div>
      <div style={{flex:"1 1 100px",minWidth:0,background:C.bg,borderRadius:12,padding:14,textAlign:"center"}}>
        <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>売上</div>
        <div style={{fontSize:16,fontWeight:800,color:C.success,fontFamily:"monospace",marginTop:3}}>{fmtCurrency(mp)}</div>
      </div>
    </div>
    <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
  </div>;
}

/* ── Invoice PDF ── */
const fmtJpDate=(ds)=>{if(!ds)return'';const d=parseLocal(ds);if(!d)return'';return`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`};

const loadPdfLibs=()=>new Promise((res,rej)=>{
  const scripts=[
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  ];
  let loaded=0;
  if(window.html2canvas&&window.jspdf){res();return}
  scripts.forEach(src=>{
    if((src.includes('html2canvas')&&window.html2canvas)||(src.includes('jspdf')&&window.jspdf)){loaded++;if(loaded===2)res();return}
    const s=document.createElement('script');s.src=src;
    s.onload=()=>{loaded++;if(loaded===2)res()};
    s.onerror=rej;document.head.appendChild(s);
  });
});

async function generateInvoicePdf(form,sender,subtotal,tax,taxType,setGen){
  const items=form.items.filter(it=>it.name&&it.amount);
  const emptyRows=Math.max(0,10-items.length);
  const taxLabel=taxType==="inclusive"?"消費税 (10% 内税)":"消費税 (10%)";
  const displayTotal=taxType==="inclusive"?subtotal:subtotal+tax;
  const taxDisplay=taxType==="inclusive"?"("+tax.toLocaleString()+")":tax.toLocaleString();
  const fn=`${form.recipientName}様_${form.invoiceNumber}`;

  setGen(true);
  try{
    await loadPdfLibs();

    // Create hidden container with FIXED pixel dimensions matching A4 ratio
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;left:0;top:0;width:794px;height:1123px;overflow:hidden;z-index:99999;opacity:0;pointer-events:none;';
    const el=document.createElement('div');
    el.style.cssText='width:794px;min-height:1123px;padding:45px 64px 38px;background:#fff;box-sizing:border-box;font-family:"Noto Sans JP",sans-serif;color:#1a1a1a;';
    el.innerHTML=`
<style>
.items-tbl{border-collapse:collapse;width:100%;}
.items-tbl td,.items-tbl th{border:1px solid #555;padding:6px 10px;font-size:12px;height:26px;}
.items-tbl th{font-weight:700;font-size:11px;text-align:center;background:#e8e8e8;color:#1a1a1a;}
.summary-tbl{border-collapse:collapse;width:45%;margin-left:55%;}
.summary-tbl td{border:1px solid #555;padding:6px 10px;font-size:12px;height:26px;}
.r{text-align:right;}.b{font-weight:bold;}
.lt{border-collapse:collapse;width:100%;}.lt td{border:none;padding:0;vertical-align:top;}
</style>
<div style="text-align:right;font-size:12px;font-weight:bold;">${fmtJpDate(form.date)}</div>
<div style="text-align:right;font-size:12px;font-weight:bold;margin-top:6px;">請求番号 : ${form.invoiceNumber}</div>
<div style="text-align:center;font-size:26px;font-weight:900;margin:16px 0;">請求書</div>
<table class="lt"><tr>
<td style="width:58%;">
  <div style="border-bottom:1px solid #1a1a1a;padding-bottom:6px;display:inline-block;"><span style="font-size:14px;font-weight:bold;">${form.recipientName}</span><span style="font-size:14px;font-weight:bold;margin-left:36px;">御中</span></div>
  <div style="font-size:13px;font-weight:bold;margin-top:12px;">件名：${form.subject}</div>
  <div style="font-size:12px;margin-top:6px;">下記のとおりご請求申し上げます。</div>
  <div style="margin-top:10px;display:inline-block;border-bottom:1px solid #1a1a1a;padding-bottom:3px;"><span style="font-size:13px;font-weight:900;">ご請求金額</span><span style="font-size:17px;font-weight:900;padding:0 4px 0 14px;">¥${displayTotal.toLocaleString()}-</span></div>
  <div style="font-size:12px;font-weight:bold;margin-top:10px;">お支払い期限　${fmtJpDate(form.paymentDeadline)}</div>
</td>
<td style="width:42%;padding-left:16px;">
  <div style="font-size:11px;line-height:1.8;">
    <div style="font-weight:bold;font-size:12px;">${sender.company}</div>
    <div>${sender.representative}</div>
    <div style="margin-top:6px;">${sender.zip}</div>
    <div>${sender.address}</div>
    <div style="margin-top:6px;">${sender.tel}</div>
    <div>${sender.email}</div>
    <div>${sender.registration}</div>
  </div>
</td>
</tr></table>
<table class="items-tbl" style="margin-top:14px;">
  <tr><th style="width:55%;">品番・品名</th><th style="width:12%;">数量</th><th style="width:16%;">単価</th><th style="width:17%;">金額</th></tr>
  ${items.map(it=>`<tr><td>${it.name}</td><td class="r">${it.qty||1}</td><td class="r">${parseInt(it.amount).toLocaleString()}</td><td class="r">${(parseInt(it.amount)*(it.qty||1)).toLocaleString()}</td></tr>`).join('')}
  ${Array(emptyRows).fill('<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>').join('')}
</table>
<table class="summary-tbl">
  <tr><td>小計</td><td class="r">${subtotal.toLocaleString()}</td></tr>
  <tr><td>${taxLabel}</td><td class="r">${taxDisplay}</td></tr>
  <tr><td class="b">合計</td><td class="r b">${displayTotal.toLocaleString()}</td></tr>
</table>
<div style="margin-top:14px;font-size:12px;">
  <div style="font-weight:bold;margin-bottom:4px;">お振込先：</div>
  <div>${sender.bank}</div>
</div>`;

    wrap.appendChild(el);
    document.body.appendChild(wrap);
    await new Promise(r=>setTimeout(r,300));

    // Capture as canvas with FORCED width - this is the key
    const canvas=await window.html2canvas(el,{
      scale:2,
      useCORS:true,
      width:794,
      height:1123,
      windowWidth:794,
      windowHeight:1123,
      scrollX:0,
      scrollY:0,
      x:0,
      y:0,
      logging:false
    });

    document.body.removeChild(wrap);

    // Create PDF and add canvas as image
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
    const imgData=canvas.toDataURL('image/png');
    doc.addImage(imgData,'PNG',0,0,210,297);
    doc.save(fn+'.pdf');
  }catch(e){alert('PDF生成に失敗しました: '+e.message)}
  setGen(false);
}


function InvoicePage({sender,onOpenSenderSettings}){
  const getNextMonthEnd=()=>{const now=new Date();const y=now.getMonth()===11?now.getFullYear()+1:now.getFullYear();const m=now.getMonth()===11?1:now.getMonth()+2;const d=new Date(y,m,0);return`${y}-${String(m).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const initForm=()=>{const d=todayStr();const num=d.replace(/-/g,'')+'01';return{date:d,invoiceNumber:num,paymentDeadline:getNextMonthEnd(),recipientName:'',subject:'',taxType:'inclusive',items:[{name:'',qty:1,amount:''}]}};
  const [form,setForm]=useState(initForm);
  const [gen,setGen]=useState(false);
  const [itemEdited,setItemEdited]=useState(false);
  const set=(k,v)=>{
    setForm(p=>{
      const next={...p,[k]:v};
      if(k==='subject'&&!itemEdited&&p.items.length>0){
        next.items=[{...p.items[0],name:v},...p.items.slice(1)];
      }
      return next;
    });
  };
  const setItem=(i,k,v)=>{if(i===0&&k==='name')setItemEdited(true);setForm(p=>{const items=[...p.items];items[i]={...items[i],[k]:v};return{...p,items}})};
  const addItem=()=>setForm(p=>({...p,items:[...p.items,{name:'',qty:1,amount:''}]}));
  const rmItem=i=>setForm(p=>({...p,items:p.items.filter((_,j)=>j!==i)}));
  const resetForm=()=>{setForm(initForm());setItemEdited(false)};
  const subtotal=form.items.reduce((s,it)=>s+((parseInt(it.amount)||0)*(parseInt(it.qty)||1)),0);
  const tax=form.taxType==="inclusive"?Math.floor(subtotal/11):Math.floor(subtotal*0.1);
  const displayTotal=form.taxType==="inclusive"?subtotal:subtotal+tax;
  const generate=()=>{
    if(!form.recipientName){alert('請求先を入力してください');return}
    if(!form.subject){alert('件名を入力してください');return}
    generateInvoicePdf(form,sender,subtotal,tax,form.taxType,setGen);
  };
  const taxOpts=[{id:"inclusive",label:"税込（内税）"},{id:"exclusive",label:"税別（外税）"}];
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{fontSize:16,fontWeight:700,color:C.text}}>📄 請求書作成</div>
      <div style={{display:"flex",gap:6}}>
        <Btn variant="ghost" small onClick={onOpenSenderSettings}>⚙ 発行者</Btn>
        <Btn variant="ghost" small onClick={resetForm}>↻ リセット</Btn>
      </div>
    </div>
    <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Input label="請求日" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/>
        <Input label="請求番号" value={form.invoiceNumber} onChange={e=>set('invoiceNumber',e.target.value)}/>
      </div>
      <Input label="請求先 *" value={form.recipientName} onChange={e=>set('recipientName',e.target.value)} placeholder="株式会社〜"/>
      <Input label="お支払い期限" type="date" value={form.paymentDeadline} onChange={e=>set('paymentDeadline',e.target.value)}/>
      <Input label="件名 *" value={form.subject} onChange={e=>set('subject',e.target.value)} placeholder="〇〇 PR費用"/>
      <div style={{marginTop:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>消費税の計算方法</div>
        <div style={{display:'flex',gap:4,background:C.bg,borderRadius:10,padding:3}}>
          {taxOpts.map(t=><button key={t.id} onClick={()=>set('taxType',t.id)} style={{flex:1,padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:form.taxType===t.id?C.accent:"transparent",color:form.taxType===t.id?"#fff":C.textDim,fontSize:12,fontWeight:form.taxType===t.id?700:400,fontFamily:"'Noto Sans JP',sans-serif",transition:"all 0.2s"}}>{t.label}</button>)}
        </div>
      </div>
      <div style={{fontSize:12,fontWeight:600,color:C.text,marginTop:16,marginBottom:8}}>明細項目</div>
      {form.items.map((it,i)=><div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'flex-end'}}>
        <div style={{flex:3}}><Input label={i===0?"品名":""} value={it.name} onChange={e=>setItem(i,'name',e.target.value)} placeholder="品名"/></div>
        <div style={{flex:1}}><Input label={i===0?"数量":""} value={it.qty} onChange={e=>setItem(i,'qty',e.target.value)} type="number"/></div>
        <div style={{flex:2}}><Input label={i===0?"金額":""} value={it.amount} onChange={e=>setItem(i,'amount',e.target.value)} placeholder="金額" type="number"/></div>
        {form.items.length>1&&<button onClick={()=>rmItem(i)} style={{background:'none',border:'none',color:C.danger,cursor:'pointer',fontSize:16,padding:'4px 8px',marginBottom:4}}>✕</button>}
      </div>)}
      <button onClick={addItem} style={{background:'none',border:'none',color:C.accent,cursor:'pointer',fontSize:12,marginBottom:16,fontFamily:"'Noto Sans JP',sans-serif"}}>＋ 項目を追加</button>
      <div style={{background:C.bg,borderRadius:10,padding:14,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}><span style={{color:C.textMuted}}>小計</span><span style={{fontWeight:600}}>{fmtCurrency(subtotal)}</span></div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.textMuted}}>
          <span>{form.taxType==="inclusive"?"消費税 (10% 内税)":"消費税 (10%)"}</span>
          <span>{form.taxType==="inclusive"?`(${fmtCurrency(tax)})`:fmtCurrency(tax)}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:16,fontWeight:700,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
          <span>ご請求金額</span><span style={{color:C.accent}}>¥{displayTotal.toLocaleString()}-</span>
        </div>
      </div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:12}}>
        📎 ファイル名: <span style={{color:C.text,fontWeight:500}}>{form.recipientName||'請求先'}様_{form.invoiceNumber}.pdf</span>
      </div>
      <Btn onClick={generate} disabled={gen} style={{width:'100%'}}>{gen?'⏳ PDF生成中...':'📄 PDFをダウンロード'}</Btn>
    </div>
  </div>;
}

function SenderSettingsModal({open,onClose,sender,onSave}){
  const [f,setF]=useState(sender);
  useEffect(()=>{if(open)setF(sender)},[open,sender]);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title="⚙️ 発行者情報の設定">
    <Input label="会社名" value={f.company} onChange={e=>s('company',e.target.value)}/>
    <Input label="代表者" value={f.representative} onChange={e=>s('representative',e.target.value)}/>
    <Input label="郵便番号" value={f.zip} onChange={e=>s('zip',e.target.value)}/>
    <Input label="住所" value={f.address} onChange={e=>s('address',e.target.value)}/>
    <Input label="電話番号" value={f.tel} onChange={e=>s('tel',e.target.value)}/>
    <Input label="メール" value={f.email} onChange={e=>s('email',e.target.value)}/>
    <Input label="登録番号" value={f.registration} onChange={e=>s('registration',e.target.value)}/>
    <div style={{fontSize:12,fontWeight:600,color:C.text,marginTop:16,marginBottom:8}}>振込先</div>
    <Input label="振込先情報（1行）" value={f.bank} onChange={e=>s('bank',e.target.value)}/>
    <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:12}}><Btn variant="secondary" onClick={onClose}>キャンセル</Btn><Btn onClick={()=>{onSave(f);onClose()}}>保存</Btn></div>
  </Modal>;
}

function SettingsModal({open,onClose,settings,onSave}){
  const [form,setForm]=useState(settings);
  useEffect(()=>{if(open)setForm(settings)},[open,settings]);
  return <Modal open={open} onClose={onClose} title="月間設定">
    <Input label="月間案件上限数" type="number" value={form.maxMonthly} onChange={e=>setForm(p=>({...p,maxMonthly:parseInt(e.target.value)||0}))}/>
    <Input label="同時進行案件上限数" type="number" value={form.maxConcurrent} onChange={e=>setForm(p=>({...p,maxConcurrent:parseInt(e.target.value)||0}))}/>
    <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:8}}><Btn variant="secondary" onClick={onClose}>キャンセル</Btn><Btn onClick={()=>{onSave(form);onClose()}}>保存</Btn></div>
  </Modal>;
}

function DayEventsModal({open,onClose,date,events}){
  if(!date||!events)return null;
  const tl={shooting:"📷 撮影",deadline:"🎯 期日",payment:"💰 入金"};
  const tc={shooting:C.shooting,deadline:C.deadline,payment:C.success};
  const td={shooting:C.shootingDim,deadline:C.deadlineDim,payment:C.paymentDim};
  return <Modal open={open} onClose={onClose} title={`${fmtDate(date)} のイベント`}>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {events.map((ev,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,opacity:ev.done?0.4:1}}>
        <Badge color={tc[ev.type]} dimColor={td[ev.type]}>{tl[ev.type]}</Badge>
        <span style={{fontSize:13,color:C.text}}>{ev.caseTitle}</span>
        {ev.done&&<Badge color={C.done} dimColor={C.doneDim} style={{fontSize:9}}>✓</Badge>}
      </div>)}
    </div>
  </Modal>;
}

/* ── PIN Lock Screen ── */
function simpleHash(str){let h=0;for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0;}return h.toString(36);}

function LockScreen({onUnlock}){
  const [phase,setPhase]=useState("loading"); // loading, setup, confirm, login
  const [pin,setPin]=useState("");
  const [firstPin,setFirstPin]=useState("");
  const [error,setError]=useState("");
  const [storedHash,setStoredHash]=useState(null);
  const [shake,setShake]=useState(false);

  useEffect(()=>{
    try{const v=localStorage.getItem(STORAGE_KEYS.pin);if(v){setStoredHash(v);setPhase("login")}else{setPhase("setup")}}catch(e){setPhase("setup")}
  },[]);

  const doShake=()=>{setShake(true);setTimeout(()=>setShake(false),500)};

  const handleNum=(n)=>{
    if(pin.length>=6)return;
    const next=pin+n;
    setPin(next);
    setError("");

    if(phase==="setup"&&next.length===4){
      setTimeout(()=>{setFirstPin(next);setPin("");setPhase("confirm")},200);
    }
    if(phase==="confirm"&&next.length===4){
      setTimeout(()=>{
        if(next===firstPin){
          const h=simpleHash(next);
          try{localStorage.setItem(STORAGE_KEYS.pin,h)}catch(e){}
          onUnlock();
        }else{
          setError("PINが一致しません");doShake();setPin("");setPhase("setup");setFirstPin("");
        }
      },200);
    }
    if(phase==="login"&&next.length===4){
      setTimeout(()=>{
        if(simpleHash(next)===storedHash){onUnlock()}
        else{setError("PINが違います");doShake();setPin("")}
      },200);
    }
  };

  const handleDel=()=>{setPin(p=>p.slice(0,-1));setError("")};

  if(phase==="loading")return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:C.textMuted}}>読み込み中...</span></div>;

  const titles={setup:"PINを設定してください",confirm:"もう一度入力してください",login:"PINを入力"};
  const subs={setup:"4桁の数字を入力",confirm:"確認のため再入力",login:""};

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Noto Sans JP',sans-serif",padding:20}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{marginBottom:40,textAlign:"center"}}>
        <div style={{fontSize:28,fontWeight:900,color:C.accent,letterSpacing:3,marginBottom:8}}>chigu</div>
        <div style={{fontSize:10,color:C.textMuted,letterSpacing:1}}>Photography Case Manager</div>
      </div>
      <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>{titles[phase]}</div>
      {subs[phase]&&<div style={{fontSize:11,color:C.textMuted,marginBottom:24}}>{subs[phase]}</div>}

      {/* PIN dots */}
      <div style={{display:"flex",gap:14,marginBottom:8,animation:shake?"shake 0.5s":"none"}}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${pin.length>i?C.accent:C.border}`,background:pin.length>i?C.accent:"transparent",transition:"all 0.15s"}}/>
        ))}
      </div>
      {error&&<div style={{fontSize:12,color:C.danger,marginBottom:8,fontWeight:500}}>{error}</div>}
      {!error&&<div style={{height:20,marginBottom:8}}/>}

      {/* Number pad */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,72px)",gap:12,marginTop:8}}>
        {[1,2,3,4,5,6,7,8,9,null,0,"del"].map((n,i)=>{
          if(n===null)return <div key={i}/>;
          const isDel=n==="del";
          return(
            <button key={i} onClick={()=>isDel?handleDel():handleNum(String(n))}
              style={{width:72,height:56,borderRadius:14,border:`1px solid ${C.border}`,background:C.surface,
                color:isDel?C.textDim:C.text,fontSize:isDel?14:22,fontWeight:isDel?500:600,
                cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",transition:"all 0.1s",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
              }}
              onMouseDown={e=>{e.currentTarget.style.background=C.surfaceAlt;e.currentTarget.style.transform="scale(0.95)"}}
              onMouseUp={e=>{e.currentTarget.style.background=C.surface;e.currentTarget.style.transform="scale(1)"}}
              onTouchStart={e=>{e.currentTarget.style.background=C.surfaceAlt;e.currentTarget.style.transform="scale(0.95)"}}
              onTouchEnd={e=>{e.currentTarget.style.background=C.surface;e.currentTarget.style.transform="scale(1)"}}
            >{isDel?"⌫":n}</button>
          );
        })}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

/* ── Main App ── */
const SAMPLE_CASES = [
  {id:"s1",title:"명동칼국수 ミョンドンカルグクス",genre:"food",status:"delivered",done:true,shootingDate:"2026-02-10",deadlines:["2026-02-24"],paymentDate:"2026-02-10",paymentAmount:"50000",content:"カルグクス・マンドゥ撮影",shopInfo:{nameJa:"명동칼국수",addressJa:"ソウル特別市 中区 明洞",url:""},createdAt:"2026-02-01T00:00:00.000Z"},
  {id:"s2",title:"종로삼겹살 チョンノサムギョプサル",genre:"food",status:"shot",done:false,shootingDate:"2026-02-22",deadlines:["2026-03-08"],paymentDate:"2026-02-22",paymentAmount:"50000",content:"サムギョプサル＋キムチチゲ撮影",shopInfo:{nameJa:"종로삼겹살",addressJa:"ソウル特別市 鍾路区",url:""},createdAt:"2026-02-12T00:00:00.000Z"},
  {id:"s3",title:"강남순두부 カンナムスンドゥブ",genre:"food",status:"shot",done:false,shootingDate:"2026-02-27",deadlines:["2026-03-10"],paymentDate:"2026-02-27",paymentAmount:"50000",content:"スンドゥブチゲ3種撮影",shopInfo:{nameJa:"강남순두부",addressJa:"ソウル特別市 江南区 駅三洞",url:""},createdAt:"2026-02-15T00:00:00.000Z"},
  {id:"s4",title:"홍대불고기 ホンデプルコギ",genre:"food",status:"acquired",done:false,shootingDate:"2026-03-03",deadlines:["2026-03-15"],paymentDate:"2026-03-03",paymentAmount:"50000",content:"プルコギ定食メニュー撮影",shopInfo:{nameJa:"홍대불고기",addressJa:"ソウル特別市 麻浦区 弘大",url:""},createdAt:"2026-02-20T00:00:00.000Z"},
  {id:"s5",title:"이태원치킨 イテウォンチキン",genre:"food",status:"acquired",done:false,shootingDate:"2026-03-07",deadlines:["2026-03-20"],paymentDate:"2026-03-07",paymentAmount:"50000",content:"ヤンニョムチキン＆ビール撮影",shopInfo:{nameJa:"이태원치킨",addressJa:"ソウル特別市 龍山区 梨泰院",url:""},createdAt:"2026-02-25T00:00:00.000Z"},
  {id:"s6",title:"성수감자탕 ソンスカムジャタン",genre:"food",status:"acquired",done:false,shootingDate:"2026-03-12",deadlines:["2026-03-25"],paymentDate:"2026-03-12",paymentAmount:"50000",content:"カムジャタン撮影",shopInfo:{nameJa:"성수감자탕",addressJa:"ソウル特別市 城東区 聖水洞",url:""},createdAt:"2026-02-28T00:00:00.000Z"},
  {id:"s7",title:"망원떡볶이 マンウォントッポッキ",genre:"food",status:"acquired",done:false,shootingDate:"",deadlines:["2026-03-30"],paymentDate:"",paymentAmount:"50000",content:"トッポッキ＆スンデ撮影（撮影日未定）",shopInfo:{nameJa:"망원떡볶이",addressJa:"ソウル特別市 麻浦区 望遠洞",url:""},createdAt:"2026-03-01T00:00:00.000Z"},
  {id:"s8",title:"カロスキル美容クリニック",genre:"beauty",status:"shot",done:false,shootingDate:"2026-02-25",deadlines:["2026-03-05"],paymentDate:"2026-02-25",paymentAmount:"80000",content:"施術室＆待合室＋スタッフポートレート",shopInfo:{nameJa:"가로수길뷰티클리닉",addressJa:"ソウル特別市 江南区 新沙洞 カロスキル",url:""},createdAt:"2026-02-10T00:00:00.000Z"},
  {id:"s9",title:"下北沢 炭火焼肉まる",genre:"food",status:"shot",done:false,shootingDate:"2026-02-20",deadlines:["2026-03-03"],paymentDate:"2026-02-20",paymentAmount:"60000",content:"A5和牛コース撮影",shopInfo:{nameJa:"炭火焼肉まる",addressJa:"東京都世田谷区北沢2丁目",url:""},createdAt:"2026-02-08T00:00:00.000Z"},
  {id:"s10",title:"代官山 蕎麦処さとう",genre:"food",status:"delivered",done:true,shootingDate:"2026-02-05",deadlines:["2026-02-18"],paymentDate:"2026-02-05",paymentAmount:"55000",content:"せいろ蕎麦＋天ぷら盛り合わせ撮影",shopInfo:{nameJa:"蕎麦処さとう",addressJa:"東京都渋谷区代官山町",url:""},createdAt:"2026-01-25T00:00:00.000Z"},
];

const NAV=[{id:"today",label:"今日",emoji:"☀️"},{id:"timeline",label:"タイムライン",emoji:"📊"},{id:"list",label:"一覧",emoji:"☰"},{id:"invoice",label:"請求書",emoji:"📄"},{id:"stats",label:"統計",emoji:"📈"}];

function AppMain(){
  const [cases,setCases]=useState([]);
  const [settings,setSettings]=useState(defaultSettings);
  const [tab,setTab]=useState("today");
  const [calMode,setCalMode]=useState("gantt");
  const [curMonth,setCurMonth]=useState(new Date());
  const [showNew,setShowNew]=useState(false);
  const [editCase,setEditCase]=useState(null);
  const [detailCase,setDetailCase]=useState(null);
  const [showSettings,setShowSettings]=useState(false);
  const [dayModal,setDayModal]=useState(null);
  const [sender,setSender]=useState(defaultSender);
  const [showSenderSettings,setShowSenderSettings]=useState(false);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{let loaded_cases=null;try{const v=localStorage.getItem(STORAGE_KEYS.cases);if(v)loaded_cases=JSON.parse(v)}catch(e){}if(loaded_cases&&loaded_cases.length>0){setCases(loaded_cases)}else{setCases(SAMPLE_CASES)}try{const v=localStorage.getItem(STORAGE_KEYS.settings);if(v)setSettings(JSON.parse(v))}catch(e){}try{const v=localStorage.getItem(STORAGE_KEYS.sender);if(v)setSender(JSON.parse(v))}catch(e){}setLoaded(true)},[]);
  useEffect(()=>{if(!loaded)return;try{localStorage.setItem(STORAGE_KEYS.cases,JSON.stringify(cases))}catch(e){}},[cases,loaded]);
  useEffect(()=>{if(!loaded)return;try{localStorage.setItem(STORAGE_KEYS.settings,JSON.stringify(settings))}catch(e){}},[settings,loaded]);
  useEffect(()=>{if(!loaded)return;try{localStorage.setItem(STORAGE_KEYS.sender,JSON.stringify(sender))}catch(e){}},[sender,loaded]);

  const saveNew=f=>{setCases(p=>[...p,{...f,shopInfo:f.shopInfo||{nameJa:"",addressJa:"",url:""},id:genId(),createdAt:new Date().toISOString(),done:false,status:f.status||"acquired"}]);setShowNew(false)};
  const saveEdit=f=>{setCases(p=>p.map(c=>c.id===editCase.id?{...c,...f}:c));setEditCase(null);setDetailCase(null)};
  const del=id=>{setCases(p=>p.filter(c=>c.id!==id));setDetailCase(null)};
  const chgStatus=(id,s)=>{const dn=s==="delivered";setCases(p=>p.map(c=>c.id===id?{...c,status:s,done:dn}:c));setDetailCase(prev=>prev?{...prev,status:s,done:dn}:null)};

  const getNDL=(c)=>{const now=new Date();now.setHours(0,0,0,0);const up=c.deadlines.filter(Boolean).map(d=>parseLocal(d)).filter(Boolean).sort((a,b)=>a-b);const n=up.find(d=>d>=now);return n||up[up.length-1]||parseLocal(c.shootingDate)||new Date()};
  const sorted=useMemo(()=>{const isDn=c=>c.done||(c.status||"acquired")==="delivered";const a=cases.filter(c=>!isDn(c)).sort((a,b)=>getNDL(a)-getNDL(b));const d=cases.filter(c=>isDn(c)).sort((a,b)=>(parseLocal(b.shootingDate)||0)-(parseLocal(a.shootingDate)||0));return[...a,...d]},[cases]);

  const BH=64;
  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Noto Sans JP',sans-serif",paddingBottom:BH+16}}>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
    <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
      <span style={{fontSize:18,fontWeight:900,color:C.accent,letterSpacing:2}}>chigu</span>
      <Btn small onClick={()=>setShowNew(true)} style={{borderRadius:20,padding:"8px 16px"}}>＋ 新規案件</Btn>
    </div>
    <div style={{padding:16,maxWidth:960,margin:"0 auto"}}>
      {tab==="today"&&<TodayView cases={cases} onCaseClick={c=>setDetailCase(c)}/>}
      {tab==="timeline"&&<div>
        <div style={{display:"flex",gap:4,marginBottom:12,background:C.surface,borderRadius:10,padding:4,border:`1px solid ${C.border}`,width:"fit-content"}}>
          {[{id:"gantt",label:"タイムライン"},{id:"month",label:"月間カレンダー"}].map(m=><button key={m.id} onClick={()=>setCalMode(m.id)} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",background:calMode===m.id?C.accent:"transparent",color:calMode===m.id?"#fff":C.textDim,fontSize:12,fontWeight:calMode===m.id?700:400,fontFamily:"'Noto Sans JP',sans-serif",transition:"all 0.2s"}}>{m.label}</button>)}
        </div>
        {calMode==="gantt"?<GanttView cases={cases} onCaseClick={c=>setDetailCase(c)}/>:<MonthCalendar cases={cases} currentMonth={curMonth} setCurrentMonth={setCurMonth} onDayClick={(d,ev)=>setDayModal({date:d,events:ev})}/>}
      </div>}
      {tab==="list"&&<div>{sorted.length===0?<div style={{textAlign:"center",padding:"60px 20px",color:C.textMuted}}><div style={{fontSize:40,marginBottom:12}}>◇</div><div style={{fontSize:14}}>まだ案件がありません</div><div style={{fontSize:12,marginTop:4}}>「＋ 新規案件」から登録してください</div></div>:<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {sorted.map(c=>{const g=GENRES.find(x=>x.id===c.genre)||GENRES[2];const st=getStatus(c);const dn=st.id==="delivered";return(
          <div key={c.id} onClick={()=>setDetailCase(c)} style={{background:C.surface,borderRadius:14,border:`1px solid ${C.border}`,padding:0,cursor:"pointer",transition:"all 0.2s",opacity:dn?0.45:1,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",overflow:"hidden",display:"flex"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderLight}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border}}>
            <div style={{width:5,flexShrink:0,background:st.color,borderRadius:"14px 0 0 14px"}}/>
            <div style={{flex:1,padding:"14px 16px",minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:dn?C.textMuted:C.text,textDecoration:dn?"line-through":"none",marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
                <Badge color={g.color} dimColor={g.dim}>{g.emoji} {g.label}</Badge>
                <Badge color={st.color} dimColor={st.dim}>{st.emoji} {st.label}</Badge>
                {c.shootingDate?<Badge color={C.shooting} dimColor={C.shootingDim}>📷 {fmtShortDate(c.shootingDate)}</Badge>:<Badge color={C.textMuted} dimColor={C.doneDim}>📷 未定</Badge>}
                {c.paymentAmount&&<Badge color={C.success} dimColor={C.successDim}>{fmtCurrency(c.paymentAmount)}</Badge>}
              </div>
              {!dn&&c.deadlines.filter(Boolean).length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{c.deadlines.filter(Boolean).sort().map((dl,i)=>{const d=daysUntil(dl);if(d===null)return null;return <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{fontSize:10,color:C.textDim}}>🎯 {fmtShortDate(dl)}</span><UrgencyBadge daysLeft={d}/></span>})}</div>}
            </div>
            <div style={{display:"flex",alignItems:"center",paddingRight:12}}><span style={{color:C.textMuted,fontSize:18}}>›</span></div>
          </div>)})}</div>}</div>}
      {tab==="stats"&&<MonthlyStats cases={cases} currentMonth={curMonth} setCurrentMonth={setCurMonth} settings={settings} onOpenSettings={()=>setShowSettings(true)} onOpenSenderSettings={()=>setShowSenderSettings(true)}/>}
      {tab==="invoice"&&<InvoicePage sender={sender} onOpenSenderSettings={()=>setShowSenderSettings(true)}/>}
    </div>
    {/* Bottom Nav */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,height:BH,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-around",alignItems:"center",zIndex:200,boxShadow:"0 -1px 6px rgba(0,0,0,0.06)",paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
      {NAV.map(n=>{const ac=tab===n.id;let badge=0;if(n.id==="today"){cases.filter(c=>(c.status||"acquired")!=="delivered"&&!c.done).forEach(c=>{const sd=parseLocal(c.shootingDate);if(sd){sd.setHours(0,0,0,0);const t=new Date();t.setHours(0,0,0,0);if(sd.getTime()===t.getTime()&&(c.status||"acquired")==="acquired")badge++}c.deadlines.filter(Boolean).forEach(d=>{const dl=daysUntil(d);if(dl!==null&&dl<=3)badge++})})}
      return <button key={n.id} onClick={()=>setTab(n.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:ac?C.accent:C.textMuted,transition:"color 0.15s",fontFamily:"'Noto Sans JP',sans-serif",padding:"6px 10px",position:"relative",flex:1}}>
        <span style={{fontSize:20}}>{n.emoji}</span>
        <span style={{fontSize:9,fontWeight:ac?700:400}}>{n.label}</span>
        {badge>0&&<div style={{position:"absolute",top:2,right:8,minWidth:16,height:16,borderRadius:8,background:C.danger,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{badge}</div>}
      </button>})}
    </div>
    <Modal open={showNew} onClose={()=>setShowNew(false)} title="新規案件登録"><CaseForm onSave={saveNew} onCancel={()=>setShowNew(false)}/></Modal>
    <Modal open={!!editCase} onClose={()=>setEditCase(null)} title="案件編集">{editCase&&<CaseForm initial={editCase} onSave={saveEdit} onCancel={()=>setEditCase(null)}/>}</Modal>
    <Modal open={!!detailCase&&!editCase} onClose={()=>setDetailCase(null)} title={detailCase?.title}>{detailCase&&<CaseDetail c={detailCase} onEdit={()=>setEditCase(detailCase)} onDelete={()=>del(detailCase.id)} onStatusChange={s=>chgStatus(detailCase.id,s)}/>}</Modal>
    <SenderSettingsModal open={showSenderSettings} onClose={()=>setShowSenderSettings(false)} sender={sender} onSave={setSender}/>
    <SettingsModal open={showSettings} onClose={()=>setShowSettings(false)} settings={settings} onSave={setSettings}/>
    <DayEventsModal open={!!dayModal} onClose={()=>setDayModal(null)} date={dayModal?.date} events={dayModal?.events}/>
  </div>;
}
export default function App(){
  const [unlocked,setUnlocked]=useState(false);
  if(!unlocked) return <LockScreen onUnlock={()=>setUnlocked(true)}/>;
  return <AppMain/>;
}
