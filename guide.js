"use strict";
const {items,media,pins,redirects={},regionAliases={},nameSources=[]}=window.FIELD_GUIDE;
const categories={
  P01:["챕터별 공략","CH","진행 전 확인할 수집품과 선택"],V:["고유 차량","GT","발견 위치와 차고 등록"],P02:["무기와 장비","EQ","획득 조건과 보관 방법"],
  P05:["비밀 탐험","EX","숨겨진 장소와 단계별 단서"],P06:["수집품","CO","컬렉션별 위치와 대체 사본"],P07:["부동산·은신처","HQ","위치와 이용 조건"],
  P03:["돈벌이·경제","EC","초기 자금과 반복 수입"],P04:["갱단 거점","OP","기본판 39곳과 얼티밋 에디션 특전 1곳의 위치·해금·보상"],P08:["전투·성장","SK","능력과 장비 운용"],
  P09:["서브미션·이벤트","EV","조우 조건과 시한"],P10:["숨은 메커니즘","ME","작동 조건과 판본 차이"]
};
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
const categoryItems=c=>readerItems.filter(v=>v.category===c);
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
function vehicleStylePicker(selected){
 return '<label>차량 스타일 <select data-change="style">'+opt("","전체 스타일",selected)+styleChoices.map(style=>opt(style,style,selected)).join("")+'</select></label>';
}

