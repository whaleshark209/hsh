// ===== boot check =====
console.log("[script.js] loaded OK");
document.addEventListener("DOMContentLoaded", ()=>{ console.log("[script.js] DOMContentLoaded"); initApp(); });

// ===== Config =====
const TMDB_API_KEY_FRONT = "ddd654eb8622a67e04f93f613653426d";
const HOVER_DELAY_MS = 3000;

// ===== Categories =====
const GENRES=["Action (액션)","Adventure (모험)","Animation (애니메이션)","Comedy (코미디)","Crime (범죄)","Drama (드라마)","Fantasy (판타지)","Historical (사극/역사)","Horror (공포)","Musical (뮤지컬)","Mystery (미스터리)","Romance (로맨스)","Sci-Fi (SF / 공상과학)","Thriller (스릴러)","War (전쟁)","Western (서부극)","Documentary (다큐멘터리)","Family (가족)","Biography (전기)","Sport (스포츠)"];
const REGIONS=["한국영화","해외영화","일본영화","중국영화","프랑스영화","OTT 전용 영화"];
const THEMES=["Now Playing (현재 상영작)","Upcoming (개봉 예정작)","Top Rated (평점 높은 순)","Popular (인기순)","Classic (고전 명작)","Indie (독립영화)","Short Film (단편영화)","LGBTQ+","Noir / Neo-noir","Superhero (히어로)","Time Travel / Space / Cyberpunk","Zombie / Monster / Disaster"];
const REGION_LANG={ "한국영화":"ko","해외영화":"en","일본영화":"ja","중국영화":"zh","프랑스영화":"fr" };

// ===== State =====
let tokens=[]; let currentItems=[]; let selected=[];
let mode="popular"; let queryState={q:"",lang:"",page:1};
let noMore=false, loadingFlag=false; const seenKeys=new Set();

// ===== DOM refs =====
let panel, openBtn, homeBtn, closeBtn, clearAllBtn, tokenList, queryInput,
    chipsGenre, chipsRegion, chipsTheme, clearSelectionsBtn, selectedTitlesEl,
    selCountTop, selCountBottom, gridEl, statusEl, sentinel,
    trailerModal, trailerFrame, modalClose, infoTitle, infoMeta, infoOverview;

// ===== Utils =====
const PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='600'><rect width='100%' height='100%' fill='#111'/><text x='50%' y='50%' fill='#555' dy='.3em' text-anchor='middle' font-size='24'>No Image</text></svg>";
const posterUrl = p => p ? `https://image.tmdb.org/t/p/w500${p}` : PLACEHOLDER;
const CHO=["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const reChosung=/^[ㄱ-ㅎ]+$/; const isHangul=ch=>ch>="\uAC00" && ch<="\uD7A3";
const normText=s=>(s||"").toLowerCase().normalize("NFKC").replace(/\s+/g,"").replace(/[\W_]+/g,"");
function toChosung(str){let out="";for(const ch of str){if(isHangul(ch)){const code=ch.charCodeAt(0)-0xAC00;out+=CHO[Math.floor(code/588)]||ch;}else out+=ch;}return out;}
function currentChosungKey(){const q=(queryInput?.value||"").trim();if(reChosung.test(q))return q;const chos=tokens.filter(t=>reChosung.test((t||"").trim())).sort((a,b)=>b.length-a.length);return chos.length?chos[0].trim():"";}
function keyOf(it){ if(it.id) return `tmdb:${it.id}`; const t=(it.title||"").toLowerCase(); return `title:${t}|${it.year||""}`; }
function isSelected(it){ return selected.some(s=> keyOf(s)===keyOf(it)); }
function titleKeywords(title){ return (title||"").toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean); }

