"use strict";
const catalogFactsCache=new WeakMap();
const catalogSortLabels={
 speed:"속도 높은 순",accel:"가속 높은 순",handling:"도로 핸들링 높은 순",accessRank:"진입 조건 간단한 순",fee:"등록비 낮은 순",
 power:"위력 높은 순",accuracy:"명중 높은 순",range:"사거리 긴 순",capacity:"탄창 큰 순",price:"구매가 낮은 순",difficulty:"접근 난이도 낮은 순"
};
const catalogAcquisitionNotes={
 "v-35":["납품 보상","지정 차량 일곱 대 납품"],
 "v-53":["활동 보상","교량 아래 비행 보상으로 보고"],
 "v-54":["활동 보상","나이프 플라이트 보상으로 보고"],
 "v-55":["임무 보상","챕터 4 촬영 의뢰 후 연락 확인"],
 "v-56":["판본 특전","얼티밋 에디션 특전"],
 "v-58":["판본 특전","얼티밋 에디션 특전"],
 "v-62":["수집 보상","아홀 거리 미술 연작 수집"],
 "v-81":["활동 보상","스턴트 점프 보상으로 보고"],
 "v-94":["임무 보상","킬텔리전스 프로비전스 의뢰"],
 "v-57":["시한 주의","챕터 3 레이스 연속 의뢰"],
 "v-59":["수집 보상","벽화 다섯 곳 촬영"],
 "p02-w-012":["임무 보상","챕터 3 금고 개방 연습 완료"],
 "p02-w-034":["시한 주의","챕터 1 차량 처리 전 트렁크에서 회수"],
 "p02-w-116":["시한 주의","챕터 2 자금 마련 중 도착하는 의뢰 문자 확인"],
 "p02-x08":["판본 특전","얼티밋 에디션 특전"]
};
const catalogPicks={
 "v-01":"무광 픽업으로 험로를 달리고 적재 공간도 활용하고 싶을 때",
 "v-35":"납품 임무를 따라 무료 차량을 확보하고 싶을 때",
 "v-49":"갬빗 베이에서 무지개 도색 보트를 찾아보고 싶을 때",
 "p02-w-001":"보트로 난파선을 탐험하며 소음권총을 얻고 싶을 때",
 "p02-w-034":"챕터 1을 넘기기 전에 한정 회수 지점을 확인할 때",
 "p02-w-082":"포트 겔혼의 부두에서 소총을 찾아보고 싶을 때"
};
function catalogFacts(v){
 if(catalogFactsCache.has(v))return catalogFactsCache.get(v);
 const rows=new Map();
 for(const section of v.sections){
  if(section.reveal)continue;
  for(const row of section.table?.rows||[]){
   if(row.length>=2&&!rows.has(row[0]))rows.set(row[0],String(row.at(-1)));
  }
 }
 const value=(...keys)=>keys.map(key=>rows.get(key)).find(Boolean)||"";
 const number=t=>/^\d+(?:\.\d+)?$/.test(t)?Number(t):null;
 const money=t=>{
  if(/미확인|상충|다름|~|[–—]/.test(t))return null;
  const matches=[...t.matchAll(/\$([\d,]+)/g)];
  return matches.length===1?Number(matches[0][1].replaceAll(",","")):null;
 };
 const veh=v.category==="V";
 let kind=veh?value("종류","차급"):value("종류")||value("위치와 획득 조건").split("·")[0].trim();
 if(!veh&&!kind)kind=/^p02-e-/.test(v.id)?"장비":v.id==="p02-w-001"?"권총":/^p02-x0[567]$/.test(v.id)?"발사기":v.id==="p02-x08"?"리볼버":/^p02-x/.test(v.id)?"장비":"";
 kind=kind.replace(/^총기[·\s]*/,"").split(/\s*·\s*/)[0];
 const rawDifficulty=value("탐험 또는 접근 난이도");
 const scales={"낮음":1,"낮음~중간":2,"중간":3,"중간~높음":4,"높음":5,"매우 높음":6};
 const feeText=value("등록비","등록 비용과 추적 장치")||(/^v-0[12]$/.test(v.id)?v.sections.flatMap(s=>s.paragraphs||[]).find(x=>/등록비는 \$/.test(x))||"":"");
 const splitPair=(value("속도 / 가속")||"").split("/").map(x=>x.trim());
 const access=value("접근");
 const route=value("조건","획득 경로");
 const special=/얼티밋 특전|얼티밋 에디션/.test(route)?"판본 특전":route.includes("GTA+ 특전")?"구독 특전":"";
 const [condition,note]=catalogAcquisitionNotes[v.id]||[special||(!veh?value("획득 경로").split(" · ")[0]:""),""];
 const accessLabel=/키 복제기|절단 도구|Slim Jim/.test(access+" "+value("접근 시점"))?"전용 도구":
  /잠금|잠김|키패드/.test(access)?"잠금·키패드":access==="열림"?"문 열림":"";
 const accessRank={"문 열림":1,"잠금·키패드":2,"전용 도구":3}[accessLabel]??null;
 const facts={accessLabel,accessRank,kind:kind||(veh?"차종 미확인":"무기"),condition,note,
  speed:number(value("속도")||splitPair[0]),accel:number(value("가속")||splitPair[1]),
  handling:number(value("도로 핸들링")||value("도로 / 오프로드 핸들링").split("/")[0].trim()),
  fee:money(feeText),power:number(value("위력")),accuracy:number(value("명중")),range:number(value("사거리")),capacity:number(value("탄창")),price:money(value("게임 내 조사 가격")),
  difficulty:scales[rawDifficulty]??null,difficultyLabel:rawDifficulty,
  access:value("획득 경로","접근 시점","해금 조건","해금 또는 시한","해금과 시한","조건"),storage:value("보존·등록","등록·재호출"),
  security:value("보안"),tracking:value("추적")
 };
 catalogFactsCache.set(v,facts);
 return facts;
}
function catCompareList(all,cat,p){
 const selectedKind=p.get("kind"),access=p.get("access"),condition=p.get("obtain"),sort=p.get("order");
 if(selectedKind)all=all.filter(v=>catalogFacts(v).kind===selectedKind);
 if(access)all=all.filter(v=>catalogFacts(v).accessLabel===access);
 if(condition)all=all.filter(v=>condition==="pick"?Object.hasOwn(catalogPicks,v.id):catalogFacts(v).condition===condition);
 if(sort&&Object.hasOwn(catalogSortLabels,sort)){
  const ascending=["fee","price","difficulty","accessRank"].includes(sort);
  all=[...all].sort((a,b)=>{
   const left=catalogFacts(a)[sort],right=catalogFacts(b)[sort];
   if(left==null||right==null)return Number(left==null)-Number(right==null);
   return ascending?left-right:right-left;
  });
 }
 return all;
}
function catCompareControls(cat,p){
 const vs=categoryItems(cat).filter(catalogEntry);
 const kinds=[...new Set(vs.map(v=>catalogFacts(v).kind))].sort((a,b)=>a.localeCompare(b,"ko"));
 const conditions=[...new Set(vs.map(v=>catalogFacts(v).condition).filter(Boolean))];
 const sortKeys=cat==="V"?["speed","accel","handling","fee","accessRank"]:["power","accuracy","range","capacity","price","difficulty"];
 const choose=(name,key,options)=>'<label>'+name+' <select data-change="'+key+'">'+options.map(([v,t])=>opt(v,t,p.get(key)||"")).join("")+'</select></label>';
 return choose(cat==="V"?"차종":"장비 유형","kind",[["","전체"],...kinds.map(k=>[k,k])])+
  (cat==="V"?choose("차량 접근","access",[["","전체"],...["문 열림","잠금·키패드","전용 도구"].map(k=>[k,k])]):"")+
  choose("획득 조건","obtain",[["","전체"],...conditions.map(k=>[k,k]),["pick","편집자 추천"]])+
  choose("정렬","order",[["","기본 순서"],...sortKeys.map(k=>[k,catalogSortLabels[k]])])+
  choose("보기","layout",[["","외형 도감"],["compare","비교표"]]);
}
function catCompareView(vs,cat,p){
 if(!vs.length)return '<p class="empty">선택한 조건에 맞는 항목이 없습니다.</p>';
 const vehicle=cat==="V";
 const columns=vehicle?[["speed","속도"],["accel","가속"],["handling","핸들링"],["fee","등록비"],["accessLabel","차량 접근"]]:
  [["power","위력"],["accuracy","명중"],["range","사거리"],["capacity","탄창"],["price","구매가"],["difficultyLabel","난이도"]];
 function format(facts,key){
  const v=facts[key];
  if(v==null||v==="")return "—";
  return ["fee","price"].includes(key)?"$"+v.toLocaleString("ko-KR"):esc(v);
 }
 return '<div class="tablewrap catalog-compare" tabindex="0" role="region" aria-label="도감 비교표"><table><caption>대상별 게임 지표 · — 값 미확인</caption><thead><tr><th scope="col">이름 · 종류</th>'+columns.map(c=>'<th scope="col">'+c[1]+'</th>').join("")+'<th scope="col">획득 조건</th></tr></thead><tbody>'+
  vs.map(v=>{const f=catalogFacts(v);return '<tr><th scope="row"><a href="'+entry(v.id)+'">'+esc(v.title)+'</a><small>'+esc(f.kind)+'</small></th>'+columns.map(([k])=>'<td>'+format(f,k)+'</td>').join("")+'<td>'+esc(f.note||f.access||"—")+'</td></tr>'}).join("")+'</tbody></table></div>';
}
function catDetailFacts(v){
 if(!catalogEntry(v))return "";
 const f=catalogFacts(v),a=catalogAppearance(v,photo(v)),source=url(a.original);
 let image="";
 if(source&&!a.embedded)image='<figure class="catalog-detail-appearance"><a class="catalog-original" data-action="appearance" data-id="'+esc(v.id)+'" href="'+source+'" target="_blank" rel="noopener noreferrer"><img src="'+source+'" alt="'+esc(v.title)+' 외형" loading="lazy"></a><figcaption>외형 · '+link(a.original,"원본 사진")+'</figcaption></figure>';
 const rows=[["종류",f.kind],["획득 조건",f.note||f.access],["등록비",f.fee!=null?"$"+f.fee.toLocaleString("ko-KR"):""],["구매가",f.price!=null?"$"+f.price.toLocaleString("ko-KR"):""],["접근 난이도",f.difficultyLabel],["차량 접근",f.accessLabel],["보안",f.security],["추적 장치",f.tracking],["보관·재호출",f.storage],["편집자 추천",catalogPicks[v.id]]].filter(([,v])=>v);
 return image+(rows.length>1?'<dl class="catalog-facts">'+rows.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+esc(v)+'</dd></div>').join("")+'</dl>':"");
}