const atlasByItem=new Map();
for(const pin of pins){
 const key=cleanId(pin.item);
 if(!atlasByItem.has(key))atlasByItem.set(key,[]);
 atlasByItem.get(key).push(pin);
}
const variableBox=p=>p?.category==="P06"&&p.url.includes("feature=yellow-loot-box");
function pinTitle(p){
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
const norm=v=>String(v??"").normalize("NFKC").toLocaleLowerCase().replace(/[\s·'’.-]/g,"");
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
 if(Object.hasOwn(stored,"chapter"))localStorage.setItem(storageKey,JSON.stringify(state));
}catch{}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{document.querySelector("#feedback").textContent="이 브라우저에서는 기록을 저장할 수 없습니다."}}
const flags=v=>state.items[cleanId(v.id)]||{};
function route(){const [path,query=""]=location.hash.slice(1).split("?");let bits;try{bits=(path||"/").split("/").filter(Boolean).map(decodeURIComponent)}catch{bits=[]}return {page:bits[0]||"home",id:bits[1]||"",params:new URLSearchParams(query)}}
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
function mediaArt(v){
 const m=photo(v);
 if(m?.src&&!m.reveal)return '<div class="artbox"><img class="art" loading="lazy" src="'+esc(m.src)+'" alt="'+esc(m.caption||v.title)+'">'+(m.typeLabel?'<small>'+esc(m.typeLabel)+'</small>':'')+'</div>';
 if(!["P06","P07"].includes(v.category)||m?.reveal)return "";
 const p=pinLinks(v).find(pt=>!variableBox(pt));
 return p?'<div class="artbox">'+terrainThumb(p)+'<small>현장 지도</small></div>':"";
}
function statusText(v){
 const text=[v.status==="unconfirmed"?"획득 조건 미확인":"",Number.isInteger(v.chapter)?"관련 진행 · "+chapters[v.chapter]:""].filter(Boolean).join(" · ");
 return text?'<p class="statusnote">'+esc(text)+'</p>':"";
}
function cardPhotoLink(v){
 const m=photo(v);
 if(m?.reveal||m?.originalReveal)return "";
 return link(m?.originalPhoto,m?.originalLinkLabel||"현장 사진 원본")||link(v.fieldReferences?.photo,"현장 사진 원본");
}
function catalogAppearance(v,m){
 if(m?.reveal)return {};
 const labeled=m?.originalLinkLabel==="차량 외형 원본"||m?.originalLinkLabel==="공식 장비 사진 원본";
 const original=m?.originalReveal?undefined:labeled&&url(m.originalPhoto)?m.originalPhoto:appearanceSource(v)?.url;
 return {embedded:m?.kind==="appearance"?m.src:undefined,original};
}
function catalogFieldPhoto(v,m,appearance){
 if(m?.reveal)return "";
 if(m?.src&&m.kind!=="appearance")return '<button data-action="image" data-id="'+esc(v.id)+'">현장 사진</button>';
 if(m?.originalReveal)return "";
 const original=m?.originalPhoto!==appearance?link(m?.originalPhoto,"현장 사진"):"";
 return original||link(v.fieldReferences?.photo,"현장 사진");
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
function catalogCard(v){
 const m=photo(v),appearance=catalogAppearance(v,m),label=esc(v.title);
 const preview=appearance.embedded
  ?'<button data-action="image" data-id="'+esc(v.id)+'" aria-label="'+label+' 외형 사진 확대">'+catalogThumbnail(m,v)+'</button>'
  :link(appearance.original,"외형 원본")||'<span>외형 사진 없음</span>';
 const point=pinLinks(v).find(p=>!variableBox(p));
 const map=point?'<a href="'+esc(mapPinRoute(point))+'">지도</a>':link(v.fieldReferences?.map,"원본 지도");
 const photoLink=catalogFieldPhoto(v,m,appearance.original);
 const guide='<a href="'+entry(v.id)+'">공략</a>';
 return '<article class="card catalog-card"><div class="catalog-main"><div class="catalog-appearance">'+preview+'</div><div class="catalog-info cardbody"><span class="kicker">'+esc([catName(v.category),v.region].filter(Boolean).join(" · "))+'</span><h3><a href="'+entry(v.id)+'">'+label+'</a></h3><p>'+esc(v.summary)+'</p>'+statusText(v)+(flags(v).done?'<small class="label">✓ 완료</small>':'')+'</div></div><div class="catalog-actions">'+guide+map+photoLink+'</div></article>';
}
function card(v){
 if(catalogEntry(v))return catalogCard(v);
 const body=mediaArt(v)+'<div class="cardbody"><span class="kicker">'+esc([catName(v.category),v.region].filter(Boolean).join(" · "))+'</span><h3>'+esc(v.title)+'</h3><p>'+esc(v.summary)+'</p>'+statusText(v)+(flags(v).done?'<small class="label">✓ 완료</small>':'')+'</div>';
 const appearance=appearanceSource(v);
 const photoLink=cardPhotoLink(v);
 if(!appearance&&!photoLink)return '<a class="card" href="'+entry(v.id)+'">'+body+'</a>';
 return '<article class="card"><a class="card-guide" href="'+entry(v.id)+'">'+body+'</a><div class="card-photo">'+photoLink+(appearance?link(appearance.url,'외형 원본 보기'):"")+'</div></article>';
}
function cards(vs){return vs.length?'<div class="cards'+(vs.every(catalogEntry)?' catalog-grid':'')+'">'+vs.map(card).join("")+'</div>':'<p class="empty">조건에 맞는 공략이 없습니다.</p>'}
function chapterSelect(selected){return '<label>챕터 <select data-change="chapter">'+opt("","전체 챕터",selected)+chapters.map((c,i)=>opt(i,c,selected)).join("")+'</select></label>'}
function home(){
 const featured=["v-04","p02-w-001","P05-L03"].map(findItem).filter(Boolean);
 return '<section class="hero"><div class="scene" style="background-image:url(media/landmark-l36.webp)"></div><div class="herotext"><div class="eyebrow">Grand Theft Auto VI · Story Mode</div><h1>리오나이다 필드 가이드</h1><p>프롤로그부터 엔드게임까지. 챕터별 진행, 차량과 장비, 비밀 장소와 수집품.</p><a class="btn primary" href="'+group("P01")+'">챕터별 공략 보기 →</a></div><a class="photocredit" href="#/credits">오션 뷰 호텔 · GTADB</a></section>'+
 '<div class="quick">'+["V","P02","P05","P06"].map(c=>categoryButton(c)).join("")+'</div>'+
 '<section class="section"><div class="heading"><h2>탐험 수첩</h2><a href="#/map">지도에서 찾기 ↗</a></div>'+cards(featured)+'</section>'+
 '<section class="section"><div class="heading"><h2>공략 전체 보기</h2></div><div class="catgrid">'+Object.keys(categories).map(c=>categoryButton(c,true)).join("")+'</div></section>';
}
function guides(){
 const index=findItem("p01-guide-index");
 const browse=index?'<div class="guide-shortcut">'+relatedLink(index)+'</div>':"";
 return trail([["공략 도감"]])+'<h1>공략 도감</h1>'+browse+'<div class="section catgrid">'+Object.keys(categories).map(c=>categoryButton(c,true)).join("")+'</div>';
}
let limit=36;
const categoryPhotos={
 V:["official-grotti-cheetah.webp","1995 그로티 치타 · Rockstar Games"],
 P02:["official-weapon-variants.webp","무기 변형 · Rockstar Games"],
 P05:["official-swamp-airboat.webp","습지 탐험 · Rockstar Games"],
 P06:["official-keys-street.webp","리오나이다 키스 · Rockstar Games"],
 P07:["landmark-l307.webp","스타렛 모텔 · GTADB"]
};
function listHeading(cat,title,description){
 const a=categoryPhotos[cat];
 if(!a)return '<h1>'+esc(title)+'</h1><p class="lead">'+esc(description)+'</p>';
 return '<div class="category-banner"><div><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p></div><figure><img src="media/'+a[0]+'" alt="'+esc(a[1])+'"><figcaption>'+esc(a[1])+'</figcaption></figure></div>';
}
function listPage(page,id,p){
 const cat=id.toUpperCase(),mine=page==="mine",search=page==="search",q=(p.get("q")||"").trim(),filter=regionFilter(p.get("region")),flag=p.get("flag")||"favorite";
 const title=mine?"내 기록":search?"검색 결과":catName(cat);
 let all=mine?items.filter(v=>flags(v)[flag]):search?searchItems(q):categoryItems(cat);
 const catalog=page==="guide"&&["V","P02"].includes(cat);
 const guideEntries=catalog?all.filter(v=>!catalogEntry(v)):[];
 if(catalog)all=all.filter(catalogEntry);
 const scope=search&&Object.hasOwn(categories,p.get("cat"))?p.get("cat"):"";
 const searchCategories=search?[...new Set(all.map(v=>v.category).filter(c=>Object.hasOwn(categories,c)))]:[];
 if(scope){
  all=all.filter(v=>v.category===scope);
  if(!searchCategories.includes(scope))searchCategories.push(scope);
 }
 const regionChoices=[...new Set(all.map(v=>v.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko"));
 if(filter)all=all.filter(v=>v.region===filter);
 const vehicles=!mine&&!search&&cat==="V";
 const style=vehicles?(p.get("style")||""):"";
 if(style)all=all.filter(v=>vehicleStyles.get(cleanId(v.id))===style);
 const mediaFilter=p.get("media")||"";
 const visual=!mine&&!search&&["V","P02","P04","P05","P06","P07","P09"].includes(cat);
 if(visual&&mediaFilter){
  all=all.filter(v=>{
   const m=photo(v);
   const appearance=catalog?catalogAppearance(v,m):null;
   const embedded=appearance?appearance.embedded:m?.src&&!m.reveal;
   const linked=appearance?appearance.original:cardPhotoLink(v)||(!m?.reveal&&appearanceSource(v));
   if(mediaFilter==="embedded")return embedded;
   if(mediaFilter==="original")return linked;
   return mediaFilter!=="photo"||embedded||linked;
  });
 }
 const photoControl=visual?'<label>'+(catalog?"외형 사진":"사진")+' <select data-change="media">'+opt("","전체 항목",mediaFilter)+opt("embedded",catalog?"외형 미리보기":"도감에 사진이 있는 항목",mediaFilter)+opt("original",catalog?"외형 원본 링크":"원본 사진 링크가 있는 항목",mediaFilter)+opt("photo",catalog?"외형 사진 또는 링크":"사진 또는 원본 링크",mediaFilter)+'</select></label>':"";
 const reading={V:"v-registration",P02:"p02-collection-check",P01:"p01-save-slots",P06:"p06-collection-targets",P09:"p09-region-routes",P08:"p08-range-medals",P04:"p04-first-visit",P05:"p05-region-exploration",P07:"p07-first-garage"};
 const firstGuide=!mine&&!search?findItem(reading[cat]):null;
 const routeGuideIds={V:["v-42-collection-route","v-vehicle-index"],P01:["p01-roadmap"],P02:["p02-play-guide","p02-weapon-index","p02-field-pickup-route"],P03:["p03-economy-overview"],P04:["p04-catalog"],P07:["p07-property-catalog"],P08:["p08-training-start"],P09:["p09-start-here","p09-mission-index","p09-encounter-index","p09-chapter-deadlines","p09-world-activities"],P10:["p10-story-tools","p10-report-index"]}[cat]||[];
 const routeShortcut=!mine&&!search&&!catalog?routeGuideIds.map(findItem).filter(Boolean).map(v=>'<div class="guide-shortcut">'+relatedLink(v)+'</div>').join(""):"";
 const shortcut=firstGuide&&!catalog?'<div class="guide-shortcut"><a href="'+entry(firstGuide.id)+'">'+esc(firstGuide.title)+' →</a></div>':"";
 const guideMenu=catalog?'<details class="catalog-guides"><summary>'+(vehicles?"차량 등록·수집 공략":"무기·장비 획득 공략")+'</summary><div class="links">'+[...new Set([firstGuide?.id,...routeGuideIds,...guideEntries.map(v=>v.id)])].map(findItem).filter(Boolean).map(relatedLink).join("")+'</div></details>':"";
 if(!search&&!mine&&cat!=="P01"){
   const rank=v=>{
    const m=photo(v);
    const preview=m?.src&&!m.reveal&&(!catalog||m.kind==="appearance");
    return (v.status==="unconfirmed"?0:4)+(preview?(catalog?8:2):0);
   };
   all=[...all].sort((a,b)=>rank(b)-rank(a));
 }
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
 return trail([["공략 도감","#/guides"],[title]])+'<div class="eyebrow">'+(categories[cat]?.[1]||"FIELD GUIDE")+'</div>'+listHeading(cat,title,search?'“'+q+'”':categories[cat]?.[2]||"이 브라우저에 기록한 공략을 다시 열 수 있습니다.")+tabs+routeShortcut+shortcut+guideMenu+'<div class="bar">'+searchScope+(cat==="P01"?chapterSelect(chapter):"")+region+(vehicles?vehicleStylePicker(style):"")+photoControl+mapSearchLink+'<span class="count">'+all.length.toLocaleString()+(catalog?'개 항목':'개 공략')+'</span></div>'+cards(all.slice(0,limit))+(all.length>limit?'<button class="more" data-action="more">다음 공략 더 보기</button>':'')+backup;
}
const searchCache=new Map();
function searchItems(q){const terms=q.split(/\s+/).map(norm).filter(Boolean);if(!terms.length)return [];
 const hits=[];for(const v of readerItems){if(!searchCache.has(v.id))searchCache.set(v.id,[norm([v.title,...(v.aliases||[])].join("|")),norm([v.region,v.summary,catName(v.category),...(v.originalTerms||[]),...v.sections.filter(s=>!s.reveal).flatMap(s=>[s.title,...(s.paragraphs||[]),...(s.steps||[]),...(s.table?.rows||[]).flat()])].join("|"))]);
 const [title,body]=searchCache.get(v.id);if(terms.every(t=>title.includes(t)||body.includes(t)))hits.push([v,terms.filter(t=>title.includes(t)).length+(norm(v.title)===norm(q)?5:0)])}
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
   return '<div class="discovery-row"><a href="'+entry(v.id)+'"><small>'+esc(v.id.toUpperCase())+'</small><span>'+esc(title)+risk+'</span></a>'+actions+'</div>';
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
 const content=body+places+hints+(s.checklist?discoveryList(s):'')+(related?'<div class="links">'+relatedLink(related)+'</div>':'');
 return s.reveal?'<details class="panel" id="s'+index+'"><summary>'+esc(s.title)+' · 펼치기</summary>'+content+'</details>':'<section class="panel" id="s'+index+'"><h2>'+esc(s.title)+'</h2>'+content+'</section>';
}
function basePhotoFigure(v){const m=photo(v);if(!m?.src)return "";return '<figure><button data-action="image" data-id="'+esc(v.id)+'" aria-label="사진 확대"><img src="'+esc(m.src)+'" alt="'+esc(m.caption||v.title)+'"></button><figcaption class="caption">'+esc(m.caption||v.title)+' · '+link(m.source,m.credit||"원본")+(m.license?' · '+link(m.license,"이용 조건"):'')+'</figcaption></figure>'}
function photoFigure(v){
 const m=photo(v);
 const direct=m?.originalPhoto?'<div class="links">'+link(m.originalPhoto,(m.originalCaption||m.caption||v.title)+" · 원본 사진")+'</div>':"";
 const original=m?.originalReveal&&direct?'<details><summary>'+esc(m.originalReveal)+'</summary>'+direct+'</details>':direct;
 const html=basePhotoFigure(v)+original;
 const figure=m?.reveal?'<details class="panel"><summary>'+esc(m.reveal)+' 사진 보기</summary>'+html+'</details>':html;
 const appearance=appearanceSource(v);
 if(!appearance)return figure;
 return figure+'<div class="links">'+link(appearance.url,'외형 원본 보기')+'</div>';
}
function appearanceSource(v){
 if(v.category==="V")return (v.sources||[]).find(ref=>ref.label==="차량 외형 원본"&&url(ref.url));
 if(v.category!=="P02"||!/^p02-w-\d+$/.test(v.id))return null;
 return (v.sources||[]).find(ref=>(ref.label==="무기 외형 원본"&&url(ref.url))||/^https:\/\/static\.metaforge\.app\/gta-6\/progress\/weapons\/[\w-]+\.webp$/.test(ref.url));
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
function detail(v){if(!v)return missing();
 const f=flags(v),links=v.sources||[],sections=v.sections||[];
 const related=(v.related||[]).map(findItem).filter(Boolean);
 const actions=Object.entries({favorite:"즐겨찾기",later:"나중에",done:"완료"}).map(([k,t])=>'<button data-flag="'+k+'" data-id="'+esc(v.id)+'" aria-pressed="'+Boolean(f[k])+'">'+(f[k]?"✓ ":"")+t+'</button>').join("");
 const location=pinLinks(v).length?'<a href="#/map?item='+encodeURIComponent(v.id)+'">지도에서 위치 보기 ↗</a>':"";
 const outline=sections.map((s,i)=>'<a href="#s'+i+'" data-scroll="'+i+'">'+esc(s.title)+'</a>').join("")+location;
 const mobileOutline=outline?'<details class="guide-toc"><summary>공략 목차</summary>'+outline+'</details>':"";
 const desktopOutline=outline?'<div class="panel guide-toc-desktop"><h2>이 공략에서</h2>'+outline+'</div>':"";
 return trail([["공략 도감","#/guides"],[catName(v.category),group(v.category)]])+'<div class="spread"><article class="article"><div class="intro"><div class="kicker">'+esc([catName(v.category),v.region].filter(Boolean).join(" · "))+'</div><h1>'+esc(v.title)+'</h1><p class="lead">'+esc(v.summary)+'</p>'+statusText(v)+'<div class="tools">'+actions+'</div>'+mobileOutline+photoFigure(v)+'</div>'+fieldReferences(v)+entryMap(v)+sections.map(section).join("")+
 videoSection(links)+(links.length?'<section class="panel"><h2>지도·영상·참고 자료</h2><div class="links">'+links.map(sourceLink).join("")+'</div></section>':'')+'</article><aside class="rail">'+desktopOutline+(related.length?'<div class="panel"><h2>연관 공략</h2>'+related.slice(0,8).map(relatedLink).join("")+(related.length>8?'<details><summary>전체 '+related.length+'개 보기</summary>'+related.slice(8).map(relatedLink).join("")+'</details>':'')+'</div>':'')+'</aside></div>';
}
function missing(){return '<h1>공략을 찾을 수 없습니다</h1><p class="lead">이전 판의 주소이거나 통합된 항목일 수 있습니다.</p><a class="btn" href="#/guides">공략 도감 열기</a>'}
const inBounds=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-12288&&p.x<=6144&&p.y>=-10240&&p.y<=12288;
const mapped=pins.filter(inBounds);
const mappedIds=new Set(mapped.map(p=>cleanId(p.item)));
const externalMapItems=readerItems.filter(v=>v.fieldReferences?.map&&!mappedIds.has(cleanId(v.id)));
const mapCategories=[...new Set([...mapped,...externalMapItems].map(v=>v.category).filter(Boolean))];
function externalMapList(category,region,style,activity,terms,open){
 const matches=externalMapItems.filter(v=>{
  if(category&&v.category!==category)return false;
  if(region&&!norm(regionFilter(v.region)).includes(norm(region)))return false;
  if(style&&vehicleStyles.get(cleanId(v.id))!==style)return false;
  if(activity&&!cleanId(v.id).startsWith("p06-"+activity+"-"))return false;
  const search=norm([v.title,v.region,...(v.aliases||[]),...(v.originalTerms||[])].join(" "));
  return terms.every(term=>search.includes(term));
 });
 if(!matches.length)return "";
 return '<details class="panel map-references"'+(open?' open':'')+'><summary>원본 지도에서 볼 수 있는 공략 '+matches.length.toLocaleString()+'개</summary><ul>'+matches.map(v=>
  '<li><div>'+relatedLink(v)+(v.region?'<small>'+esc(v.region)+'</small>':'')+'</div><div class="map-reference-links">'+link(v.fieldReferences.map,"원본 지도")+link(v.fieldReferences.photo,"현장 사진")+'</div></li>'
 ).join("")+'</ul></details>';
}

let zoom=1,selected="",mapLimit=60;
const percent=p=>[(p.x+12288)/18432*100,(12288-p.y)/22528*100];
function mapSearchText(pin){
 const guide=findItem(pin.item);
 return norm([pinTitle(pin),pin.name,pin.originalName,pin.region,pin.originalRegion,guide?.title,...(guide?.aliases||[])].filter(Boolean).join(" "));
}
const activityTypes={ho:"농구 골대",dr:"드론 레이스",bs:"책 교환",rd:"읽을거리",fl:"플라밍고",md:"명상",c:"카드",sj:"스턴트 점프",br:"교량 아래 비행",kf:"나이프 플라이트",bj:"BASE 점프"};
function activityPicker(selected){
 return '<label>수집 활동 <select data-change="activity">'+opt("","전체 활동",selected)+Object.entries(activityTypes).map(([key,label])=>opt(key,label,selected)).join("")+'</select></label>';
}
function mapPage(p){
 const item=p.get("item"),region=regionFilter(p.get("region")),category=p.get("cat")||"",regions=[...new Set(mapped.map(v=>v.region).filter(Boolean))].sort();
 const activity=category==="P06"?(p.get("activity")||""):"";
 const style=category==="V"?(p.get("style")||""):"";
 const query=(p.get("q")||"").trim();
 const terms=query.split(/\s+/).filter(Boolean).map(norm);
 const list=mapped.filter(v=>(!region||v.region===region)&&(!category||v.category===category)&&(!activity||v.item.toLowerCase().startsWith("p06-"+activity+"-"))&&(!style||vehicleStyles.get(cleanId(v.item))===style)&&(!terms.length||terms.every(term=>mapSearchText(v).includes(term))));
 const references=externalMapList(category,region,style,activity,terms,!list.length);
 const search='<form id="map-search" class="bar" role="search" aria-label="지도에서 검색"><label>장소·수집품 <input name="q" placeholder="예: Vicki, 코튼마우스" value="'+esc(query)+'"></label><button>찾기</button>'+(query?'<button type="button" data-action="clear-map-search">검색 지우기</button>':'')+'</form>';
 const wanted=p.get("pin");
 const current=list.find(v=>v.id===selected)||list.find(v=>v.id===wanted&&v.item===item)||list.find(v=>item&&v.item===item&&!variableBox(v))||list.find(v=>item&&v.item===item);
 if(current)selected=current.id;
 const buckets=new Map(),cell=zoom>5?0:5/zoom;
 for(const v of list){const [x,y]=percent(v);const key=v===current||!cell?v.id:Math.floor(x/cell)+":"+Math.floor(y/cell);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(v)}
 const pinsHTML=[...buckets.values()].map(vs=>{
   const v=vs[0],[x,y]=percent(v),many=vs.length>1;
   return '<button class="pin '+(v===current?"active ":"")+(many?"cluster":"")+'" style="left:'+x+'%;top:'+y+'%" '+(many?'data-cluster':'data-pin')+'="'+esc(v.id)+'" aria-label="'+esc(many?"위치 "+vs.length+"개 확대":pinTitle(v))+'">'+(many?vs.length:"")+'</button>';
 }).join("");
 const controls='<div class="bar mapcontrols"><button data-action="zoomout" aria-label="지도 축소">−</button><button data-action="zoomin" aria-label="지도 확대">＋</button><span>'+Math.round(zoom*100)+'%</span><a class="textlink" href="#/credits">지도 출처</a></div>';
 return trail([["통합 지도"]])+'<div class="eyebrow">LEONIDA ATLAS</div><h1>통합 지도</h1>'+search+'<div class="bar"><label>지역 <select data-change="region">'+opt("","전체 지역",region)+regions.map(v=>opt(v,v,region)).join("")+'</select></label><label>분류 <select data-change="cat">'+opt("","전체",category)+mapCategories.map(c=>opt(c,catName(c),category)).join("")+'</select></label>'+(category==="P06"?activityPicker(activity):"")+(category==="V"?vehicleStylePicker(style):"")+'<span class="count">'+list.length.toLocaleString()+'개 핀</span></div>'+references+'<div class="maplayout"><div>'+controls+'<div class="mapview" tabindex="0" aria-label="리오나이다 지형도"><div class="mapcanvas" style="width:'+zoom*100+'%;aspect-ratio:2304/2816"><img src="media/leonida-map.webp" alt="리오나이다의 도로·수로·해안 지형">'+pinsHTML+'</div></div></div><aside class="panel"><h2>이 지도에서 찾기</h2>'+(current?'<div class="selectedpin"><b>'+esc(pinTitle(current))+'</b><p>'+esc(current.region)+'</p><div class="links">'+(findItem(current.item)?'<a href="'+entry(current.item)+'">상세 공략 →</a>':'')+link(current.url,current.url.includes("/photos/")?"진입 지점 원본 사진":"원본 위치")+'</div></div>':'<p class="sub">'+(list.length?"핀이나 목록에서 위치를 선택하세요.":"이 조건에 맞는 지도 핀이 없습니다.")+'</p>')+'<div class="pinlist">'+list.slice(0,mapLimit).map(v=>'<button data-pin="'+esc(v.id)+'">'+esc(pinTitle(v))+'<small>'+esc(v.region)+'</small></button>').join("")+(list.length>mapLimit?'<button data-action="mapmore">위치 더 보기</button>':'')+'</div></aside></div>';
}
document.addEventListener("submit",event=>{
 if(event.target.id!=="map-search")return;
 event.preventDefault();
 setParam("q",new FormData(event.target).get("q").trim());
});
function credits(){
 const names=nameSources.length?'<section class="panel"><h2>공식 한국어 명칭</h2><div class="links">'+nameSources.map(sourceLink).join("")+'</div></section>':"";
 return trail([["지도와 이미지 출처"]])+'<h1>지도와 이미지 출처</h1><section class="panel"><h2>리오나이다 지형도와 현장 사진</h2><p>GTA VI Map Tiles 및 현장 사진 · GTADB.ORG and contributors. 이 가이드에서는 타일을 합치고 사진 크기와 파일 형식을 조정했습니다. 원본의 좌표계를 사용합니다.</p><div class="links">'+link("https://map.gtadb.org","GTADB 지도")+link("https://github.com/rolux/gtadb.org","원본 자료")+link("https://creativecommons.org/licenses/by/4.0/","CC BY 4.0")+'</div></section><section class="panel"><h2>항목별 사진과 영상</h2><p>외형 사진, 현장 사진, 위치 지도를 구분해 표시합니다. Open GTA 6 Map의 CC BY 4.0은 기여자가 만든 지도 데이터에 적용됩니다. 게임 화면은 원본 사진 링크로 제공합니다. 공식 홍보 도판은 © Rockstar Games입니다. 재게시 허가를 확인하기 어려운 자료는 각 항목의 원본 링크에서 볼 수 있습니다. GTA VI와 게임 내 디자인은 Rockstar Games의 저작물입니다.</p><div class="links">'+link("https://github.com/fbritoferreira/gta6/blob/main/LICENSE","Open GTA 6 Map 이용 조건")+link("https://www.rockstargames.com/VI/media/screenshots","Rockstar Games 공식 갤러리")+link("https://creativecommons.org/licenses/by/4.0/","CC BY 4.0")+'</div></section>'+names;
}
function render(reset=false){
 const r=route();let title="리오나이다 필드 가이드",html;
 if(r.page==="home")html=home();else if(r.page==="guides")html=guides();else if(r.page==="entry"){const v=findItem(r.id);if(!v&&/^(p\d\d|v|index)-p\d{3}$/.test(r.id)){const part=r.id.split("-")[0];html=part==="index"?guides():listPage("guide",part,r.params)}else html=detail(v);title=v?.title||title}
 else if(["guide","mine","search"].includes(r.page))html=listPage(r.page,r.id,r.params);
 else if(r.page==="map")html=mapPage(r.params);else if(["credits","sources"].includes(r.page))html=credits();else html=missing();
 main.innerHTML=html+'<span id="feedback" role="status"></span>';document.title=title+" · GTA VI";
 document.querySelectorAll("nav a").forEach(a=>{const active=(r.page==="home"&&a.hash==="#/")||(["guide","entry","guides"].includes(r.page)&&a.hash==="#/guides")||a.hash==="#/"+r.page;if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
 if(r.page==="search")document.querySelector("#searchbox").value=r.params.get("q")||"";
 if(reset){window.scrollTo(0,0);main.focus({preventScroll:true})}
}
function centerPin(){const container=document.querySelector(".mapview"),pin=container?.querySelector(".active");if(pin){container.scrollLeft=pin.offsetLeft-container.clientWidth/2;container.scrollTop=pin.offsetTop-container.clientHeight/2}}
function routeChanged(){limit=36;mapLimit=60;selected="";zoom=route().params.has("item")?2:1;render(true);centerPin()}
window.addEventListener("hashchange",routeChanged);
document.querySelector(".skip").onclick=e=>{e.preventDefault();main.focus()};
document.querySelector("#searchform").addEventListener("submit",e=>{e.preventDefault();const q=document.querySelector("#searchbox").value.trim();if(q)location.hash="#/search?q="+encodeURIComponent(q)});
main.addEventListener("change",async e=>{const el=e.target;
 if(el.dataset.change){setParam(el.dataset.change,el.value);return}
 if(el.id==="restore"&&el.files[0]){try{const data=parseState(JSON.parse(await el.files[0].text()));state=data;save();render();document.querySelector("#feedback").textContent="기록을 가져왔습니다."}catch{document.querySelector("#feedback").textContent="지원하는 기록 JSON 파일을 선택하세요."}}});
const dialog=document.querySelector("#lightbox");dialog.querySelector("button").onclick=()=>dialog.close();
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
   return}
 if(el.dataset.cluster){selected=el.dataset.cluster;zoom=Math.min(8,zoom*2);render();centerPin();return}
 if(el.dataset.pin){selected=el.dataset.pin;const listScroll=document.querySelector(".pinlist").scrollTop;render();document.querySelector(".pinlist").scrollTop=listScroll;centerPin();return}
 const action=el.dataset.action;
 if(action==="clear-map-search"){setParam("q","");return}
 if(action==="more"){limit+=36;render()}else if(action==="mapmore"){mapLimit+=60;render();centerPin()}else if(action==="zoomin"||action==="zoomout"){
  const keepFocus=document.activeElement===el;
  const elMap=document.querySelector(".mapview");
  const centerX=(elMap.scrollLeft+elMap.clientWidth/2)/elMap.scrollWidth;
  const centerY=(elMap.scrollTop+elMap.clientHeight/2)/elMap.scrollHeight;
  zoom=Math.min(8,Math.max(1,zoom*(action==="zoomin"?1.5:1/1.5)));
  render();
  const next=document.querySelector(".mapview");
  next.scrollLeft=centerX*next.scrollWidth-next.clientWidth/2;
  next.scrollTop=centerY*next.scrollHeight-next.clientHeight/2;
  if(keepFocus)main.querySelector('[data-action="'+action+'"]').focus({preventScroll:true});
 }
 else if(action==="image"){const v=findItem(el.dataset.id),m=photo(v);dialog.querySelector("figure").innerHTML='<img src="'+esc(m.src)+'" alt="'+esc(m.caption||v.title)+'"><figcaption>'+esc(m.caption||v.title)+'</figcaption>';dialog.showModal()}
 else if(action==="export"){const file=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(file);a.download="leonida-progress.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}});
routeChanged();
