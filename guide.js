"use strict";
const {items,media,pins,mapRegions,redirects={},regionAliases={},nameSources=[]}=window.FIELD_GUIDE;
const categories=window.FIELD_GUIDE.categories;
const chapters=["프롤로그","챕터 1","챕터 2","챕터 3","챕터 4","챕터 5","엔드게임"];
const cleanId=s=>String(s??"").toLowerCase();
const byId=new Map(items.map(x=>[cleanId(x.id),x]));
const findItem=id=>byId.get(cleanId(id))||byId.get(cleanId(redirects[cleanId(id)]));
const main=document.querySelector("main");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const url=v=>{try{const u=new URL(v);return ["https:","http:"].includes(u.protocol)?esc(u.href):""}catch{return ""}};
const link=(src,label)=>url(src)?'<a target="_blank" rel="noopener noreferrer" href="'+url(src)+'">'+esc(label)+' ↗</a>':"";
const entry=id=>"#/entry/"+encodeURIComponent(id);
const regionFilter=value=>Object.hasOwn(regionAliases,value)?regionAliases[value]:(value||"");
const group=cat=>"#/guide/"+cat.toLowerCase();
const catName=cat=>categories[cat]?.[0]||"공략";
const readerItems=items.filter(v=>!(v.status==="reference"&&v.summary==="–"));
const categoryKeys=v=>[v.category,...(v.alsoCategories||[])];
const matchesCategory=(v,choices)=>categoryKeys(v).some(c=>choices.has(c));
const categoryItems=c=>readerItems.filter(v=>categoryKeys(v).includes(c));
const opt=(v,label,sel)=>'<option value="'+esc(v)+'"'+(String(v)===String(sel)?" selected":"")+'>'+esc(label)+'</option>';
const photo=v=>media[cleanId(v?.id)];
const vehicleStyles=new Map();
for(const vehicle of categoryItems("V")){
 for(const section of vehicle.sections){
  const row=section.table?.rows?.find(([key])=>key==="스타일");
  if(row){vehicleStyles.set(cleanId(vehicle.id),row[1]);break}
 }
}
const styleChoices=[...new Set(vehicleStyles.values())].sort((a,b)=>a.localeCompare(b,"ko"));
const mapStyleNames={
 "All-Terrain":"전지형","Blinged Up":"화려한 장식",Chopper:"초퍼","Clout Chaser":"인기 추구","Demolition Derby":"데몰리션 더비",
 Donks:"동크","DriveShaft Famous":"드라이브샤프트 유명차","Fine Art":"예술 작품",Girlypop:"걸리팝","Hot Rods":"핫로드",
 "Law & Order":"법과 질서","Leonida Man":"리오나이다 맨",Lowriders:"로라이더",Mudder:"머더",Patriot:"패트리엇",
 "Pedal Power":"페달 파워","Race Bikes":"레이스 바이크",Retro:"레트로","Ripped & Shredded":"립트 앤 슈레디드",
 "Stock Car":"스톡카","Street Racer":"스트리트 레이서","Swamp Style":"습지 스타일",Throwback:"복고풍",Topper:"토퍼","Ultra-Luxe":"초호화"
};
function vehicleStylePicker(selected){
 return '<label>차량 스타일 <select data-change="style">'+opt("","전체 스타일",selected)+styleChoices.map(style=>opt(style,mapStyleNames[style]||style,selected)).join("")+'</select></label>';
}