// ===== TMDb fetchers =====
async function safeFetch(url){
  try{
    const r=await fetch(url);
    if(!r.ok){ console.warn("TMDb bad status:", r.status, url); return []; }
    const j=await r.json(); return j.results||[];
  }catch(e){ console.error("TMDb fetch error", e); return []; }
}
async function tmdbPopular(page=1){
  const rs=await safeFetch(`https://api.themoviedb.org/3/movie/popular?api_key=${encodeURIComponent(TMDB_API_KEY_FRONT)}&language=ko-KR&region=KR&page=${page}`);
  return rs.map(n=>({title:n.title||n.name||"",year:(n.release_date||n.first_air_date||"").slice(0,4),poster:posterUrl(n.poster_path),source:"TMDb",id:n.id,popularity:n.popularity||0,original_language:n.original_language}));
}
async function tmdbSearch(q,page=1){
  const rs=await safeFetch(`https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(TMDB_API_KEY_FRONT)}&language=ko-KR&query=${encodeURIComponent(q)}&page=${page}&include_adult=false`);
  return rs.map(n=>({title:n.title||n.name||"",year:(n.release_date||n.first_air_date||"").slice(0,4),poster:posterUrl(n.poster_path),source:"TMDb",id:n.id,popularity:n.popularity||0,original_language:n.original_language}));
}
async function tmdbDiscoverLang(lang,page=1){
  const rs=await safeFetch(`https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(TMDB_API_KEY_FRONT)}&language=ko-KR&with_original_language=${encodeURIComponent(lang)}&sort_by=popularity.desc&page=${page}`);
  return rs.map(n=>({title:n.title||n.name||"",year:(n.release_date||n.first_air_date||"").slice(0,4),poster:posterUrl(n.poster_path),source:"TMDb",id:n.id,popularity:n.popularity||0,original_language:n.original_language}));
}
async function tmdbDetail(id){
  try{
    const r=await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${encodeURIComponent(TMDB_API_KEY_FRONT)}&language=ko-KR`);
    if(!r.ok) return null; return await r.json();
  }catch{ return null; }
}

// ===== Scoring / Sort =====
function computeScore(item,{tokens,text,chosungKey,lang}){
  const title=item.title||""; const tkw=titleKeywords(title); const tset=new Set(tkw);
  const extras=tokens.filter(x=>!REGION_LANG[x] && !reChosung.test(x)).map(x=>x.toLowerCase());
  const textNorm=normText(text||""); const titleNorm=normText(title);
  let hit=0; extras.forEach(x=>{ if(tset.has(x)) hit++; });
  let score = 25*(extras.length? hit/extras.length : 0);
  if(textNorm && titleNorm.includes(textNorm)) score+=20;
  if(chosungKey && toChosung(title).includes(chosungKey)) score+=20;
  let subHit=0; extras.forEach(x=>{ if(title.toLowerCase().includes(x)) subHit++; });
  score+=20*(extras.length? subHit/extras.length : 0);
  if(lang && (item.original_language===lang || item.lang===lang)) score+=10;
  score+=Math.min(5, Math.log10(1+(item.popularity||0)));
  return Math.max(0, Math.min(100, Math.round(score)));
}
function makeContext(){
  return { tokens:[...tokens], text:(queryInput?.value||"").trim(), chosungKey:currentChosungKey(),
           lang:(tokens.find(t=>REGION_LANG[t])? REGION_LANG[tokens.find(t=>REGION_LANG[t])] : "") };
}
function sortByRelevance(items, ctx){
  for(const it of items){ it._score=computeScore(it, ctx); }
  return [...items].sort((a,b)=> (b._score-a._score)||((b.popularity||0)-(a.popularity||0)));
}

// ===== Rendering =====
const hoverTimers = new WeakMap(); // 카드별 호버 타이머

function renderPosters(items,{append=false,selectionOnly=false,withScoring=false,context=null}={}){
  if(selectionOnly){
    [...gridEl.querySelectorAll(".card")].forEach((card,idx)=>{
      const it=currentItems[idx]; if(!it) return;
      card.classList.toggle("selected", isSelected(it));
    });
    return;
  }
  if(!append) gridEl.innerHTML="";

  const frag=document.createDocumentFragment();
  for(const m of items){
    const card=document.createElement("div"); card.className="card"; if(isSelected(m)) card.classList.add("selected");
    const img=document.createElement("img"); img.className="thumb"; img.alt=m.title||""; img.src=m.poster||PLACEHOLDER;

    let score=0; if(withScoring && context){ score=computeScore(m,context); }
    const bar=document.createElement("div"); bar.className="scorebar";
    const fill=document.createElement("div"); fill.className="fill";
    fill.style.transform=`scaleX(${(score/100).toFixed(3)})`; bar.appendChild(fill);

    const meta=document.createElement("div"); meta.className="meta";
    const title=document.createElement("div"); title.className="title"; title.textContent=m.title||"(제목 없음)";
    const sub=document.createElement("div"); sub.className="sub"; sub.textContent=(score>0?`관련도 ${score}% · `:"")+(m.year||"");
    meta.append(title,sub);

    // 클릭 선택/해제
    card.addEventListener("click",()=>{ const want=!isSelected(m); toggleSelect(m,want,card); });

    // ✅ 3초 호버 → 트레일러
    card.addEventListener("mouseenter",()=>{
      clearTimeout(hoverTimers.get(card));
      const t=setTimeout(async ()=>{
        try{
          if(!m.id) return;
          const key=await fetchTrailerKeyTMDb(m.id);
          const detail=await tmdbDetail(m.id);
          if(key) openTrailerModal(m,key,detail);
        }catch(e){ console.error("Trailer open failed:", e); }
      }, HOVER_DELAY_MS);
      hoverTimers.set(card,t);
    });
    card.addEventListener("mouseleave",()=>{
      clearTimeout(hoverTimers.get(card));
      hoverTimers.delete(card);
    });

    card.append(img,bar,meta); frag.appendChild(card);
  }
  gridEl.appendChild(frag);
}

// ===== Trailer modal =====
function openTrailerModal(item, ytKey, detail){
  infoTitle.textContent=item.title || detail?.title || "(제목 없음)";
  const year=item.year || (detail?.release_date||"").slice(0,4) || "";
  const lang=(detail?.original_language || item.original_language || "").toUpperCase();
  infoMeta.textContent=[year,lang].filter(Boolean).join(" · ");
  infoOverview.textContent = detail?.overview || "설명이 없습니다.";
  trailerFrame.src=`https://www.youtube.com/embed/${encodeURIComponent(ytKey)}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0`;
  trailerModal.hidden=false; document.body.style.overflow="hidden";
}
function closeTrailerModal(){ trailerModal.hidden=true; trailerFrame.src=""; document.body.style.overflow=""; }

// ===== Selection =====
function updateSelectionCounters(){
  const txt=`(${selected.length}/10)`; selCountTop.textContent=txt;
  selCountBottom.textContent=`${selected.length}/10 선택됨`;
}
function updateSelectedBar(){
  selectedTitlesEl.innerHTML="";
  selected.forEach(m=>{
    const chip=document.createElement("span"); chip.className="sel-chip";
    chip.textContent=m.title||"(제목 없음)";
    const x=document.createElement("button"); x.textContent="✕"; x.title="이 선택 제거";
    x.onclick=(e)=>{ e.stopPropagation(); toggleSelect(m,false); };
    chip.appendChild(x); selectedTitlesEl.appendChild(chip);
  });
  updateSelectionCounters();
}
function toggleSelect(item,on,cardEl){
  const k=keyOf(item), ex=isSelected(item);
  if(on && !ex){
    if(selected.length>=10){ alert("최대 10개까지 선택할 수 있어요."); return; }
    selected.push(item); cardEl?.classList.add("selected");
  }else if(!on && ex){
    selected=selected.filter(s=> keyOf(s)!==k); cardEl?.classList.remove("selected");
  }
  updateSelectedBar();
}
function clearAllSelections(){
  selected=[]; updateSelectedBar();
  [...gridEl.querySelectorAll(".card")].forEach(c=>c.classList.remove("selected"));
}

// ===== Filter/Dedup =====
function dedupAppend(list){
  const out=[]; for(const m of list){ const k=keyOf(m); if(seenKeys.has(k)) continue; seenKeys.add(k); out.push(m); }
  return out;
}
function filterByExtrasAndText(list){
  const extras=tokens.filter(t=>!REGION_LANG[t] && !reChosung.test(t)).map(s=>s.toLowerCase());
  const textRaw=(queryInput?.value||"").trim(); const textHas=!!(extras.length||textRaw);
  const chosKey=currentChosungKey(); const chosHas=!!chosKey; const textNorm=normText(textRaw);
  if(!textHas && !chosHas) return list;
  return list.filter(m=>{
    const title=(m.title||""); const tl=title.toLowerCase();
    const textOk = !textHas || ( extras.every(x=>tl.includes(x)) && (!textRaw || tl.includes(textRaw.toLowerCase())) );
    const nospaceOk = !textRaw || normText(title).includes(textNorm);
    const chosOk = !chosHas || toChosung(title).includes(chosKey);
    return ((!textHas)||(textOk||nospaceOk)) && (!chosHas||chosOk);
  });
}

// ===== Fetch by mode =====
async function fetchByMode(page){
  try{
    if(mode==="popular") return await tmdbPopular(page);
    if(mode==="discover") return await tmdbDiscoverLang(queryState.lang,page);
    if(mode==="search")   return await tmdbSearch(queryState.q,page);
    return await tmdbPopular(page);
  }catch{ statusEl.textContent="API 요청 실패. 네트워크 또는 API Key 확인 필요."; return []; }
}

// ===== Paging & infinite scroll =====
async function loadNextPage(minCount=8){
  if(loadingFlag||noMore) return [];
  loadingFlag=true;
  let got=[], tries=0, emptyBatches=0;
  try{
    while(got.length<minCount && tries<25){
      const batch=await fetchByMode(queryState.page);
      if(!batch || !batch.length){ emptyBatches++; if(emptyBatches>=3){ noMore=true; break; } queryState.page++; tries++; continue; }
      const filtered=filterByExtrasAndText(batch);
      const unique=dedupAppend(filtered);
      if(!unique.length){ queryState.page++; tries++; continue; }
      got.push(...unique); queryState.page++; tries++;
    }
    if(got.length){
      currentItems=[...currentItems,...got];
      const ctx=makeContext();
      currentItems=sortByRelevance(currentItems, ctx);
      gridEl.innerHTML=""; renderPosters(currentItems,{append:false,withScoring:true,context:ctx});
      statusEl.textContent=`${currentItems.length}개 결과`;
    } else if(currentItems.length===0){
      statusEl.textContent="표시할 영화가 없습니다. (API 키/네트워크 확인)";
    }
  } finally { loadingFlag=false; }
  return got;
}

// ===== Chips / Tokens / Search =====
function renderChips(container,list){
  container.innerHTML="";
  list.forEach(name=>{
    const b=document.createElement("button"); b.className="chip"; b.textContent=name;
    b.onclick=()=>{ appendToken(name); runSearch(true); };
    container.appendChild(b);
  });
}
function appendToken(text){ const t=(text||"").trim(); if(!t) return; if(!tokens.includes(t)){ tokens.push(t); renderTokens(); } queryInput?.focus(); }
function renderTokens(){
  tokenList.innerHTML="";
  tokens.forEach((t,i)=>{
    const chip=document.createElement("span"); chip.className="token-chip";
    const label=document.createElement("span"); label.textContent=t;
    const x=document.createElement("button"); x.innerHTML="✕";
    x.onclick=()=>{ tokens.splice(i,1); renderTokens(); runSearch(false); };
    chip.append(label,x); tokenList.appendChild(chip);
  });
}
function pickedRegion(){ return tokens.find(t=>REGION_LANG[t])||null; }

async function runSearch(closeAfter=false){
  const region=pickedRegion(); const text=(queryInput?.value||"").trim();
  noMore=false; loadingFlag=false; seenKeys.clear(); currentItems=[]; gridEl.innerHTML=""; statusEl.textContent="";
  if(region){ mode="discover"; queryState={q:"",lang:REGION_LANG[region],page:1}; }
  else{
    const chosOnly=reChosung.test(text)||tokens.some(t=>reChosung.test((t||"").trim()));
    const combined=[...tokens.filter(t=>!REGION_LANG[t]), text].filter(Boolean).join(" ").trim();
    mode=(combined && !chosOnly)? "search":"popular"; queryState={q:combined && !chosOnly? combined:"", lang:"", page:1};
  }
  const ctx=makeContext();
  const first=await fetchByMode(queryState.page)||[]; queryState.page=2;
  const filtered=filterByExtrasAndText(first); const unique=dedupAppend(filtered);
  currentItems=sortByRelevance(unique, ctx); renderPosters(currentItems,{append:false,withScoring:true,context:ctx});
  statusEl.textContent=`${currentItems.length}개 결과`;
  while(document.body.scrollHeight<=window.innerHeight && !noMore){ const added=await loadNextPage(12); if(!added.length) break; }
  if(closeAfter){ panel.hidden=true; window.scrollBy({top:-1,behavior:"instant"}); }
}

// ===== Init / Events =====
function resetAppToHome(){
  tokens=[]; selected=[]; renderTokens(); updateSelectedBar();
  queryInput.value=""; mode="popular"; queryState={q:"",lang:"",page:1}; noMore=false;
  seenKeys.clear(); gridEl.innerHTML=""; statusEl.textContent="불러오는 중…";
  panel.hidden=true; window.scrollTo({top:0,behavior:"smooth"});
  loadNextPage(20);
}

function initApp(){
  // DOM refs
  panel=document.getElementById("panel");
  openBtn=document.getElementById("openBtn");
  homeBtn=document.getElementById("homeBtn");
  closeBtn=document.getElementById("closeBtn");
  clearAllBtn=document.getElementById("clearAllBtn");
  tokenList=document.getElementById("tokenList");
  queryInput=document.getElementById("query");
  chipsGenre=document.getElementById("chipsGenre");
  chipsRegion=document.getElementById("chipsRegion");
  chipsTheme=document.getElementById("chipsTheme");
  clearSelectionsBtn=document.getElementById("clearSelections");
  selectedTitlesEl=document.getElementById("selectedTitles");
  selCountTop=document.getElementById("selCountTop");
  selCountBottom=document.getElementById("selCountBottom");
  gridEl=document.getElementById("movie-list");
  statusEl=document.getElementById("status");
  sentinel=document.getElementById("sentinel");
  trailerModal=document.getElementById("trailerModal");
  trailerFrame=document.getElementById("trailerFrame");
  modalClose=document.getElementById("modalClose");
  infoTitle=document.getElementById("infoTitle");
  infoMeta=document.getElementById("infoMeta");
  infoOverview=document.getElementById("infoOverview");

  // Chips 렌더
  renderChips(chipsGenre,GENRES);
  renderChips(chipsRegion,REGIONS);
  renderChips(chipsTheme,THEMES);
  renderTokens(); updateSelectedBar();

  // 이벤트
  openBtn.onclick=()=>{ panel.hidden=!panel.hidden; if(!panel.hidden) setTimeout(()=>queryInput?.focus(),0); };
  homeBtn.onclick=resetAppToHome;
  closeBtn.onclick=()=>{ panel.hidden=true; window.scrollBy({ top:-1, behavior:"instant" }); };
  clearAllBtn.onclick=()=>{ tokens=[]; renderTokens(); runSearch(false); };
  clearSelectionsBtn.onclick=clearAllSelections;

  queryInput.addEventListener("input",()=>runSearch(false));
  queryInput.addEventListener("keydown",async e=>{
    if(e.key==="Backspace" && !queryInput.value && tokens.length){ tokens.pop(); renderTokens(); runSearch(false); }
    if(e.key==="Enter"){ e.preventDefault(); await runSearch(true); }
  });

  // 모달
  document.getElementById("modalClose").addEventListener("click", closeTrailerModal);
  trailerModal.addEventListener("click",(e)=>{
    const withinVideo = e.target.closest(".video-box");
    const withinPanel = e.target.closest(".info-panel");
    if(!withinVideo && !withinPanel) closeTrailerModal();
  });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && !trailerModal.hidden) closeTrailerModal(); });

  // 무한 스크롤
  new IntersectionObserver(async e=>{ if(e[0].isIntersecting) await loadNextPage(8); },{root:null,rootMargin:"900px 0px 900px 0px",threshold:0.01}).observe(sentinel);

  // 첫 로딩
  resetAppToHome();
}
