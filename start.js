"use strict";
(() => {
 const script=document.currentScript;
 const main=document.querySelector("main");
 const search=document.querySelector("#searchform");
 const isHome=()=>!location.hash||/^#\/?(?:\?.*)?$/.test(location.hash);
 window.guideHomeMarkup=main.innerHTML;
 main.addEventListener("error",event=>{
  if(event.target.matches?.("img.home-art"))event.target.hidden=true;
 },true);
 let started=false;
 function submit(event){
  event.preventDefault();
  const value=document.querySelector("#searchbox").value.trim();
  if(value)location.hash="/search?q="+encodeURIComponent(value);
 }
 function loadRoute(){
  document.documentElement.classList.remove("opening-guide");
  if(isHome()){
   if(started)main.innerHTML=window.guideHomeMarkup;
   return;
  }
  main.innerHTML='<p class="lead" role="status">공략을 여는 중입니다…</p>';
  loadApplication();
 }
 function loadApplication(){
  if(started)return;
  started=true;
  let failed=false;
  function fail(){
   failed=true;
   main.innerHTML='<p role="alert">공략 자료를 불러오지 못했습니다.</p><button type="button">다시 불러오기</button>';
   main.querySelector("button").onclick=()=>location.reload();
  }
  for(const source of [script.dataset.content,script.dataset.application]){
   const part=document.createElement("script");
   part.async=false;
   part.src=source;
   part.onerror=fail;
   if(source===script.dataset.application)part.onload=()=>{
    if(failed){fail();return}
    window.removeEventListener("hashchange",loadRoute);
    search.removeEventListener("submit",submit);
   };
   document.head.append(part);
  }
 }
 document.querySelector("#searchbox").addEventListener("focus",loadApplication,{once:true});
 search.addEventListener("submit",submit);
 window.addEventListener("hashchange",loadRoute);
 loadRoute();
})();