const atlasByItem=new Map();
for(const pin of pins){
 const key=cleanId(pin.item);
 if(!atlasByItem.has(key))atlasByItem.set(key,[]);
 atlasByItem.get(key).push(pin);
}
const variableBox=p=>p?.category==="P06"&&p.url.includes("feature=yellow-loot-box");
function pinTitle(p){
 if(p.mapTitle)return p.mapTitle;
 const guide=findItem(p.item);
 if(variableBox(p))return "가변 상자 · "+(guide?.title||p.name);
 if(guide&&p.id.includes("/standout-vehicle-")&&(guide.englishName||/[가-힣]/.test(guide.title)))return guide.title;
 return p.name;
}
const pinLinks=v=>atlasByItem.get(cleanId(v.id))||[];
function terrainThumb(p){
 const x=(p.x+12288)/8,y=(12288-p.y)/8;
 return '<svg class="terrain-thumb" role="img" aria-label="획득 지점 주변 지형" viewBox="'+(x-140)+' '+(y-80)+' 280 160" preserveAspectRatio="xMidYMid slice"><image href="media/leonida-map.webp" width="2304" height="2816"/><circle cx="'+x+'" cy="'+y+'" r="6" fill="#d64b29" stroke="white" stroke-width="2"/></svg>';
}
const norm=v=>String(v??"").normalize("NFKC").toLocaleLowerCase().replace(/스탈릿/g,"스타렛").replace(/라\s*페를/g,"라 펄").replace(/[\s·'’.-]/g,"");
const storageKey="leonida-guide-v1";
function parseState(raw){
  if (!raw||raw.version!==1||!raw.items||typeof raw.items!=="object"||Array.isArray(raw.items)) throw Error();
  const values=Object.create(null);
  for(const [id,flags] of Object.entries(raw.items)){
    if(!/^[a-z0-9-]{1,100}$/i.test(id)||!flags||typeof flags!=="object") continue;
    const key=cleanId(findItem(id)?.id||id);
    for(const flag of ["done","favorite","later","owned"]) if(flags[flag]===true)(values[key]??={})[flag]=true;
  }
  return {version:1,items:values};
}
let state={version:1,items:Object.create(null)};
try{
 const stored=JSON.parse(localStorage.getItem(storageKey));
 state=parseState(stored);
 const migrated=Object.keys(stored.items).some(id=>findItem(id)&&cleanId(findItem(id).id)!==id);
 if(migrated||Object.hasOwn(stored,"chapter"))localStorage.setItem(storageKey,JSON.stringify(state));
}catch{}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{document.querySelector("#feedback").textContent="이 브라우저에서는 기록을 저장할 수 없습니다."}}
window.addEventListener("storage",event=>{
 if(event.storageArea!==localStorage||(event.key!==storageKey&&event.key!==null))return;
 try{
  const latest=localStorage.getItem(storageKey);
  state=latest?parseState(JSON.parse(latest)):{version:1,items:Object.create(null)};
 }catch{return}
 if(route().page==="map"&&typeof refreshMap==="function")refreshMap();
 else render();
});
const flags=v=>state.items[cleanId(v.id)]||{};
function route(){
 const hash=location.hash.slice(1),split=hash.indexOf("?");
 const path=split<0?hash:hash.slice(0,split);
 const params=new URLSearchParams(split<0?"":hash.slice(split+1));
 let bits;
 try{bits=path.split("/").filter(Boolean).map(decodeURIComponent)}catch{bits=[]}
 const page=bits[0]||"home";
 let id=bits[1]||"",changed=false;
 if(page==="entry"){
  const item=findItem(id);
  if(item&&id!==item.id){id=item.id;changed=true}
 }else if(page==="map"){
  const old=params.get("item"),item=old&&findItem(old);
  if(item&&old!==item.id){params.set("item",item.id);changed=true}
  const pin=params.get("pin"),alias=window.FIELD_GUIDE.pinRedirects;
  if(pin&&alias&&Object.hasOwn(alias,pin)){params.set("pin",alias[pin]);changed=true}
 }
 if(changed){
  const newPath=page==="entry"?entry(id):"#/map";
  history.replaceState(history.state,"",newPath+(params.size?"?"+params:""));
 }
 return {page,id,params};
}
function setParam(k,v){
 const {page,params}=route();
 if(v)params.set(k,v);else params.delete(k);
 if(page==="search"&&k==="cat")params.delete("region");
 location.hash=location.hash.split("?")[0]+(params.size?"?"+params:"");
}
function trail(parts){return '<div class="trail"><a href="#/">홈</a>'+parts.map(([name,href])=>'<span>/</span>'+(href?'<a href="'+href+'">'+esc(name)+'</a>':esc(name))).join("")+'</div>'}
function categoryButton(c,full=false){const [name,code,description]=categories[c];return '<a href="'+group(c)+'"><span class="glyph" aria-hidden="true">'+code+'</span><span>'+name+(full?'<small>'+description+'</small>':'')+'</span></a>'}
function catalogEntry(v){
 return v.category==="V"?/^v-\d+$/.test(v.id):v.category==="P02"&&/^p02-(?:[we]-|x)\d+$/.test(v.id);
}
function contextPhoto(v,m){
 return Boolean(m?.contextOnly||(v.category==="P09"&&m?.src==="media/mission-landmark-l304.webp"));
}
function representativePhoto(v){
 if(!v)return null;
 const m=photo(v);
 if(catalogEntry(v)){
  const a=catalogAppearance(v,m);
  if(a.embedded)return m;
  return a.original?{src:a.original,caption:v.title+" 외형",typeLabel:"외형",source:a.original}:null;
 }
 return m?.src&&!m.reveal&&!contextPhoto(v,m)?m:null;
}
function mediaArt(v){
 const m=representativePhoto(v);
 return m?'<div class="artbox"><img class="art" loading="lazy" decoding="async" src="'+esc(m.src)+'" alt="'+esc(m.caption||v.title)+'"></div>':"";
}
function statusText(v){
 const text=[v.evidenceGroup||(v.status==="unconfirmed"?"획득 조건 미확인":""),Number.isInteger(v.chapter)?"관련 진행 · "+chapters[v.chapter]:""].filter(Boolean).join(" · ");
 return text?'<p class="statusnote">'+esc(text)+'</p>':"";
}
function cardPhotoLink(v){
 const m=photo(v);
 if(m?.reveal||m?.originalReveal)return "";
 return link(m?.originalPhoto,m?.originalLinkLabel||"현장 사진 원본")||link(v.fieldReferences?.photo,"현장 사진 원본");
}
const appearanceLabels=new Set(["차량 외형 원본","공식 장비 사진 원본"]);
function catalogAppearance(v,m){
 if(m?.reveal)return {};
 const labeled=appearanceLabels.has(m?.originalLinkLabel)?url(m.originalPhoto):"";
 const original=m?.originalReveal?undefined:appearanceSource(v)?.url||(labeled?m.originalPhoto:undefined);
 return {embedded:m?.kind==="appearance"?m.src:undefined,original};
}
function catalogThumbnail(m,v){
 const frame=m.previewFrame;
 const attrs=' loading="lazy" src="'+esc(m.src)+'" alt="'+esc(m.caption||v.title)+'"';
 if(!frame)return '<img'+attrs+'>';
 const [left,top,width,height]=frame;
 const ratio=width*m.width+"/"+(height*m.height);
 const positioning="width:"+10000/width+"%;height:"+10000/height+"%;left:"+(-100*left/width)+"%;top:"+(-100*top/height)+"%";
 return '<span class="catalog-frame" style="aspect-ratio:'+ratio+'"><img'+attrs+' style="'+positioning+'"></span>';
}
const readerFactCache=new WeakMap();
function readerFacts(v){
 if(readerFactCache.has(v))return readerFactCache.get(v);
 const fields=new Map(),rewards=[];
 for(const section of v.sections||[]){
  if(section.reveal||!section.table)continue;
  const {headers=[],rows=[]}=section.table;
  if(headers[0]==="보상")rewards.push(...rows.map(row=>row[0]));
  if(headers[0]==="항목"||headers[0]==="구분")for(const [key,value] of rows){
   if(!fields.has(key)&&typeof value==="string")fields.set(key,value);
  }
 }
 const get=(...keys)=>keys.map(k=>fields.get(k)).find(Boolean)||"";
 const risk=get("마감·보존","놓침 위험");
 const unsafe=/없음|낮음|개별 미확인|추가 확인|^미확인$/;
 const warning=risk&&!unsafe.test(risk)&&/시한|시간 제한|놓침|영구|진행 전|사라/.test(risk)?risk:"";
 const kind=catalogEntry(v)?catalogFacts(v).kind:get("유형","세력")||(v.category==="P09"?missionBrowseType(v):catName(v.category));
 const facts={kind,reward:[...new Set(rewards)].filter(Boolean).slice(0,2).join(" · "),
  condition:v.unlock||get("발생 조건","해금 조건","해금","획득 시점","진행 시점"),
  cost:get("기본가","구입 비용"),warning};
 readerFactCache.set(v,facts);
 return facts;
}
function cardBody(v){
 const {kind,reward,warning,condition}=readerFacts(v);
 const meta=[kind,v.region].filter(Boolean).join(" · ");
 const summary=v.summary&&v.summary!==v.title&&v.summary!==v.region&&v.summary!==meta&&v.summary!=="–"?v.summary:"";
 const note=v.evidenceGroup||(v.status==="unconfirmed"?"조건 미확인":"");
 const ch=Number.isInteger(v.chapter)?chapters[v.chapter]:"";
 const small=[reward&&!summary.includes(reward)?"보상 사례 · "+reward:"",(condition&&condition.length<=55&&!summary.includes(condition)?condition:ch),note].filter(Boolean);
 return '<div class="cardbody"><h3><a href="'+entry(v.id)+'">'+esc(v.title)+'</a></h3><span class="kicker">'+esc(meta)+'</span>'+
  (summary?'<p class="card-summary">'+esc(summary)+'</p>':'')+
  (small.length?'<div class="card-facts">'+esc(small.join(" · "))+'</div>':'')+
  (warning?'<div class="card-warning">'+esc(warning)+'</div>':'')+'</div>';
}
function cardActions(v){
 const point=pinLinks(v).find(p=>!variableBox(p))||pinLinks(v)[0];
 const map=point?'<a href="'+esc(mapPinRoute(point))+'" aria-label="'+esc(v.title+' 지도')+'">지도</a>':link(v.fieldReferences?.map,"원본 지도");
 return '<div class="guide-actions catalog-actions"><a href="'+entry(v.id)+'" aria-label="'+esc(v.title+' 상세 공략')+'">공략 보기 <span aria-hidden="true">→</span></a>'+map+checklistButton(v,v.title,"done","완료")+'</div>';
}
function catalogCard(v){
 const m=photo(v),appearance=catalogAppearance(v,m),label=esc(v.title),original=url(appearance.original);
 const preview=appearance.embedded
  ?'<button data-action="image" data-id="'+esc(v.id)+'" aria-label="'+label+' 외형 사진 확대">'+catalogThumbnail(m,v)+'</button>'
  :original?'<a class="catalog-original" href="'+original+'" target="_blank" rel="noopener noreferrer" data-action="appearance" data-id="'+esc(v.id)+'" aria-label="'+label+' 외형 사진 확대"><img loading="lazy" decoding="async" src="'+original+'" alt="'+label+' 외형"></a>':"";
 return '<article class="card catalog-card">'+(preview?'<div class="catalog-appearance">'+preview+'</div>':'')+cardBody(v)+cardActions(v)+'</article>';
}
function card(v){
 if(catalogEntry(v))return catalogCard(v);
 const art=mediaArt(v);
 return '<article class="card guide-card">'+(art?'<a class="card-art" href="'+entry(v.id)+'" aria-label="'+esc(v.title)+'">'+art+'</a>':'')+cardBody(v)+cardActions(v)+'</article>';
}
function cards(vs){return vs.length?'<div class="cards'+(vs.every(catalogEntry)?' catalog-grid':'')+'">'+vs.map(card).join("")+'</div>':'<p class="empty">조건에 맞는 공략이 없습니다.</p>'}
function chapterSelect(selected){return '<label>챕터 <select data-change="chapter">'+opt("","전체 챕터",selected)+chapters.map((c,i)=>opt(i,c,selected)).join("")+'</select></label>'}
function home(){return window.guideHomeMarkup}
function guides(){
 const index=findItem("p01-guide-index");
 const browse=index?'<div class="guide-shortcut">'+relatedLink(index)+'</div>':"";
 return trail([["공략 도감"]])+'<h1>공략 도감</h1>'+browse+'<div class="section catgrid">'+Object.keys(categories).map(c=>categoryButton(c,true)).join("")+'</div>';
}
let limit=36;
function listHeading(cat,title,description){
 return '<div class="list-heading"><h1>'+esc(title)+'</h1>'+(description?'<p class="lead">'+esc(description)+'</p>':'')+'</div>';
}
function missionBrowseType(v){
 if(/^p09-(?:re-|gp-|at$|je$|hu(?:-|$)|sw(?:-|$)|cv(?:-|$)|eg$|bg(?:-|$)|sp$|pl$|mm$)/.test(v.id))return "랜덤 조우";
 if(/^p09-ac-/.test(v.id))return "자유 활동";
 if(/^p09-(?:m-|[a-z]{2}(?:-guide)?$)/.test(v.id)||v.id.startsWith("p01-c"))return "미션·연속 의뢰";
 return "종합 안내";
}
function listPage(page,id,p){
 const cat=id.toUpperCase(),mine=page==="mine",search=page==="search",q=(p.get("q")||"").trim(),filter=regionFilter(p.get("region")),flag=p.get("flag")||"favorite";
 const story=cat==="P01"&&p.get("track")==="story";
 const title=mine?"내 기록":search?"검색 결과":story?"스토리 미션":catName(cat);
 let all=mine?items.filter(v=>flags(v)[flag]):search?searchItems(q):categoryItems(cat);
 if(story)all=all.filter(v=>v.track==="story");
 const track=cat==="P01"?'<label>종류 <select data-change="track">'+opt("","전체 공략",story?"story":"")+opt("story","스토리 미션",story?"story":"")+'</select></label>':"";
 const catalog=page==="guide"&&["V","P02"].includes(cat);
 const guideEntries=catalog?all.filter(v=>!catalogEntry(v)):[];
 if(catalog)all=all.filter(catalogEntry);
 const scope=search&&Object.hasOwn(categories,p.get("cat"))?p.get("cat"):"";
 const searchCategories=search?[...new Set(all.flatMap(categoryKeys).filter(c=>Object.hasOwn(categories,c)))]:[];
 if(scope){
  all=all.filter(v=>categoryKeys(v).includes(scope));
  if(!searchCategories.includes(scope))searchCategories.push(scope);
 }
 const missionType=cat==="P09"&&page==="guide"?p.get("mission")||"":"";
 const missionTypes=cat==="P09"&&page==="guide"?[...new Set(all.map(missionBrowseType))]:[];
 const missionPicker=missionTypes.length?'<label>활동 유형 <select data-change="mission">'+opt("","전체 활동",missionType)+missionTypes.map(t=>opt(t,t,missionType)).join("")+'</select></label>':"";
 if(missionTypes.includes(missionType))all=all.filter(v=>missionBrowseType(v)===missionType);
 const evidenceChoices=cat==="P05"?[...new Set(all.map(v=>v.evidenceGroup).filter(Boolean))]:[];
 const evidence=evidenceChoices.includes(p.get("evidence"))?p.get("evidence"):"";
 if(evidence)all=all.filter(v=>v.evidenceGroup===evidence);
 const evidencePicker=evidenceChoices.length?'<label>탐험 분류 <select data-change="evidence">'+opt("","전체 탐험",evidence)+evidenceChoices.map(label=>opt(label,label,evidence)).join("")+'</select></label>':"";
 const regionChoices=[...new Set(all.map(v=>v.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko"));
 if(filter)all=all.filter(v=>v.region===filter);
 const vehicles=!mine&&!search&&cat==="V";
 const style=vehicles?(p.get("style")||""):"";
 if(style)all=all.filter(v=>vehicleStyles.get(cleanId(v.id))===style);
 const mediaFilter=p.get("media")||"";
 const visual=!mine&&!search&&all.some(v=>representativePhoto(v)||cardPhotoLink(v));
 if(visual&&mediaFilter){
  all=all.filter(v=>{
   const m=photo(v);
   const appearance=catalog?catalogAppearance(v,m):null;
   const embedded=appearance?appearance.embedded:representativePhoto(v)?.src;
   const linked=appearance?appearance.original:cardPhotoLink(v)||(!m?.reveal&&appearanceSource(v));
   if(mediaFilter==="embedded")return embedded;
   if(mediaFilter==="original")return linked;
   return mediaFilter!=="photo"||embedded||linked;
  });
 }
 const photoControl=visual?'<label>'+(catalog?"외형 사진":"사진")+' <select data-change="media">'+opt("","전체 항목",mediaFilter)+opt("embedded",catalog?"사이트에 저장된 사진":"도감에 사진이 있는 항목",mediaFilter)+opt("original",catalog?"외부 원본 사진":"원본 사진 링크가 있는 항목",mediaFilter)+opt("photo",catalog?"사진이 있는 항목":"사진 또는 원본 링크",mediaFilter)+'</select></label>':"";
 const reading={V:"v-registration",P02:"p02-collection-check",P01:"p01-save-slots",P06:"p06-collection-targets",P09:"p09-region-routes",P08:"p08-range-medals",P04:"p04-first-visit",P05:"p05-region-exploration",P07:"p07-first-garage"};
 const firstGuide=!mine&&!search?findItem(reading[cat]):null;
 const routeGuideIds={V:["v-42-collection-route","v-vehicle-index"],P01:["p01-roadmap"],P02:["p02-play-guide","p02-weapon-index","p02-field-pickup-route"],P03:["p03-economy-overview"],P04:["p04-catalog"],P07:["p07-property-catalog"],P08:["p08-training-start"],P09:["p09-start-here","p09-mission-index","p09-encounter-index","p09-chapter-deadlines","p09-world-activities"],P10:["p10-story-tools","p10-report-index"]}[cat]||[];
 const readingGuides=!mine&&!search&&!catalog?[...new Set([firstGuide,...routeGuideIds.map(findItem)].filter(Boolean))]:[];
 const routeShortcut=readingGuides.length?'<details class="catalog-guides"><summary>'+esc(catName(cat))+' 길잡이</summary><div class="links">'+readingGuides.map(relatedLink).join("")+'</div></details>':"";
 const guideMenu=catalog?'<details class="catalog-guides"><summary>'+(vehicles?"차량 등록·수집 공략":"무기·장비 획득 공략")+'</summary><div class="links">'+[...new Set([firstGuide?.id,...routeGuideIds,...guideEntries.map(v=>v.id)])].map(findItem).filter(Boolean).map(relatedLink).join("")+'</div></details>':"";
 if(!search&&!mine&&cat!=="P01"){
   const rank=v=>{
    const m=photo(v);
    const preview=Boolean(representativePhoto(v));
    if(catalog){
     const appearance=catalogAppearance(v,m);
     return appearance.embedded?3:appearance.original?2:1;
    }
    const steps=v.sections?.some(s=>s.steps?.length>=2);
    const guide=cat==="P05"&&["현장 안내","조건부 접근"].includes(v.evidenceGroup);
    return (v.status==="unconfirmed"?0:12)+(guide?6:0)+(preview?4:0)+(steps?2:0);
   };
   all=[...all].sort((a,b)=>rank(b)-rank(a));
 }
 if(catalog)all=catCompareList(all,cat,p);
 const chapter=cat==="P01"&&/^[0-6]$/.test(p.get("chapter"))?p.get("chapter"):"";
 if(cat==="P01"){
  if(chapter!=="")all=all.filter(v=>v.chapter===Number(chapter));
  all=[...all].sort((a,b)=>(a.chapter??9)-(b.chapter??9));
 }
 const region=regionChoices.length>1?'<label>지역 <select data-change="region">'+opt("","전체 지역",filter)+regionChoices.map(r=>opt(r,r,filter)).join("")+'</select></label>':"";
 const searchScope=searchCategories.length?'<label>공략 분류 <select data-change="cat">'+opt("","전체 분류",scope)+Object.keys(categories).filter(c=>searchCategories.includes(c)).map(c=>opt(c,catName(c),scope)).join("")+'</select></label>':"";
 const mapQuery=new URLSearchParams({q});
 if(mapCategories.includes(scope))mapQuery.set("cat",scope);
 const mapSearchLink=search&&q?'<a class="btn" href="#/map?'+esc(mapQuery)+'">지도에서 검색 ↗</a>':"";
 const tabs=mine?'<div class="chips">'+Object.entries({favorite:"즐겨찾기",later:"나중에",done:"완료"}).map(([k,v])=>'<a '+(k===flag?'aria-current="page"':'')+' href="#/mine?flag='+k+'">'+v+'</a>').join("")+'</div>':"";
 const backup=mine?'<div class="bar"><button data-action="export">기록 내보내기</button><label class="btn">기록 가져오기 <input id="restore" type="file" accept=".json,application/json" hidden></label></div>':"";
 const comparison=catalog&&p.get("layout")==="compare";
 const mediaFilters=region+(vehicles?vehicleStylePicker(style):"")+photoControl;
 const browseControls=catalog?catCompareControls(cat,p,mediaFilters):region+evidencePicker+photoControl;
 const results=comparison?catCompareView(all.slice(0,limit),cat,p):cards(all.slice(0,limit));
 return trail([["공략 도감","#/guides"],[title]])+listHeading(cat,title,search?'“'+q+'”':story?"챕터별 시작 조건과 진행 순서, 놓치기 쉬운 보상":categories[cat]?.[2]||"이 브라우저에 기록한 공략을 다시 열 수 있습니다.")+tabs+routeShortcut+guideMenu+'<div class="bar browse-filters">'+track+missionPicker+searchScope+(cat==="P01"?chapterSelect(chapter):"")+browseControls+mapSearchLink+'<span class="count">'+all.length.toLocaleString()+(catalog?'개 항목':'개 공략')+'</span></div>'+results+(all.length>limit?'<button class="more" data-action="more">다음 공략 더 보기</button>':'')+backup;
}
const searchCache=new Map();
function searchRecord(v){
 if(!searchCache.has(v.id)){
  const variants=[v.title,...(v.aliases||[]),...pinLinks(v).map(pinTitle)];
  searchCache.set(v.id,{names:[...new Set(variants.map(norm).filter(Boolean))],title:norm(v.title),summary:norm([v.region,catName(v.category),v.summary].join("|"))});
 }
 return searchCache.get(v.id);
}
function searchItems(q,namesOnly=false){
 const terms=q.split(/\s+/).map(norm).filter(Boolean);
 if(!terms.length)return [];
 const exact=norm(q),hits=[];
 for(const v of readerItems){
  const row=searchRecord(v);
  const inName=terms.filter(t=>row.names.some(n=>n.includes(t))).length;
  const allNames=inName===terms.length;
  if(namesOnly&&!allNames)continue;
  if(!allNames){
   if(row.body===undefined){
    const sections=v.sections.filter(s=>!s.reveal);
    row.body=norm([...(v.originalTerms||[]),...sections.flatMap(s=>[s.title,...(s.paragraphs||[]),...(s.steps||[]),...(s.table?.rows||[]).flat()])].join("|"));
   }
   if(!terms.every(t=>row.names.some(n=>n.includes(t))||row.summary.includes(t)||row.body.includes(t)))continue;
  }
  const exactName=row.title===exact?1000:row.names.includes(exact)?900:0;
  const prefix=row.title.startsWith(exact)?75:0;
  const score=exactName+(allNames?250:0)+prefix+inName*20+terms.filter(t=>row.summary.includes(t)).length*2;
  hits.push([v,score]);
 }
 return hits.sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
}
function checklistButton(v,title,flag,label){
 const pressed=Boolean(flags(v)[flag]);
 return '<button data-flag="'+flag+'" data-id="'+esc(v.id)+'" data-label="'+esc(label)+'" aria-label="'+esc(title+' '+label)+'" aria-pressed="'+pressed+'">'+(pressed?'✓ ':'')+esc(label)+'</button>';
}
function discoveryList({checklist:ids,checklistUnit:unit="곳",checklistVerify:verify=false,checklistRisk:risks={}}){
 const places=ids.map(findItem).filter(Boolean);
 const finished=places.filter(v=>flags(v).done).length;
 const label=verify?"재로드 확인":"발견 완료";
 return '<div class="discovery-checklist"><p role="status">'+label+' <b data-count>'+finished+'</b> / '+places.length+esc(unit)+'</p>'+places.map(v=>{
   const title=v.title.split(" / ")[0];
   const done=checklistButton(v,title,"done",verify?"재로드":"완료");
   const actions=verify?'<div class="discovery-actions">'+checklistButton(v,title,"owned","첫 확인")+done+'</div>':done;
   const risk=risks[v.id]?'<small class="discovery-risk">주의 '+esc(risks[v.id])+'</small>':"";
   return '<div class="discovery-row"><a href="'+entry(v.id)+'"><span>'+esc(title)+risk+'</span></a>'+actions+'</div>';
 }).join("")+'</div>';
}
const pinById=new Map(pins.map(pin=>[pin.id,pin]));
const mapPinRoute=pin=>"#/map?item="+encodeURIComponent(pin.item)+"&pin="+encodeURIComponent(pin.id);
function regionMap(ids){
 if(!ids?.length)return "";
 const points=ids.map(id=>pinById.get(id)).filter(Boolean);
 if(!points.length)return "";
 const coords=points.map(p=>[(p.x+12288)/8,(12288-p.y)/8]);
 const xs=coords.map(c=>c[0]),ys=coords.map(c=>c[1]);
 const left=Math.min(...xs)-45,top=Math.min(...ys)-45;
 const width=Math.max(...xs)-left+45,height=Math.max(...ys)-top+45;
 const radius=Math.max(width,height)/35;
 const marks=points.map((point,i)=>{
  const [x,y]=coords[i],name=esc(findItem(point.item)?.title||point.name);
  return '<a href="'+esc(mapPinRoute(point))+'" aria-label="'+(i+1)+'. '+name+'"><circle cx="'+x+'" cy="'+y+'" r="'+radius+'" fill="#973b22" stroke="white" stroke-width="'+radius/6+'"/><text x="'+x+'" y="'+y+'" dy=".35em" text-anchor="middle" fill="white" font-size="'+radius*1.35+'">'+(i+1)+'</text></a>';
 }).join("");
 return '<svg class="region-map" role="group" aria-label="권역별 방문 지점" viewBox="'+[left,top,width,height].join(" ")+'"><image href="media/leonida-map.webp" width="2304" height="2816"/>'+marks+'</svg><ol class="route-places">'+points.map(p=>'<li>'+relatedLink(findItem(p.item))+' <a class="route-pin" href="'+esc(mapPinRoute(p))+'" aria-label="'+esc(pinTitle(p)+' 지도 핀 열기')+'">핀 ↗</a></li>').join("")+'</ol>';
}
function section(s,index){
 const t=s.table,tm=t?.rows?.length?'<div class="tablewrap" role="region" aria-label="'+esc(s.title)+'" tabindex="0"><table><thead><tr>'+(t.headers||[]).map(v=>'<th scope="col">'+esc(v)+'</th>').join("")+'</tr></thead><tbody>'+t.rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>':"";
 const body=(s.paragraphs||[]).map(v=>'<p>'+esc(v)+'</p>').join("")+((s.steps||[]).length?'<ol>'+s.steps.map(v=>'<li>'+esc(v)+'</li>').join("")+'</ol>':'')+tm;
 const related=s.relatedGuide&&findItem(s.relatedGuide);
 const stops=(s.places||[]).map(findItem).filter(Boolean);
 const places=s.mapPins?regionMap(s.mapPins):stops.length?'<div class="links">'+stops.map(relatedLink).join("")+'</div>':'';
 const hints=s.hints?'<ul class="field-hints">'+s.hints.map(findItem).filter(Boolean).map(v=>'<li>'+relatedLink(v)+'<p>'+esc(v.summary)+'</p></li>').join("")+'</ul>':'';
 const locationPin=pinById.get(s.locationPin);
 const site=locationPin?'<div class="links"><a href="'+esc(mapPinRoute(locationPin))+'">이 획득 지점 지도에서 보기 ↗</a></div>':"";
 const content=body+site+places+hints+(s.checklist?discoveryList(s):'')+(related?'<div class="links">'+relatedLink(related)+'</div>':'');
 return s.reveal?'<details class="panel" id="s'+index+'"><summary>'+esc(s.title)+' · 펼치기</summary>'+content+'</details>':'<section class="panel" id="s'+index+'"><h2>'+esc(s.title)+'</h2>'+content+'</section>';
}
function fieldFigure(v,m,index){
 if(!m?.src)return "";
 const caption=esc(m.caption||v.title);
 const credits=[link(m.source,m.credit||"사진 출처"),link(m.license,"이용 조건")].filter(Boolean);
 const fig='<figure class="field-figure"><button data-action="image" data-id="'+esc(v.id)+'" data-photo="'+index+'" aria-label="'+caption+' 확대"><img loading="lazy" decoding="async" src="'+esc(m.src)+'" alt="'+caption+'"></button><figcaption class="caption">'+(m.typeLabel?'<strong>'+esc(m.typeLabel)+'</strong> · ':'')+caption+(credits.length?' · '+credits.join(' · '):'')+'</figcaption></figure>';
 if(!m.reveal)return fig;
 return '<details class="protected-photo"><summary>'+esc(typeof m.reveal==="string"&&/[가-힣]/.test(m.reveal)?m.reveal:"스포일러가 있는 장면")+' 사진 보기</summary><template>'+fig+'</template></details>';
}
function photoFigure(v){
 const m=photo(v);
 const embedded=catalogEntry(v)?catDetailPhoto(v):"";
 return embedded||(m?.src&&!contextPhoto(v,m)?fieldFigure(v,m,-1):"");
}
function fieldGallery(v){
 const m=photo(v),appearance=catalogEntry(v)?catalogAppearance(v,m):null,hero=representativePhoto(v);
 const frames=[];
 if(m?.src&&(contextPhoto(v,m)||(appearance?.original&&!appearance.embedded&&m.src!==hero?.src)))frames.push(fieldFigure(v,m,-1));
 const seenImages=new Set([hero?.src,m?.src].filter(Boolean));
 const seenLinks=new Set([...seenImages,...(m?.src?[m.source]:[])].filter(Boolean));
 const originals=[];
 const addLink=(src,label,protectedImage)=>{
  if(!src||seenLinks.has(src))return;
  seenLinks.add(src);
  const anchor=link(src,label);
  if(anchor)originals.push(protectedImage?'<details><summary>현장 사진 자료 보기 · 스포일러</summary>'+anchor+'</details>':anchor);
 };
 const addLinks=(shot,figureShown)=>{
  if(!shot)return;
  const protectedImage=shot.originalReveal||shot.reveal;
  addLink(shot.originalPhoto,shot.originalCaption||shot.caption||shot.originalLinkLabel||"현장 사진 원본",protectedImage);
  if(figureShown)seenLinks.add(shot.source);
  else addLink(shot.source,(shot.caption||"현장 사진")+" · 출처",protectedImage);
 };
 addLinks(m,Boolean(m?.src));
 for(const [i,shot] of (v.gallery||[]).entries()){
  const distinctImage=Boolean(shot?.src&&!seenImages.has(shot.src));
  if(distinctImage){
   seenImages.add(shot.src);
   seenLinks.add(shot.src);
   frames.push(fieldFigure(v,shot,i));
  }
  addLinks(shot,distinctImage);
 }
 return frames.length||originals.length?'<section class="panel field-gallery"><h2>관련 사진</h2>'+frames.join("")+(originals.length?'<div class="links">'+originals.join("")+'</div>':'')+'</section>':"";
}
function appearanceSource(v){
 if(v.category==="V")return (v.sources||[]).find(ref=>ref.label==="차량 외형 원본"&&url(ref.url));
 if(v.category!=="P02"||!catalogEntry(v))return null;
 return (v.sources||[]).find(ref=>(["무기 외형 원본","장비 외형 원본"].includes(ref.label)&&url(ref.url))||/^https:\/\/static\.metaforge\.app\/gta-6\/progress\/weapons\/[\w-]+\.webp$/.test(ref.url));
}
function localMap(p){if(!p)return "";const x=(p.x+12288)/8,y=(12288-p.y)/8;
 return '<a class="inset" href="'+esc(mapPinRoute(p))+'"><svg role="img" aria-label="현장 주변의 지형과 위치" viewBox="'+(x-140)+' '+(y-80)+' 280 160"><image href="media/leonida-map.webp" width="2304" height="2816"/><circle cx="'+x+'" cy="'+y+'" r="7" fill="#e45a30" stroke="white" stroke-width="2"/></svg><span>통합 지도에서 확대 ↗</span></a>';
}
function entryMap(v){
 const points=pinLinks(v);
 if(!points.length){
  const approach=findItem(v.approachGuide);
  const gate=approach&&pinLinks(approach)[0];
  if(!gate)return "";
  return '<section class="panel"><h2>건물 진입 위치</h2><p>지도에는 모텔 입구가 표시됩니다. 실내에서는 아래의 방과 가구 설명을 따라가세요.</p>'+localMap(gate)+'</section>';
 }
 const first=points.find(p=>!variableBox(p))||points[0];
 const choices=points.length>1?'<div class="links">'+points.map(p=>'<a href="'+esc(mapPinRoute(p))+'">'+esc(pinTitle(p))+' ↗</a>').join("")+'</div>':"";
 const note=points.some(variableBox)?'<p>가변 상자는 내용물이 달라질 수 있습니다. 고정 카드 위치를 먼저 확인하세요.</p>':"";
 const body=localMap(first)+note+choices;
 return v.category==="P05"?'<details class="panel"><summary>정확한 위치와 주변 지도 펼치기</summary>'+body+'</details>':'<section class="panel"><h2>'+esc(v.mapTitle||"현장 위치")+'</h2>'+body+'</section>';
}
function videoSection(links){
 let video=null,seconds=0,label="";
 for(const ref of links){
  try{const u=new URL(ref.url),id=u.hostname==="youtu.be"?u.pathname.slice(1):["www.youtube.com","youtube.com","m.youtube.com"].includes(u.hostname)?u.searchParams.get("v"):null;
   if(!id||!/^[A-Za-z0-9_-]{11}$/.test(id))continue;
   const t=u.searchParams.get("t")||u.searchParams.get("start")||"0";
   const parts=t.match(/^(?:(\d+)h)?(?:(\d+)m)?(\d+)s?$/);
   seconds=parts?Number(parts[1]||0)*3600+Number(parts[2]||0)*60+Number(parts[3]):0;
   video=id;label=ref.label||"영상";break;
  }catch{}
 }
 if(!video)return "";
 return '<section class="panel"><h2>참고 영상</h2><button data-video="'+video+'" data-time="'+seconds+'">▶ '+esc(label)+' 재생</button></section>';
}
function sourceLink(ref){
 const href=url(ref.url);if(!href)return "";
 const domain=new URL(ref.url).hostname.replace(/^www\./,"");
 const names={"gtabase.com":"GTABase","metaforge.app":"MetaForge","gamesdb.gg":"GamesDB","gta6gps.com":"GTA 6 GPS","youtube.com":"YouTube","youtu.be":"YouTube"};
 const host=names[domain]||domain,label=ref.label||"출처";
 return link(ref.url,["원문 출처","지도 열기","이미지 출처"].includes(label)?label+" · "+host:label);
}
function relatedLink(r){return '<a href="'+entry(r.id)+'">'+esc(r.title)+'</a>'}
function fieldReferences(v){
 const refs=v.fieldReferences;
 if(!refs)return "";
 const buttons=[];
 if(refs.map)buttons.push(link(refs.map,"원본 위치 지도"));
 if(refs.candidate)buttons.push(link(refs.candidate,"시설 인근 후보 핀"));
 if(refs.areaMap)buttons.push(link(refs.areaMap,"해안선과 출항 권역 지도"));
 if(refs.photo)buttons.push(link(refs.photo,refs.caption+" · 원본 사진"));
 if(refs.printUrl)buttons.push(link(refs.printUrl,"공략집 열기 · "+refs.printPage+"쪽"));
 return '<details class="panel field-references"><summary>현장 지도'+(refs.photo||refs.printUrl?'와 사진':'')+' 보기</summary>'+
   (refs.note?'<p>'+esc(refs.note)+'</p>':'')+'<div class="links">'+buttons.join("")+'</div></details>';
}
function detail(v){
 if(!v)return missing();
 const f=flags(v),links=v.sources||[],sections=v.sections||[];
 const related=[...new Set((v.related||[]).map(findItem).filter(r=>r&&r!==v))];
 const originalTitle=v.aliases?.[v.sourceTitleIndex];
 const originalName=originalTitle?'<details class="original-name"><summary>영문 원명</summary><p lang="en">'+esc(originalTitle)+'</p></details>':"";
 const actions=Object.entries({favorite:"즐겨찾기",later:"나중에",done:"완료"}).map(([k,t])=>'<button data-flag="'+k+'" data-id="'+esc(v.id)+'" aria-pressed="'+Boolean(f[k])+'">'+(f[k]?"✓ ":"")+t+'</button>').join("");
 const where=pinLinks(v).length?'<a href="#/map?item='+encodeURIComponent(v.id)+'">지도에서 위치 보기 ↗</a>':"";
 const outline=sections.map((s,i)=>'<a href="#s'+i+'" data-scroll="'+i+'">'+esc(s.title)+'</a>').join("")+where;
 const mobileOutline=outline?'<details class="guide-toc"><summary>공략 목차</summary>'+outline+'</details>':"";
 const desktopOutline=outline?'<div class="panel guide-toc-desktop"><h2>이 공략에서</h2>'+outline+'</div>':"";
 const facts=readerFacts(v);
 const meta=[catName(v.category),v.region].filter(Boolean);
 const rows=[["해금·접근",facts.condition],["보상 사례",facts.reward],["기본가",facts.cost],["시한·주의",facts.warning]].filter(([,value])=>value);
 const brief=rows.length?'<dl class="entry-facts">'+rows.map(([k,value])=>'<div><dt>'+k+'</dt><dd>'+esc(value)+'</dd></div>').join("")+'</dl>':"";
 const summary=v.summary&&v.summary!==v.title&&v.summary!=="–"?'<p class="lead">'+esc(v.summary)+'</p>':"";
 const visual=photoFigure(v);
 const intro='<header class="intro"><div class="intro-content"><p class="kicker">'+esc(meta.join(" · "))+'</p><h1>'+esc(v.title)+'</h1>'+summary+statusText(v)+originalName+brief+'<div class="tools">'+actions+'</div></div>'+visual+'</header>';
 const sources=links.length?'<details class="panel reference-links"><summary>지도·영상·참고 자료 <small>'+links.length+'</small></summary><div class="links">'+links.map(sourceLink).join("")+'</div></details>':"";
 const relatedPanel=related.length?'<div class="panel"><h2>연관 공략</h2>'+related.slice(0,8).map(relatedLink).join("")+(related.length>8?'<details><summary>전체 '+related.length+'개 보기</summary>'+related.slice(8).map(relatedLink).join("")+'</details>':'')+'</div>':"";
 return trail([["공략 도감","#/guides"],[catName(v.category),group(v.category)]])+'<div class="spread"><article class="article">'+intro+mobileOutline+(catalogEntry(v)?catDetailFacts(v):"")+entryMap(v)+sections.map(section).join("")+fieldGallery(v)+fieldReferences(v)+videoSection(links)+sources+'</article><aside class="rail">'+desktopOutline+relatedPanel+'</aside></div>';
}
function missing(){return '<h1>공략을 찾을 수 없습니다</h1><p class="lead">이전 판의 주소이거나 통합된 항목일 수 있습니다.</p><a class="btn" href="#/guides">공략 도감 열기</a>'}
const inBounds=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-12288&&p.x<=6144&&p.y>=-10240&&p.y<=12288;
const mapped=pins.filter(inBounds);
const mapRegion=value=>{
 const region=regionFilter(value);
 return Object.hasOwn(mapRegions.names,region)?mapRegions.names[region]:region;
};
const mappedIds=new Set(mapped.map(p=>cleanId(p.item)));
const externalMapItems=readerItems.filter(v=>v.fieldReferences?.map&&!mappedIds.has(cleanId(v.id)));
const mapCategories=[...new Set([...mapped,...externalMapItems].flatMap(categoryKeys).filter(Boolean))];
const referenceName=v=>window.FIELD_GUIDE.mapReferenceNames?.[v.id]||v.title;
function externalMapList(cats,region,style,activity,terms,open,undone){
 const matches=externalMapItems.filter(v=>{
  if(cats.size&&!matchesCategory(v,cats)||undone&&flags(v).done)return false;
  if(region&&!norm(mapRegion(v.region)).includes(norm(region)))return false;
  if(style&&v.category==="V"&&vehicleStyles.get(cleanId(v.id))!==style)return false;
  if(!matchesActivity(v,v.id,cats,activity))return false;
  const search=norm([referenceName(v),v.title,mapRegion(v.region),v.region,catName(v.category),...(v.aliases||[]),...(v.originalTerms||[])].join(" "));
  return terms.every(term=>search.includes(term));
 });
 if(!matches.length)return "";
 return '<details class="panel map-references"'+(open?' open':'')+'><summary>원본 지도에서 볼 수 있는 공략 '+matches.length.toLocaleString()+'개</summary><ul>'+matches.map(v=>
  '<li><div><a href="'+entry(v.id)+'">'+esc(referenceName(v))+'</a><small>'+esc([catName(v.category),mapRegion(v.region)].filter(Boolean).join(" · "))+'</small></div><div class="map-reference-links">'+link(v.fieldReferences.map,"원본 지도")+link(v.fieldReferences.photo,"현장 사진")+'</div></li>'
 ).join("")+'</ul></details>';
}

let zoom=1,selected="",mapLimit=60;
const percent=p=>[(p.x+12288)/18432*100,(12288-p.y)/22528*100];
function mapSearchText(pin){
 const guide=findItem(pin.item);
 return norm([pinTitle(pin),pinFacts(pin).kind,pin.name,pin.originalName,mapRegion(pin.region),pin.region,pin.originalRegion,guide?.title,...(guide?.aliases||[])].filter(Boolean).join(" "));
}
const activityTypes={ho:"농구 골대",dr:"드론 레이스",bs:"책 교환",rd:"읽을거리",fl:"플라밍고",md:"명상",c:"카드",sj:"스턴트 점프",br:"교량 아래 비행",kf:"나이프 플라이트",bj:"베이스 점프"};
const collectKinds={...activityTypes,c:"수집 카드",uw:"수중 발견",wl:"랜드마크 스캔",wc:"진귀한 사물 스캔",ws:"조형물 스캔",mu:"벽화",ah03:"거리 미술",pl:"플레이리스트 포스터",st3:"수집 시계"};
const collectionCodeById=new Map();
for(const guide of categoryItems("P06")){
 if(guide.id.startsWith("p06-"))collectionCodeById.set(cleanId(guide.id),guide.id.split("-")[1]);
}
for(const [old,target] of Object.entries(redirects)){
 if(old.startsWith("p06-")&&!collectionCodeById.has(target))collectionCodeById.set(target,old.split("-")[1]);
}
function matchesActivity(record,itemId,cats,activity){
 return !activity||categoryKeys(record).some(c=>c!=="P06"&&cats.has(c))||
    collectionCodeById.get(cleanId(itemId))===activity;
}

const economyKinds={fx:"장물 매입처",go:"갱단 거점",gr:"차량 차고",gx:"갱단 거점",pn:"차량 수리·도색",rr:"레이스 코스",sa:"금고 후보",ta:"견인형 현금인출기",vr:"차량 인도 의뢰"};
const factCache=new Map();
function pinFacts(pin){
 if(factCache.has(pin.id))return factCache.get(pin.id);
 const guide=findItem(pin.item);
 const fields=new Map((guide?.sections||[]).filter(s=>!s.reveal).flatMap(s=>s.table?.rows||[]).filter(r=>r.length===2));
 const part=cleanId(pin.item).split("-")[1]||"";
 const kindByGroup={
  V:fields.get("종류")||"고유 차량",
  P02:fields.get("종류")||fields.get("위치와 획득 조건")?.split("·")[0].trim()||fields.get("장비"),
  P03:economyKinds[part.replace(/\d+$/,"")]||fields.get("분류"),
  P06:collectKinds[part],
  P07:part.startsWith("h")?"은신처":"차량 차고",
  P08:part==="gym"?"체육관":"사격장",
  P09:"랜덤 이벤트"
 };
 const kind=kindByGroup[pin.category]||catName(pin.category);
 const region=mapRegion(pin.region);
 let hint="";
 if(pin.category==="P06"){
  const location=guide?.sections.find(s=>s.locationPin===pin.id&&!s.reveal);
  if(variableBox(pin))hint=[location?.title,"상자 내용물이 달라질 수 있습니다."].filter(Boolean).join(" · ");
  else if(location)hint=location.steps?.[0]||location.title;
  else if(guide&&pinLinks(guide).length===1)hint=fields.get("위치 힌트")||fields.get("성공에 필요한 확인")||"";
 }
 else if(pin.category==="P09")hint=fields.get("유형")==="기타 조우"?"":fields.get("유형");
 // A shared guide can cover several sites. Only use its published summary for single-site guides.
 if(!hint&&guide&&pinLinks(guide).length===1){
  const sentence=(guide.summary||"").split(/(?<=[다요])\.\s+/)[0];
  const parts=sentence.split(/\s+·\s+/).map(t=>mapRegion(t.trim())).filter(t=>t&&t!==region&&t!==kind&&/[가-힣]/.test(t)&&!/[a-z]{2,}/i.test(t));
  hint=parts.join(" · ");
  if(hint&&/[다요]$/.test(hint))hint+=".";
 }
 if(hint===region||hint===kind)hint="";
 const facts={kind,region,hint:hint||""};
 factCache.set(pin.id,facts);
 return facts;
}
function pinPreviewText(pin){
 const {kind,region,hint}=pinFacts(pin);
 return [pinTitle(pin),[kind,region].filter(Boolean).join(" · "),hint].filter(Boolean).join("\n");
}
function pinContents(pin){
 const {kind,region,hint}=pinFacts(pin);
 return '<strong>'+esc(pinTitle(pin))+'</strong><small>'+esc([kind,region].filter(Boolean).join(" · "))+'</small>'+(hint?'<span class="pin-hint">'+esc(hint)+'</span>':"");
}
function pinGuideSummary(pin){
 const guide=findItem(pin.item),summary=guide?.summary;
 if(!summary||summary==="–"||summary===guide.title||summary===guide.region||summary===pinTitle(pin))return "";
 const hint=pinFacts(pin).hint;
 if(hint&&(summary.includes(hint)||hint.includes(summary)))return "";
 return '<p class="pin-guide-summary">'+esc(summary)+'</p>';
}
function pinCover(pin){
 const guide=findItem(pin.item),image=representativePhoto(guide);
 if(!image)return "";
 const caption=image.caption||guide.title;
 return '<a class="pin-cover card-art" href="'+entry(guide.id)+'" aria-label="'+esc(guide.title+" 상세 공략")+'"><img loading="lazy" decoding="async" src="'+esc(image.src)+'" alt="'+esc(caption)+'"><small>'+esc(image.typeLabel||"대표 사진")+' · '+esc(caption)+'</small></a>';
}
function activityPicker(selected){
 return '<label>수집 활동 <select data-change="activity">'+opt("","전체 활동",selected)+Object.entries(collectKinds).map(([key,label])=>opt(key,label,selected)).join("")+'</select></label>';
}
const mapIcons={
 V:"M2 10l2-5h9l2 5v4h-2v-2H4v2H2z M4 9h9",
 P02:"M2 5h12v4H8l-1 5H4l1-6H2z",
 P01:"M8 14V3m0 0c3-2 4 2 7 0v6c-3 2-4-2-7 0",
 P03:"M8 2v12m4-9c-4-3-9 0-7 3 2 2 6 0 7 3 0 3-5 3-8 1",
 P04:"M8 2l6 2v5c-1 3-3 5-6 6-3-1-5-3-6-6V4z",
 P05:"M2 12l6-10 6 10z M7 8h2m-1 2v1",
 P06:"M8 2l6 5-6 7-6-7z",
 P07:"M1 8l7-6 7 6m-12-1v7h10V7",
 P08:"M2 6v4m3-6v8m6-8v8m3-6v4M5 8h6",
 P09:"M2 3h12v8H8l-4 3v-3H2z"
};
const pinSymbol=cat=>'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="'+(mapIcons[cat]||mapIcons.P01)+'"/></svg>';
const mapRegionsList=[...new Set(mapped.map(pin=>mapRegion(pin.region)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko"));
const collectItemsByKind=new Map();
for(const guide of categoryItems("P06")){
 const kind=collectKinds[collectionCodeById.get(cleanId(guide.id))];
 if(!kind)continue;
 if(!collectItemsByKind.has(kind))collectItemsByKind.set(kind,new Set());
 collectItemsByKind.get(kind).add(cleanId(guide.id));
}
function mapProgress(){
 let done=0,total=0;
 const rows=[];
 for(const [kind,ids] of collectItemsByKind){
  const count=[...ids].filter(id=>state.items[id]?.done).length;
  total+=ids.size;done+=count;
  rows.push('<li><span>'+esc(kind)+'</span><progress value="'+count+'" max="'+ids.size+'"></progress><small>'+count+' / '+ids.size+'</small></li>');
 }
 return '<details class="map-progress"'+(mapProgressOpen?' open':'')+'><summary>수집 도감 진행률 <b>'+done+' / '+total+'</b></summary><ul>'+rows.join("")+'</ul></details>';
}
const pinDone=p=>Boolean(state.items[cleanId(p.item)]?.done);
let mapProgressOpen=false,mapFullscreen=false,nearAnchor=null,openCluster="",mapList=[],mapGroups=new Map();
function visibleMarkerGroups(list){
 const groups=new Map(),cell=zoom>5?.8/zoom:5/zoom;
 for(const pin of list){
  const [x,y]=percent(pin),key=Math.floor(x/cell)+":"+Math.floor(y/cell);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(pin);
 }
 return new Map([...groups.values()].map(group=>[group[0].id,group]));
}
function mapMarkers(list,current){
 mapGroups=visibleMarkerGroups(list);
 return [...mapGroups.values()].map(group=>{
  const pin=group.find(v=>v===current)||group[0],[x,y]=percent(pin),many=group.length>1;
  const uniform=group.every(v=>v.category===pin.category);
  const label=pin===current?pinPreviewText(pin):many?["위치 "+group.length+"개",...group.slice(0,3).map(pinTitle),group.length>3?"외 "+(group.length-3)+"개":"","위치 선택·확대해서 보기"].filter(Boolean).join("\n"):pinPreviewText(pin);
  const classes=["pin",many?"cluster":"",current===pin?"active":"",uniform?"pin-"+pin.category:"",group.every(pinDone)?"pin-done":""].join(" ");
  const cluster=many?' data-cluster="'+esc(group[0].id)+'"':"";
  const single=!many||pin===current?' data-pin="'+esc(pin.id)+'"':"";
  return '<button class="'+classes+'" style="left:'+x+'%;top:'+y+'%"'+cluster+single+' aria-label="'+esc(label)+'">'+(many?group.length:pinSymbol(pin.category))+'</button>';
 }).join("");
}
function clusterPicker(){
 const group=mapGroups.get(openCluster);
 if(!group||group.length<2)return "";
 return '<div class="spot-picker"><div class="heading"><b>이 지점의 위치 '+group.length+'개</b><button data-map-action="closecluster" aria-label="위치 목록 닫기">닫기</button></div><div class="spot-list">'+group.map(p=>'<button data-pin="'+esc(p.id)+'">'+pinSymbol(p.category)+esc(pinTitle(p))+'</button>').join("")+'</div>'+(zoom<8?'<button data-map-action="clusterzoom">이 지점 확대</button>':'')+'</div>';
}
function nearbyPanel(list){
 if(!nearAnchor)return "";
 const from=nearAnchor;
 const sqDistance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
 const candidates=list.filter(p=>!pinDone(p)&&p.item!==from.item&&(!from.region||mapRegion(p.region)===from.region)&&sqDistance(from,p)<=2400**2);
 const route=[];
 let last=from;
 while(route.length<6&&candidates.length){
  const next=candidates.reduce((best,p)=>sqDistance(last,p)<sqDistance(last,best)?p:best);
  route.push(next);last=next;
  for(let i=candidates.length-1;i>=0;i--)if(candidates[i].item===next.item)candidates.splice(i,1);
 }
 return '<section class="map-nearby"><div class="heading"><b>주변 미완료 방문 순서</b><button data-map-action="closenear">닫기</button></div><small>'+esc(from.name)+' 출발 · 직선거리 기준</small>'+(route.length?'<ol>'+route.map(p=>'<li><button data-pin="'+esc(p.id)+'">'+esc(pinTitle(p))+'<small>'+esc(pinFacts(p).kind)+'</small></button></li>').join("")+'</ol>':'<p>현재 분류와 지역에서 주변 미완료 지점이 없습니다.</p>')+'</section>';
}
function doneControl(current){
 const isDone=pinDone(current);
 const label=current.category==="P06"?"획득 완료":current.category==="P08"&&pinLinks(findItem(current.item)).length>1?"이 공략 전체 완료":"완료";
 return '<button data-map-action="done" data-item="'+esc(current.item)+'" aria-pressed="'+isDone+'">'+(isDone?'✓ ':'')+label+'</button>';
}
function mapPage(p){
 const item=p.get("item"),region=mapRegion(p.get("region"));
 const cats=new Set((p.get("cat")||"").split(",").filter(c=>mapCategories.includes(c)));
 const activity=cats.has("P06")?(p.get("activity")||""):"";
 const style=cats.has("V")?(p.get("style")||""):"";
 const undone=p.get("undone")==="1",query=(p.get("q")||"").trim();
 const terms=query.split(/\s+/).filter(Boolean).map(norm);
 mapList=mapped.filter(v=>(!region||mapRegion(v.region)===region)&&(!cats.size||matchesCategory(v,cats))&&(!undone||!pinDone(v))&&matchesActivity(v,v.item,cats,activity)&&(!style||v.category!=="V"||vehicleStyles.get(cleanId(v.item))===style)&&terms.every(term=>mapSearchText(v).includes(term)));
 const references=externalMapList(cats,region,style,activity,terms,!mapList.length,undone);
 const wanted=p.get("pin");
 const current=mapList.find(v=>v.id===selected)||mapList.find(v=>v.id===wanted&&v.item===item)||mapList.find(v=>item&&v.item===item&&!variableBox(v))||mapList.find(v=>item&&v.item===item);
 selected=current?.id||"";
 const pinsHTML=mapMarkers(mapList,current);
 const search='<form id="map-search" class="bar" role="search" aria-label="지도에서 검색"><label>장소·수집품 <input name="q" placeholder="예: 포트 겔혼, 코튼마우스" value="'+esc(query)+'"></label><button>찾기</button>'+(query?'<button type="button" data-action="clear-map-search">검색 지우기</button>':'')+'</form>';
 const pickers='<fieldset class="map-categories"><legend>지도 분류</legend><button type="button" data-map-cat="" aria-pressed="'+!cats.size+'">전체</button>'+mapCategories.map(c=>'<button type="button" data-map-cat="'+c+'" aria-pressed="'+cats.has(c)+'"><span class="pin-key pin-'+c+'">'+pinSymbol(c)+'</span>'+esc(catName(c))+'</button>').join("")+'</fieldset>';
 const filters='<div class="bar map-filters"><label>지역 <select data-change="region">'+opt("","전체 지역",region)+mapRegionsList.map(v=>opt(v,v,region)).join("")+'</select></label>'+(cats.has("P06")?activityPicker(activity):"")+(cats.has("V")?vehicleStylePicker(style,true):"")+'<label class="map-undone"><input type="checkbox" data-map-filter="undone" '+(undone?"checked":"")+'> 미완료 핀만 보기</label><span class="count">'+mapList.length.toLocaleString()+'개 핀</span></div>';
 const controls='<div class="bar mapcontrols"><button data-action="zoomout" aria-label="지도 축소">−</button><button data-action="zoomin" aria-label="지도 확대">＋</button><span>'+Math.round(zoom*100)+'%</span><button data-map-action="fullscreen" aria-pressed="'+mapFullscreen+'">'+(mapFullscreen?"전체 화면 닫기":"전체 화면")+'</button><button class="fullscreen-filters" data-map-action="filters">분류·필터</button><button data-map-action="near">지도 중앙 주변 찾기</button><a class="textlink" href="#/credits">지도 출처</a></div>';
 const viewport='<div class="map-window"><div class="mapview" tabindex="0" aria-label="리오나이다 지형도" aria-describedby="map-help"><div class="mapcanvas" style="width:'+zoom*100+'%;aspect-ratio:2304/2816"><img src="media/leonida-map.webp" draggable="false" alt="리오나이다의 도로·수로·해안 지형"><div class="map-tiles" aria-hidden="true"></div><svg class="map-boundary-overlay" aria-hidden="true" viewBox="-12288 -12288 18432 22528" preserveAspectRatio="none"><path fill-rule="evenodd" vector-effect="non-scaling-stroke"/></svg><div class="map-pins">'+pinsHTML+'</div></div></div><div class="map-region-tooltip" hidden></div>'+clusterPicker()+'</div>';
 const help='<p id="map-help" class="map-help">끌어서 이동하고 휠이나 두 손가락으로 확대하세요. 확인된 섬에 마우스를 올리거나 터치하면 해안선과 소속 카운티가 표시됩니다. <a data-region-source href="https://gtamap.io/?areas=outline#map" target="_blank" rel="noopener noreferrer">전체 구역 원본 지도 ↗</a></p>';
 const selectedPlace=current?'<div class="selectedpin">'+pinCover(current)+pinContents(current)+pinGuideSummary(current)+'<div class="links">'+doneControl(current)+'<button data-map-action="near-pin">이 핀 주변 찾기</button><a href="'+entry(current.item)+'">상세 공략 →</a>'+link(current.url,current.url.includes("/photos/")?"진입 지점 원본 사진":"원본 위치")+link(sourceDistrictAt(current.x,current.y),"이 위치의 구역 원본")+'</div></div>':'<p class="sub">'+(mapList.length?"핀이나 목록에서 위치를 선택하세요.":"이 조건에 맞는 지도 핀이 없습니다.")+'</p>';
 const list='<div class="pinlist">'+mapList.slice(0,mapLimit).map(v=>'<button data-pin="'+esc(v.id)+'"'+(v===current?' aria-current="location"':'')+'>'+(pinDone(v)?'<span class="done-tag">✓ 완료</span>':'')+pinContents(v)+'</button>').join("")+(mapList.length>mapLimit?'<button data-action="mapmore">위치 더 보기</button>':'')+'</div>';
 return trail([["통합 지도"]])+'<h1>통합 지도</h1><div class="map-inputs">'+search+pickers+filters+'<button class="fullscreen-filters" data-map-action="filters">지도 보기</button></div><div class="maplayout"><div>'+controls+viewport+help+'</div><aside class="panel"><h2>이 지도에서 찾기</h2>'+selectedPlace+nearbyPanel(mapList)+mapProgress()+list+'</aside></div>'+references;
}
const sourceDistrictAt=(x,y)=>"https://gtamap.io/?areas=outline&x="+Math.round(x)+"&y="+Math.round(y)+"&z=5#map";
// Each outline uses game-world coordinates from the same projected coastline as the map.
const shoreAreas=(mapRegions.boundaries?.features||[]).map(feature=>{
 const {geometry,properties}=feature;
 const shapes=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
 const parts=shapes.map(rings=>{
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];
  for(const [x,y] of rings[0]){
   bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);
   bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);
  }
  return {rings,bounds};
 });
 const path=shapes.flatMap(polygon=>polygon.map(ring=>
  "M"+ring.map(([x,y])=>x+","+(-y)).join("L")+"Z"
 )).join("");
 return {name:mapRegion(properties.name),county:mapRegion(properties.county)+" 카운티",parts,path};
});
function insideMapRing(x,y,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [ax,ay]=ring[j],[bx,by]=ring[i];
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
function shoreAreaAt(x,y){
 for(const area of shoreAreas){
  for(const {bounds:[left,bottom,right,top],rings} of area.parts){
   if(x<left||x>right||y<bottom||y>top)continue;
   if(insideMapRing(x,y,rings[0])&&!rings.slice(1).some(hole=>insideMapRing(x,y,hole)))return area;
  }
 }
 return null;
}
function setupMap(view){
 const canvas=view.querySelector(".mapcanvas");
 const layer=view.querySelector(".map-tiles");
 const tooltip=view.parentElement.querySelector(".map-region-tooltip");
 const overlay=view.querySelector(".map-boundary-overlay path");
 const districtSource=main.querySelector("[data-region-source]");
 const pinPreviews=new WeakMap();
 let shadedRegion=null;
 const highResolution={width:4608,height:5632,tile:1024};
 const loaded=new Set();
 let scheduled=false,drag=null,blockPinClick=false;
 function loadVisibleTiles(){
  if(zoom<=1||scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
   scheduled=false;
   if(!view.isConnected||!canvas.clientWidth)return;
   const {width,height,tile}=highResolution;
   const scale=width/canvas.clientWidth;
   const left=view.scrollLeft*scale,top=view.scrollTop*scale;
   const lastColumn=Math.min(Math.ceil(width/tile)-1,Math.floor((left+view.clientWidth*scale)/tile));
   const lastRow=Math.min(Math.ceil(height/tile)-1,Math.floor((top+view.clientHeight*scale)/tile));
   for(let row=Math.floor(top/tile);row<=lastRow;row++){
    for(let column=Math.floor(left/tile);column<=lastColumn;column++){
     const key=row+"-"+column;
     if(loaded.has(key))continue;
     const image=new Image();
     const x=column*tile,y=row*tile;
     image.alt="";
     image.draggable=false;
     image.decoding="async";
     image.style.cssText="left:"+x/width*100+"%;top:"+y/height*100+"%;width:"+Math.min(tile,width-x)/width*100+"%;height:"+Math.min(tile,height-y)/height*100+"%";
     image.src="media/leonida-detail-"+key+".webp";
     layer.append(image);
     loaded.add(key);
    }
   }
  });
 }
 function hidePreview(){
  if(shadedRegion){overlay.removeAttribute("d");shadedRegion=null}
  tooltip.hidden=true;
 }
 function showPreview(clientX,clientY,button){
  const bounds=canvas.getBoundingClientRect();
  const x=(clientX-bounds.left)/bounds.width*18432-12288;
  const y=12288-(clientY-bounds.top)/bounds.height*22528;
  const region=shoreAreaAt(x,y);
  if(region!==shadedRegion){
   if(region)overlay.setAttribute("d",region.path);
   else overlay.removeAttribute("d");
   shadedRegion=region;
  }
  let label=region?region.name+" · "+region.county:"";
  if(button){
   if(!pinPreviews.has(button)){
    const pin=pinById.get(button.dataset.pin);
    pinPreviews.set(button,pin?pinPreviewText(pin):button.getAttribute("aria-label"));
   }
   label=pinPreviews.get(button);
  }
  if(!label){hidePreview();return}
  if(tooltip.textContent!==label)tooltip.textContent=label;
  tooltip.hidden=false;
  const frame=view.parentElement.getBoundingClientRect();
  const left=Math.min(clientX-frame.left+14,frame.width-tooltip.offsetWidth-8);
  const top=Math.min(clientY-frame.top+14,frame.height-tooltip.offsetHeight-8);
  tooltip.style.left=Math.max(8,left)+"px";
  tooltip.style.top=Math.max(8,top)+"px";
 }
 function showRegion(event){
  showPreview(event.clientX,event.clientY,event.target.closest(".pin"));
 }
 function previewButton(event){
  const button=event.target.closest(".pin");
  if(!button||(event.type==="focusin"&&!button.matches(":focus-visible")))return;
  const rect=button.getBoundingClientRect();
  showPreview(rect.left+rect.width/2,rect.top+rect.height/2,button);
 }
 view.addEventListener("focusin",previewButton);
 view.addEventListener("pinpreview",previewButton);
 view.addEventListener("focusout",hidePreview);
 view.addEventListener("scroll",()=>{
  loadVisibleTiles();
  if(!view.contains(document.activeElement.closest(".pin")))hidePreview();
 },{passive:true});
 window.addEventListener("resize",()=>{
  if(view.isConnected)loadVisibleTiles();
 },{signal:mapViewEvents.signal});
 const touches=new Map();
 let pinch=null,markerTimer;
 function syncMarkers(){
  if(!view.isConnected)return;
  const current=pinById.get(selected);
  canvas.querySelector(".map-pins").innerHTML=mapMarkers(mapList,current);
  openCluster="";
  view.parentElement.querySelector(".spot-picker")?.remove();
 }
 function setScale(level,anchor,x,y,updateMarkers=true){
  zoom=Math.max(1,Math.min(8,level));
  canvas.style.width=zoom*100+"%";
  view.scrollLeft=anchor.x*canvas.clientWidth-x;
  view.scrollTop=anchor.y*canvas.clientHeight-y;
  main.querySelector(".mapcontrols span").textContent=Math.round(zoom*100)+"%";
  loadVisibleTiles();hidePreview();
  if(updateMarkers){
   clearTimeout(markerTimer);
   markerTimer=setTimeout(syncMarkers,80);
  }
 }
 function anchorAt(x,y){return {x:(view.scrollLeft+x)/canvas.clientWidth,y:(view.scrollTop+y)/canvas.clientHeight}}
 view.zoomAt=(level,x,y)=>setScale(level,anchorAt(x,y),x,y);
 function touchPair(){
  const [a,b]=touches.values(),rect=view.getBoundingClientRect();
  return {x:(a.x+b.x)/2-rect.left-view.clientLeft,y:(a.y+b.y)/2-rect.top-view.clientTop,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
 }
 view.addEventListener("pointerdown",event=>{
  if(event.button!==0)return;
  const {pointerId:id,clientX:x,clientY:y}=event;
  if(event.pointerType==="touch"){
   touches.set(id,{x,y});
   if(touches.size>=2){
    if(touches.size===2){
     const pair=touchPair();
     pinch={zoom,distance:pair.distance,anchor:anchorAt(pair.x,pair.y)};
     for(const pointer of touches.keys())view.setPointerCapture(pointer);
     drag=null;hidePreview();blockPinClick=true;view.classList.add("is-dragging");
    }
    return;
   }
  }else if(!event.isPrimary)return;
  blockPinClick=false;
  drag={id,x,y,left:view.scrollLeft,top:view.scrollTop,moved:false};
 });
 view.addEventListener("pointermove",event=>{
  if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pinch&&touches.size>=2){
   const pair=touchPair();
   setScale(pinch.zoom*pair.distance/pinch.distance,pinch.anchor,pair.x,pair.y,false);
   return;
  }
  if(drag?.id!==event.pointerId){
   if(event.pointerType==="mouse")showRegion(event);
   return;
  }
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<6)return;
  if(!drag.moved){
   drag.moved=true;view.setPointerCapture(event.pointerId);
   view.classList.add("is-dragging");hidePreview();
  }
  view.scrollLeft=drag.left-dx;view.scrollTop=drag.top-dy;
 });
 function finish(event){
  touches.delete(event.pointerId);
  if(pinch){
   if(touches.size>1)return;
   pinch=null;syncMarkers();blockPinClick=true;
   if(touches.size){
    const [id,point]=touches.entries().next().value;
    drag={id,...point,left:view.scrollLeft,top:view.scrollTop,moved:true};
   }else{drag=null;view.classList.remove("is-dragging")}
   return;
  }
  if(drag?.id!==event.pointerId)return;
  blockPinClick=drag.moved;
  if(!drag.moved&&event.type==="pointerup"){
   const bounds=canvas.getBoundingClientRect();
   districtSource.href=sourceDistrictAt((event.clientX-bounds.left)/bounds.width*18432-12288,12288-(event.clientY-bounds.top)/bounds.height*22528);
   districtSource.textContent="찍은 위치의 원본 구역 지도 ↗";
  }
  if(!drag.moved&&event.pointerType==="touch"&&event.type==="pointerup")showRegion(event);
  drag=null;view.classList.remove("is-dragging");
 }
 view.addEventListener("pointerup",finish);
 view.addEventListener("pointercancel",finish);
 view.addEventListener("lostpointercapture",event=>{
  if(event.target===view&&drag?.id===event.pointerId&&!pinch)finish(event);
 });
 view.addEventListener("pointerleave",event=>{
  if(event.pointerType==="mouse")hidePreview();
  if(event.pointerType==="mouse"&&drag&&!drag.moved)drag=null;
 });
 view.addEventListener("click",event=>{
  if(!blockPinClick||event.detail===0)return;
  event.preventDefault();event.stopPropagation();blockPinClick=false;
 },true);
 view.addEventListener("wheel",event=>{
  if(!event.deltaY)return;
  event.preventDefault();
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?view.clientHeight:1);
  const factor=Math.pow(1.5,-Math.max(-1,Math.min(1,delta/90)));
  const rect=view.getBoundingClientRect();
  view.zoomAt(zoom*factor,event.clientX-rect.left-view.clientLeft,event.clientY-rect.top-view.clientTop);
 },{passive:false});
 mapViewEvents.signal.addEventListener("abort",()=>clearTimeout(markerTimer),{once:true});
 loadVisibleTiles();
}
function changeMapZoom(level,x,y){main.querySelector(".mapview")?.zoomAt(level,x,y)}
function mapSnapshot(){
 const view=main.querySelector(".mapview");
 if(!view)return null;
 const c=view.querySelector(".mapcanvas");
 return {zoom,selected,x:(view.scrollLeft+view.clientWidth/2)/c.clientWidth,y:(view.scrollTop+view.clientHeight/2)/c.clientHeight,progress:!!main.querySelector(".map-progress")?.open,list:main.querySelector(".pinlist")?.scrollTop||0};
}
function positionMap(snapshot){
 if(!snapshot)return;
 const v=main.querySelector(".mapview"),c=v.querySelector(".mapcanvas");
 v.scrollLeft=snapshot.x*c.clientWidth-v.clientWidth/2;
 v.scrollTop=snapshot.y*c.clientHeight-v.clientHeight/2;
 main.querySelector(".pinlist").scrollTop=snapshot.list||0;
}
function refreshMap(){
 const snapshot=mapSnapshot();
 mapProgressOpen=snapshot?.progress||false;
 render();positionMap(snapshot);
}
function centerMapPoint(pin){
 const view=main.querySelector(".mapview");
 if(!pin||!view)return;
 const c=view.querySelector(".mapcanvas"),[x,y]=percent(pin);
 view.scrollLeft=x*c.clientWidth/100-view.clientWidth/2;
 view.scrollTop=y*c.clientHeight/100-view.clientHeight/2;
}
const mapMemoryKey="leonida-map-view-v2";
let previousMapHash="",lastMapHash="",savedMapViews={};
try{
 const stored=JSON.parse(sessionStorage.getItem(mapMemoryKey));
 if(stored){savedMapViews=stored.views||{};lastMapHash=stored.last||""}
}catch{}
function rememberMap(){
 const snapshot=mapSnapshot();
 if(!snapshot||!previousMapHash)return;
 delete savedMapViews[previousMapHash];
 savedMapViews[previousMapHash]=snapshot;
 if(Object.keys(savedMapViews).length>24)delete savedMapViews[Object.keys(savedMapViews)[0]];
 lastMapHash=previousMapHash;
 try{sessionStorage.setItem(mapMemoryKey,JSON.stringify({last:lastMapHash,views:savedMapViews}))}catch{}
}
window.addEventListener("pagehide",rememberMap);
document.querySelector('nav a[href="#/map"]').addEventListener("click",event=>{
 if(event.ctrlKey||event.metaKey||event.shiftKey||route().page==="map"||!lastMapHash.startsWith("#/map?"))return;
 event.preventDefault();location.hash=lastMapHash;
});
function openMapRoute(r){
 const focus=document.activeElement;
 const filter=focus?.closest(".map-inputs")&&focus.matches(":focus-visible")?["data-map-cat","data-map-filter","data-change","name"].find(a=>focus.hasAttribute(a)):null;
 const hash=location.hash,old=previousMapHash&&savedMapViews[previousMapHash];
 const saved=savedMapViews[hash];
 const previous=new URLSearchParams(previousMapHash.split("?")[1]);
 const targetChanged=r.params.get("item")!==previous.get("item")||r.params.get("pin")!==previous.get("pin");
 const snap=(!targetChanged&&old)||saved||null;
 previousMapHash=hash;
 selected=snap?.selected||"";zoom=snap?.zoom||(r.params.has("item")?2:1);
 mapProgressOpen=snap?.progress||false;
 mapLimit=60;openCluster="";nearAnchor=null;
 render(!old);
 if(snap)positionMap(snap);
 else if(selected)centerMapPoint(pinById.get(selected));
 else if(mapList.length===1)centerMapPoint(mapList[0]);
 if(filter)main.querySelector(".map-inputs ["+filter+'="'+CSS.escape(focus.getAttribute(filter))+'"]')?.focus({preventScroll:true});
}
function setMapFullscreen(active){
 mapFullscreen=active;
 document.body.classList.toggle("map-full",active);
 document.body.classList.remove("mapfilters-open");
 if(!active&&document.fullscreenElement===document.documentElement)document.exitFullscreen().catch(()=>{});

 const button=main.querySelector('[data-map-action="fullscreen"]');
 if(button){button.textContent=active?"전체 화면 닫기":"전체 화면";button.setAttribute("aria-pressed",String(active))}
}
document.addEventListener("fullscreenchange",()=>{
 if(!document.fullscreenElement&&mapFullscreen)setMapFullscreen(false);
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&mapFullscreen&&document.body.classList.contains("mapfilters-open")){
  document.body.classList.remove("mapfilters-open");
  main.querySelector(".mapcontrols .fullscreen-filters").focus();
  return;
 }
 if(event.key==="Escape"&&mapFullscreen){
  setMapFullscreen(false);main.querySelector('[data-map-action="fullscreen"]')?.focus({preventScroll:true});
 }
});
function mapAction(el){
 const action=el.dataset.mapAction;
 if(Object.hasOwn(el.dataset,"mapCat")){
  const c=el.dataset.mapCat, cats=new Set((route().params.get("cat")||"").split(",").filter(Boolean));
  if(!c)cats.clear();else if(cats.has(c))cats.delete(c);else cats.add(c);
  setParam("cat",[...cats].join(","));return true;
 }
 if(el.dataset.cluster){
  openCluster=el.dataset.cluster;refreshMap();
  main.querySelector(".spot-list button")?.focus({preventScroll:true});return true;
 }
 if(!action)return false;
 if(action==="done"){
  const id=cleanId(el.dataset.item),record=state.items[id]??={};
  record.done=!record.done;const keepFocus=el.matches(":focus-visible");save();refreshMap();
  if(keepFocus)(main.querySelector('[data-map-action="done"]')||main.querySelector(".map-undone input")).focus({preventScroll:true});
  main.querySelector("#feedback").textContent=record.done?"완료 기록을 저장했습니다.":"완료 기록을 해제했습니다.";
 }else if(action==="near"||action==="near-pin"){
  const pin=action==="near-pin"?pinById.get(selected):null,s=mapSnapshot();
  nearAnchor=pin?{x:pin.x,y:pin.y,item:pin.item,region:mapRegion(pin.region),name:pinTitle(pin)}:{x:s.x*18432-12288,y:12288-s.y*22528,region:mapRegion(route().params.get("region")),name:"지도 중앙"};
  refreshMap();main.querySelector(".map-nearby")?.scrollIntoView({block:"nearest"});
 }else if(action==="closenear"){nearAnchor=null;refreshMap()}
 else if(action==="closecluster"){openCluster="";refreshMap()}
 else if(action==="clusterzoom"){
  const pin=pinById.get(openCluster),view=main.querySelector(".mapview");
  if(pin){openCluster="";centerMapPoint(pin);changeMapZoom(Math.min(8,zoom*2),view.clientWidth/2,view.clientHeight/2)}
 }else if(action==="filters"){
  const open=document.body.classList.toggle("mapfilters-open");
  main.querySelector(open?".map-inputs input":".mapcontrols .fullscreen-filters")?.focus();
 }else if(action==="fullscreen"){
  const snapshot=mapSnapshot();setMapFullscreen(!mapFullscreen);positionMap(snapshot);
  if(mapFullscreen&&document.fullscreenEnabled)document.documentElement.requestFullscreen().catch(()=>{});

  main.querySelector('[data-map-action="fullscreen"]')?.focus({preventScroll:true});
 }
 return true;
}
let mapViewEvents;
document.addEventListener("submit",event=>{
 if(event.target.id!=="map-search")return;
 event.preventDefault();
 setParam("q",new FormData(event.target).get("q").trim());
});
function credits(){
 const names=nameSources.length?'<section class="panel"><h2>한국어 명칭</h2><p>공식 표기를 확인한 명칭은 아래 자료를 따릅니다. 그 밖의 고유명에는 한글 표기를 덧붙였으며, 영문 원명으로도 검색할 수 있습니다.</p><div class="links">'+nameSources.map(sourceLink).join("")+'</div></section>':"";
 return trail([["지도와 이미지 출처"]])+'<h1>지도와 이미지 출처</h1><section class="panel"><h2>리오나이다 지형도와 현장 사진</h2><p>GTA VI Map Tiles 및 현장 사진 · GTADB.ORG and contributors. 이 가이드에서는 타일을 합치고 사진 크기와 파일 형식을 조정했습니다. 원본의 좌표계를 사용합니다. 확대 시 원본 상세 타일을 표시합니다. 섬 음영은 이 지도의 해안선을 추적한 뒤 Open GTA 6 Map의 인쇄 지도 육지 윤곽과 교차 확인한 결과입니다. GTAMap.io를 참고해 소속 구역과 카운티를 확인했습니다. 내륙 행정 경계는 표시하지 않습니다.</p><div class="links">'+link("https://map.gtadb.org","GTADB 지도")+link("https://github.com/rolux/gtadb.org","원본 자료")+link("https://github.com/fbritoferreira/gta6","Open GTA 6 Map · fbritoferreira")+link("https://gtamap.io/?areas=outline#map","구역 대조 지도")+link("https://creativecommons.org/licenses/by/4.0/","CC BY 4.0")+'</div></section><section class="panel"><h2>항목별 사진과 영상</h2><p>외형 사진, 현장 사진, 위치 지도를 구분해 표시합니다. Open GTA 6 Map의 CC BY 4.0은 기여자가 만든 지도 데이터에 적용됩니다. 게임 화면은 원본 사진 링크로 제공합니다. 공식 홍보 도판은 © Rockstar Games입니다. 재게시 허가를 확인하기 어려운 자료는 각 항목의 원본 링크에서 볼 수 있습니다. GTA VI와 게임 내 디자인은 Rockstar Games의 저작물입니다.</p><div class="links">'+link("https://github.com/fbritoferreira/gta6/blob/main/LICENSE","Open GTA 6 Map 이용 조건")+link("https://www.rockstargames.com/VI/media/screenshots","Rockstar Games 공식 갤러리")+link("https://creativecommons.org/licenses/by/4.0/","CC BY 4.0")+'</div></section>'+names;
}
function render(reset=false){
 const r=route();let title="리오나이다 필드 가이드",html;
 if(r.page==="home")html=home();else if(r.page==="guides")html=guides();else if(r.page==="entry"){const v=findItem(r.id);if(!v&&/^(p\d\d|v|index)-p\d{3}$/.test(r.id)){const part=r.id.split("-")[0];html=part==="index"?guides():listPage("guide",part,r.params)}else html=detail(v);title=v?.title||title}
 else if(["guide","mine","search"].includes(r.page))html=listPage(r.page,r.id,r.params);
 else if(r.page==="map")html=mapPage(r.params);else if(["credits","sources"].includes(r.page))html=credits();else html=missing();
 main.innerHTML=html+'<span id="feedback" role="status"></span>';document.title=title+" · GTA VI";
 mapViewEvents?.abort();
 if(r.page==="map"){
  mapViewEvents=new AbortController();
  setupMap(main.querySelector(".mapview"));
 }
 document.querySelectorAll("nav a").forEach(a=>{const active=(r.page==="home"&&a.hash==="#/")||(["guide","entry","guides"].includes(r.page)&&a.hash==="#/guides")||a.hash==="#/"+r.page;if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
 if(r.page==="search")document.querySelector("#searchbox").value=r.params.get("q")||"";
 if(reset){window.scrollTo(0,0);main.focus({preventScroll:true})}
}
function routeChanged(){
 const r=route();
 rememberMap();
 limit=36;
 if(r.page==="map"){openMapRoute(r);return}
 previousMapHash="";setMapFullscreen(false);render(true);
}
window.addEventListener("hashchange",routeChanged);
document.querySelector(".skip").onclick=e=>{e.preventDefault();main.focus()};
document.querySelector("#searchform").addEventListener("submit",e=>{e.preventDefault();const q=document.querySelector("#searchbox").value.trim();if(q)location.hash="#/search?q="+encodeURIComponent(q)});
main.addEventListener("change",async e=>{const el=e.target;
 if(el.dataset.mapFilter==="undone"){setParam("undone",el.checked?"1":"");return}
 if(el.dataset.change){setParam(el.dataset.change,el.value);return}
 if(el.id==="restore"&&el.files[0]){try{const data=parseState(JSON.parse(await el.files[0].text()));state=data;save();render();document.querySelector("#feedback").textContent="기록을 가져왔습니다."}catch{document.querySelector("#feedback").textContent="지원하는 기록 JSON 파일을 선택하세요."}}});
const quickForm=document.querySelector("#searchform"),quickInput=document.querySelector("#searchbox");
const suggestions=document.createElement("div");
suggestions.className="quick-search-results";
suggestions.hidden=true;
suggestions.setAttribute("role","group");
suggestions.setAttribute("aria-label","바로 열 수 있는 공략");
quickForm.append(suggestions);
function showSuggestions(){
 const q=quickInput.value.trim();
 if(norm(q).length<2){suggestions.hidden=true;return}
 const matches=searchItems(q,true).slice(0,4);
 suggestions.innerHTML=matches.map(v=>'<a href="'+entry(v.id)+'"><strong>'+esc(v.title)+'</strong><small>'+esc(catName(v.category))+'</small></a>').join("")+'<a class="all-search" href="#/search?q='+encodeURIComponent(q)+'">전체 검색 결과 보기 →</a>';
 suggestions.hidden=false;
}
quickInput.addEventListener("input",e=>{if(!e.isComposing)showSuggestions()});
quickInput.addEventListener("compositionend",showSuggestions);
quickInput.addEventListener("focus",showSuggestions);
quickForm.addEventListener("keydown",event=>{
 if(event.isComposing||event.keyCode===229)return;
 if(event.key==="Escape"){
  event.preventDefault();quickInput.focus();suggestions.hidden=true;
 }else if(!suggestions.hidden&&["ArrowDown","ArrowUp"].includes(event.key)){
  event.preventDefault();
  const controls=[quickInput,...suggestions.querySelectorAll("a")];
  const step=event.key==="ArrowDown"?1:-1;
  controls[(controls.indexOf(document.activeElement)+step+controls.length)%controls.length].focus();
 }
});
quickForm.addEventListener("focusout",event=>{if(!quickForm.contains(event.relatedTarget))suggestions.hidden=true});
quickForm.addEventListener("submit",()=>{suggestions.hidden=true});
suggestions.addEventListener("click",()=>{suggestions.hidden=true});
const dialog=document.querySelector("#lightbox");dialog.querySelector("button").onclick=()=>dialog.close();
function showPhoto(src,caption,source=""){
 dialog.querySelector("figure").innerHTML='<img src="'+esc(src)+'" alt="'+esc(caption)+'"><figcaption>'+esc(caption)+source+'</figcaption>';
 dialog.showModal();
}
function photoSourcePage(v,imageUrl){
 const host=url=>new URL(url,location.href).hostname.replace(/^(?:www|static|cdn)\./,"");
 const refs=(v?.sources||[]).filter(r=>url(r.url)&&r.url!==imageUrl&&/원문 출처|위치·조건 근거|원문$/.test(r.label));
 const source=refs.find(r=>host(r.url)===host(imageUrl))||refs[0];
 return source?.url;
}
main.addEventListener("toggle",e=>{
 const panel=e.target;
 if(!panel.open||!panel.classList.contains("protected-photo"))return;
 const template=panel.querySelector("template");
 if(!template)return;
 const figure=document.importNode(template.content,true);
 const image=figure.querySelector("img");
 if(image)image.loading="eager";
 template.replaceWith(figure);
},true);
main.addEventListener("error",e=>{
 const image=e.target;
 if(image.localName!=="img")return;
 const figureButton=image.closest('.field-figure button[data-action="image"]');
 if(figureButton){
  const note=document.createElement("p");
  note.className="caption";note.textContent="현장 사진을 불러오지 못했습니다.";
  figureButton.replaceWith(note);return;
 }
 const cardArt=image.closest(".card-art");
 if(cardArt){cardArt.remove();return}
 const anchor=image.closest('a[data-action="appearance"]');
 if(!anchor)return;
 const fallback=photoSourcePage(findItem(anchor.dataset.id),image.src);
 if(fallback)anchor.href=fallback;
 anchor.textContent=fallback?"항목 출처 열기 ↗":"외형 원본 ↗";
 anchor.removeAttribute("data-action");
 anchor.removeAttribute("aria-label");
},true);
dialog.addEventListener("error",e=>{
 if(e.target.localName!=="img")return;
 const note=document.createElement("p");
 note.textContent="사진을 불러오지 못했습니다.";
 note.setAttribute("role","status");
 e.target.replaceWith(note);
},true);
main.addEventListener("click",e=>{const el=e.target.closest("button,a");if(!el)return;
 if(el.dataset.video){const frame=document.createElement("iframe");frame.title="공략 영상";frame.src="https://www.youtube-nocookie.com/embed/"+el.dataset.video+"?start="+Number(el.dataset.time)+"&autoplay=1";frame.allow="autoplay; encrypted-media; fullscreen";frame.allowFullscreen=true;frame.referrerPolicy="strict-origin-when-cross-origin";frame.className="video";el.replaceWith(frame);return}
 if(el.dataset.scroll!==undefined){
  e.preventDefault();
  const section=document.getElementById("s"+el.dataset.scroll);
  const heading=section?.querySelector("h2,summary");
  if(heading){
   if(heading.localName!=="summary")heading.tabIndex=-1;
   heading.focus({preventScroll:true});
  }
  section?.scrollIntoView();
  return;
 }
 if(el.dataset.flag){const key=cleanId(el.dataset.id),flag=el.dataset.flag;const current=state.items[key]??={};current[flag]=!current[flag];save();el.setAttribute("aria-pressed",String(current[flag]));el.textContent=(current[flag]?"✓ ":"")+(el.dataset.label||{done:"완료",favorite:"즐겨찾기",later:"나중에"}[flag]);
   const checklist=el.closest(".discovery-checklist");
   if(checklist)checklist.querySelector("[data-count]").textContent=checklist.querySelectorAll('button[data-flag="done"][aria-pressed="true"]').length;
   const currentPage=route();
   if(currentPage.page==="mine"&&(currentPage.params.get("flag")||"favorite")===flag&&!current[flag])render();
   return}
 if(mapAction(el))return;
 if(el.dataset.pin){
  const inMap=el.classList.contains("pin");
  selected=el.dataset.pin;openCluster="";refreshMap();centerMapPoint(pinById.get(selected));
  if(inMap){
   const active=main.querySelector(".mapview .active");
   active?.focus({preventScroll:true});
   active?.dispatchEvent(new Event("pinpreview",{bubbles:true}));
  }else if(e.detail===0)main.querySelector('.pinlist [aria-current="location"]')?.focus({preventScroll:true});
  return;
 }
 const action=el.dataset.action;
 if(action==="clear-map-search"){setParam("q","");return}
 if(action==="more"){limit+=36;render()}else if(action==="mapmore"){mapLimit+=60;refreshMap()}else if(action==="zoomin"||action==="zoomout"){
  const keepFocus=document.activeElement===el;
  const view=main.querySelector(".mapview");
  const next=Math.min(8,Math.max(1,zoom*(action==="zoomin"?1.5:1/1.5)));
  changeMapZoom(next,view.clientWidth/2,view.clientHeight/2);
  if(keepFocus)main.querySelector('[data-action="'+action+'"]').focus({preventScroll:true});
 }
 else if(action==="image"){const v=findItem(el.dataset.id),index=Number(el.dataset.photo),m=index>=0?v.gallery?.[index]:photo(v);if(m?.src)showPhoto(m.src,m.caption||v.title,m.source?" · "+link(m.source,"사진 출처"):"")}
 else if(action==="appearance"&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&el.querySelector("img")?.naturalWidth){
  e.preventDefault();
  const v=findItem(el.dataset.id);
  showPhoto(el.href,v.title+" 외형"," · "+link(el.href,"외형 원본"));
 }
 else if(action==="export"){const file=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(file);a.download="leonida-progress.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}});
if(route().page==="home"&&document.activeElement===quickInput){
 render();
 showSuggestions();
}else routeChanged();
