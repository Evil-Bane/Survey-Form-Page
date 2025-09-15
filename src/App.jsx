import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Final patch: fix pointer-event blocking and focus + make bricks pop reliably
 * - Ensure canvases have inline pointerEvents: 'none' (don't rely on Tailwind classes)
 * - Make container/card z-index higher than canvases so UI is always interactive
 * - Force initial focus/unblur after loading completes
 * - Improve triggerPopBurstAroundCenter to retry and log in console (dev-only)
 */

const THEME = {
  bg: "#05060A",
  card: "#071017",
  text: "#E9F8FF",
  muted: "#9FB7C7",
  primary: "#7C3AED",
  cyan: "#06B6D4",
  accent: "#00E5FF",
  warm: "#FFB86B",
};

const MAX_VIBRATE_AMPLITUDE = 6;
const FRAME_CAP = 40;
const AUTO_ADVANCE_DELAY = 1100;

const QUESTIONS = [
  { id: "intro", type: "stage", title: "Neon Nightfall", subtitle: "Decisions reverberate — pick fast, win faster." },
  { id: "profile", type: "profile", title: "Create Profile", subtitle: "Tell us who you are — quick and slick.", flavor: "Name, age slider, and a one-line bio. Keep it punchy." },
  { id: "q1", type: "mcq", title: "Vibe Check — choose your drive", choices: ["Prototype & ship", "Learn a trick", "Find teammates", "Prize hunter"], points: { "Prototype & ship": 20, "Learn a trick": 10, "Find teammates": 15, "Prize hunter": 5 }, flavor: "A neon corridor; your choice sets the tone." },
  { id: "q2", type: "rating", title: "Charge Level — how amped are you?", scale: 5, pointsPerStar: 6, flavor: "Lights sync to your excitement." },
  { id: "q3", type: "text", title: "One-line pitch — your spark", maxLength: 140, points: 15, flavor: "A single line. Make it crisp." },
  { id: "end", type: "stage", title: "Curtain Call", subtitle: "Badges claimed. Sunlight pending." },
];

function lerp(a,b,n){ return (1-n)*a + n*b }
function hexToRgb(hex){ const h = hex.replace('#',''); return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)]; }

function confettiBurst(canvas){ if(!canvas) return; try{ const ctx = canvas.getContext('2d'); const W = canvas.width = window.innerWidth; const H = canvas.height = window.innerHeight; const palette = [THEME.primary, THEME.cyan, THEME.accent, THEME.warm]; const pieces = Array.from({length:60}).map(()=>({ x: W/2 + (Math.random()-0.5)*300, y: H/3 + (Math.random()-0.5)*80, vx:(Math.random()-0.5)*12, vy:(Math.random()-1.6)*10, r:Math.random()*6+2, c:palette[Math.floor(Math.random()*palette.length)], life:80 + Math.random()*80 })); function frame(){ ctx.clearRect(0,0,W,H); let alive=false; for(const p of pieces){ if(p.life>0){ alive=true; p.vy += 0.25; p.x += p.vx; p.y += p.vy; ctx.save(); ctx.translate(p.x,p.y); ctx.fillStyle = p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*0.6); ctx.restore(); p.life--; } } if(alive) requestAnimationFrame(frame); else ctx.clearRect(0,0,W,H); } frame(); }catch(e){ console.warn('confetti failed', e); } }

function CustomCursor(){
  const dot = useRef(null), ring = useRef(null);
  const target = useRef({ x: typeof window !== 'undefined' ? window.innerWidth/2 : 0, y: typeof window !== 'undefined' ? window.innerHeight/2 : 0 });
  const hoverType = useRef('default');
  const raf = useRef(null);

  useEffect(()=>{
    function onMove(e){ target.current.x = e.clientX; target.current.y = e.clientY; }
    function onHover(e){ const t = e.target; if(t && t.closest && t.closest('button, a, [role="button"]')) hoverType.current = 'button'; else if(t && t.closest && t.closest('input, textarea, select, .no-brick')) hoverType.current = 'form'; else hoverType.current = 'default'; }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseover', onHover);

    let px = target.current.x; let py = target.current.y; let ringX = px; let ringY = py; const dotLerp = 0.28; const ringLerp = 0.045;
    function loop(){ px = lerp(px, target.current.x, dotLerp); py = lerp(py, target.current.y, dotLerp); if(dot.current) dot.current.style.transform = `translate3d(${px-6}px, ${py-6}px, 0)`; ringX = lerp(ringX, target.current.x, ringLerp); ringY = lerp(ringY, target.current.y, ringLerp);
      if(ring.current){ const type = hoverType.current; if(type === 'button'){ ring.current.style.borderColor = 'rgba(255,255,255,0.22)'; ring.current.style.boxShadow = '0 8px 30px rgba(255,255,255,0.04)'; } else if(type === 'form'){ ring.current.style.borderColor = 'rgba(6,182,212,0.20)'; ring.current.style.boxShadow = '0 10px 36px rgba(6,182,212,0.06)'; } else { ring.current.style.borderColor = 'rgba(124,58,237,0.12)'; ring.current.style.boxShadow = 'none'; }
      const scale = (hoverType.current === 'button') ? 1.9 : (hoverType.current === 'form' ? 1.45 : 1); ring.current.style.transform = `translate3d(${ringX-18}px, ${ringY-18}px, 0) scale(${scale})`; }
      if(dot.current){ if(hoverType.current === 'button') dot.current.style.background = 'radial-gradient(circle at 30% 30%, #fff, #ffdfe8)'; else if(hoverType.current === 'form') dot.current.style.background = 'radial-gradient(circle at 30% 30%, #e6ffff, #d8f7ff)'; else dot.current.style.background = 'radial-gradient(circle at 30% 30%, #fff, #e6f8ff)'; }
      raf.current = requestAnimationFrame(loop);
    }
    raf.current = requestAnimationFrame(loop);
    return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseover', onHover); cancelAnimationFrame(raf.current); }
  }, []);

  useEffect(()=>{ document.documentElement.classList.add('custom-cursor-hide'); return ()=>document.documentElement.classList.remove('custom-cursor-hide'); }, []);

  return (
    <>
      <div ref={ring} style={{ position:'fixed', left:0, top:0, width:44, height:44, borderRadius:9999, border:'1.6px solid rgba(124,58,237,0.12)', pointerEvents:'none', zIndex:99999, transition:'border-color 180ms, box-shadow 180ms, transform 180ms' }} />
      <div ref={dot} style={{ position:'fixed', left:0, top:0, width:12, height:12, borderRadius:9999, background:'radial-gradient(circle at 30% 30%, #fff, #e6f8ff)', boxShadow:'0 10px 26px rgba(6,182,212,0.08)', pointerEvents:'none', zIndex:100000, transition:'background 160ms' }} />
      <style>{`.custom-cursor-hide, .custom-cursor-hide * { cursor: none !important; }`}</style>
    </>
  );
}

function MiniGame({ timeLimit=6000, onComplete, flavor }){
  const [charge, setCharge] = useState(0); const runningRef = useRef(false); const raf = useRef(null); const started = useRef(0); const boost = useRef(0);
  useEffect(()=>()=> cancelAnimationFrame(raf.current), []);
  function start(){ if(runningRef.current) return; runningRef.current = true; boost.current = 0; started.current = performance.now(); tick(); }
  function tick(){ raf.current = requestAnimationFrame(()=>{ const elapsed = performance.now() - started.current; const base = Math.min(100, Math.round((elapsed/timeLimit)*100)); const total = Math.min(100, base + boost.current); setCharge(total); if(total>=100){ runningRef.current=false; cancelAnimationFrame(raf.current); onComplete(true); return; } if(elapsed>=timeLimit){ runningRef.current=false; cancelAnimationFrame(raf.current); onComplete(total>=60); return; } tick(); }); }
  function tap(){ if(!runningRef.current) start(); else { boost.current = Math.min(100, boost.current + 12); setCharge(c=>Math.min(100,c+12)); } }
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
      <div style={{ color: THEME.muted, fontSize:13 }}>{flavor}</div>
      <motion.div onClick={tap} whileTap={{ scale:0.96 }} whileHover={{ scale:1.02 }} transition={{ type:'spring', stiffness:300 }} style={{ width:140, height:140, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:`linear-gradient(135deg, ${THEME.primary}, ${THEME.cyan})`, boxShadow:'0 16px 46px rgba(0,0,0,0.45)' }}>
        <div style={{ fontWeight:900, color:'#06060A' }}>TAP</div>
      </motion.div>
      <div style={{ width:'100%', maxWidth:520 }}>
        <div style={{ color: THEME.muted, marginBottom:6 }}>Charge: {charge}%</div>
        <div style={{ height:12, width:'100%', borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.02)' }}>
          <motion.div initial={{ width:0 }} animate={{ width: `${charge}%` }} transition={{ type:'spring', stiffness:120, damping:20 }} style={{ height:'100%', background:`linear-gradient(90deg, ${THEME.cyan}, ${THEME.primary})` }} />
        </div>
      </div>
    </div>
  );
}

export default function GamifiedSurveyForm(){
  useEffect(()=>{ document.title = 'HackPlay — Neon Survey'; }, []);

  const [answers, setAnswers] = useState(()=>{ try{ const r = localStorage.getItem('gamifiedSurveyAnswers'); return r?JSON.parse(r):{} }catch{ return {}; } });
  const [score, setScore] = useState(()=>Number(localStorage.getItem('gamifiedSurveyScore'))||0);
  const [showFinish, setShowFinish] = useState(false);

  const [profileName, setProfileName] = useState(answers.profileName || '');
  const [profileAge, setProfileAge] = useState(answers.profileAge || 22);
  const [profileBio, setProfileBio] = useState(answers.profileBio || '');

  const [tempSelection, setTempSelection] = useState(null);
  const [focusedSection, setFocusedSection] = useState(0);

  const confettiCanvas = useRef(null);
  const bgCanvas = useRef(null);

  const [height, setHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  useEffect(()=>{ function onResize(){ setHeight(window.innerHeight); } window.addEventListener('resize', onResize); return ()=>window.removeEventListener('resize', onResize); }, []);

  useEffect(()=>localStorage.setItem('gamifiedSurveyAnswers', JSON.stringify(answers)), [answers]);
  useEffect(()=>localStorage.setItem('gamifiedSurveyScore', String(score)), [score]);

  const visible = QUESTIONS;
  const containerRef = useRef(null); const chapterRefs = useRef([]); chapterRefs.current = [];
  const addRef = el => { if(el) chapterRefs.current.push(el) };
  const targetY = useRef(0); const currentY = useRef(0); const rafUI = useRef(null);
  const pageIndexRef = useRef(0); const [activeIndex, setActiveIndex] = useState(0);
  const lastIdxRef = useRef(0);

  const cursor = useRef({ x: typeof window !== 'undefined' ? window.innerWidth/2 : 0, y: typeof window !== 'undefined' ? window.innerHeight/2 : 0 });
  useEffect(()=>{ function onPointer(e){ cursor.current.x = e.clientX; cursor.current.y = e.clientY; } window.addEventListener('pointermove', onPointer); return ()=>window.removeEventListener('pointermove', onPointer); }, []);

  // loader: 2s
  const [loading, setLoading] = useState(true); const [progress, setProgress] = useState(0);
  useEffect(()=>{ let raf = null; const start = performance.now(); const D = 2000; function tick(now){ const t = Math.min(1,(now-start)/D); setProgress(Math.round(100 * t)); if(t<1) raf = requestAnimationFrame(tick); else setTimeout(()=> setLoading(false), 180); } raf = requestAnimationFrame(tick); return ()=> cancelAnimationFrame(raf); }, []);

  // make sure UI becomes interactive after loading
  useEffect(()=>{
    if(!loading){ // land on first page and set focus immediately
      setTimeout(()=>{
        scrollToIndex(0, { pop: false });
        setFocusedSection(0);
        focusSectionAfterScroll(0, 0);
      }, 80);
    }
  }, [loading]);

  // wheel -> page snap (slower feel)
  useEffect(()=>{
    let acc = 0; let lock = false; function clamp(i){ return Math.max(0, Math.min(i, visible.length-1)); }
    function setPage(i){ const c = clamp(i); scrollToIndex(c, { pop: false }); }
    function onWheel(e){ if(loading) return; e.preventDefault(); acc += e.deltaY; const TH = 80; if(Math.abs(acc) > TH && !lock){ const dir = acc>0?1:-1; setPage(pageIndexRef.current + dir); acc = 0; lock = true; setTimeout(()=> lock = false, 420); } }
    window.addEventListener('wheel', onWheel, { passive:false }); return ()=> window.removeEventListener('wheel', onWheel);
  }, [height, loading, visible.length]);

  // UI lerp loop — sets focusedSection when index changes so card is unblurred and lifted
  useEffect(()=>{ function loop(){ currentY.current = lerp(currentY.current, targetY.current, 0.12); if(containerRef.current) containerRef.current.style.transform = `translate3d(0, ${-currentY.current}px, 0)`; chapterRefs.current.forEach((node, i)=>{ if(!node) return; const center = i * height; const offset = (currentY.current - center)/height; const abs = Math.abs(offset); const translateY = offset * 8; const rotate = offset * 1.2; const scale = 1 - Math.min(0.05, abs * 0.05); const opacity = 1 - Math.min(0.9, abs * 0.9); node.style.transform = `translate3d(0px, ${translateY}px, 0) rotate(${rotate}deg) scale(${scale})`; node.style.opacity = String(opacity); // visual lift when focused
      if(i === focusedSection){ node.style.boxShadow = '0 34px 120px rgba(8,6,20,0.78)'; node.style.zIndex = 320; } else { node.style.boxShadow = 'none'; node.style.zIndex = 30; }
    }); const idx = Math.round(currentY.current / height); if(lastIdxRef.current !== idx){ lastIdxRef.current = idx; setActiveIndex(idx); setFocusedSection(idx); } rafUI.current = requestAnimationFrame(loop); } rafUI.current = requestAnimationFrame(loop); return ()=> cancelAnimationFrame(rafUI.current); }, [height]);

  // BRICKS canvas: improved pop and bursts
  useEffect(()=>{
    const canvas = bgCanvas.current; if(!canvas) return; const ctx = canvas.getContext('2d'); let W = window.innerWidth, H = window.innerHeight; const DPR = Math.min(window.devicePixelRatio || 1, 1.2);
    canvas.width = W * DPR; canvas.height = H * DPR; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; ctx.scale(DPR, DPR);

    let BRW = window.innerWidth < 640 ? 120 : 96; let BRH = window.innerWidth < 640 ? 56 : 44; let cols = Math.ceil(W/BRW), rows = Math.ceil(H/BRH);
    const MAX = 700; if(cols*rows > MAX){ const scaleUp = Math.sqrt((cols*rows)/MAX); BRW = Math.ceil(BRW * scaleUp); BRH = Math.ceil(BRH * scaleUp); cols = Math.ceil(W/BRW); rows = Math.ceil(H/BRH); }

    const bricks = []; const purple = hexToRgb(THEME.primary); const cyan = hexToRgb(THEME.cyan);
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const x = c*BRW + (r%2?BRW/2:0); const y = r*BRH; const cx = x + BRW/2; const cy = y + BRH/2;
        const mix = Math.random(); const r0 = Math.round((1-mix)*purple[0] + mix*cyan[0]); const g0 = Math.round((1-mix)*purple[1] + mix*cyan[1]); const b0 = Math.round((1-mix)*purple[2] + mix*cyan[2]);
        bricks.push({ x, y, w:BRW, h:BRH, cx, cy, baseX:x, baseY:y, phase:Math.random()*Math.PI*2, vy:0, pop:0, gone:false, falling:false, fallVy:0, fallY:0, opacity:1, col:[r0,g0,b0], mix });
      }
    }

    canvas._triggerPop = function(px, py){
      let nearest = null; let best = Infinity;
      for(const b of bricks){ if(b.gone) continue; const dx = b.cx - px; const dy = b.cy - py; const d = Math.hypot(dx,dy); if(d < best){ best = d; nearest = b; } }
      if(nearest && best < Math.max(120, Math.min(W,H) * 0.06) && !nearest.falling){ nearest.falling = true; nearest.fallVy = 200 + Math.random()*220; nearest.fallY = 0; }
      const R = 140;
      for(const b of bricks){ if(b.gone || b.falling) continue; const dx = b.cx - px; const dy = b.cy - py; const d = Math.hypot(dx,dy); if(d < R){ const norm = 1 - d / R; b.pop = Math.max(b.pop, 0.45 * norm + 0.02); b.vy += (6 * norm) + (Math.random()*3); }
      }
    };

    let lastT = performance.now(); const FRAME_MS = 1000 / FRAME_CAP; let raf = null; const startTime = performance.now();
    function draw(now){ if(now - lastT < FRAME_MS){ raf = requestAnimationFrame(draw); return; } const dt = Math.min(40, now - lastT) * 0.001; lastT = now; ctx.clearRect(0,0,W,H);
      ctx.fillStyle = 'rgba(4,6,10,0.46)'; ctx.fillRect(0,0,W,H);
      const time = now * 0.001; const maxD = Math.max(W,H) * 0.6; const elapsedSec = Math.max(0, (now - startTime) / 1000); const speedFactor = 1 + Math.min(1, elapsedSec / 60) * 0.25;

      for(const b of bricks){ if(b.gone) continue;
        if(b.falling){ b.fallVy += 900 * dt; b.fallY += b.fallVy * dt; b.opacity = Math.max(0, 1 - (b.fallY / (H * 1.2))); if(b.fallY > H + 120){ b.gone = true; continue; } }

        const dx = b.cx - cursor.current.x; const dy = b.cy - cursor.current.y; const d = Math.hypot(dx,dy);
        let t = Math.max(0, 1 - d / maxD); t = Math.pow(t, 0.95);

        b.vy *= 0.92; b.vy -= 20 * dt * t; b.pop = Math.max(0, b.pop - 0.02);
        const lift = b.falling ? 0 : Math.min(14, 10 * t + b.pop * 20);

        const freq = 6 * speedFactor; const ampX = MAX_VIBRATE_AMPLITUDE * (0.6 + 0.6 * b.mix) * t * 0.45; const ampY = (MAX_VIBRATE_AMPLITUDE * 0.45) * (0.5 + 0.5 * b.mix) * t;
        const vibrateX = (b.falling ? 0 : Math.sin(time * freq + b.phase) * ampX);
        const vibrateY = (b.falling ? 0 : Math.cos(time * freq * 1.1 + b.phase) * ampY);

        const px = b.baseX + vibrateX;
        const py = b.baseY + vibrateY - lift + b.vy * dt * 50 + (b.falling ? b.fallY : 0);

        const r = Math.max(6, Math.min(255, Math.round(b.col[0] + Math.sin(time*0.6 + b.phase)*5)));
        const g = Math.max(6, Math.min(255, Math.round(b.col[1] + Math.cos(time*0.62 + b.phase)*5)));
        const bb = Math.max(6, Math.min(255, Math.round(b.col[2] + Math.sin(time*0.64 + b.phase)*5)));
        const alpha = (b.opacity !== undefined ? b.opacity : 1) * (0.98 - (1 - t) * 0.08);

        const grad = ctx.createLinearGradient(px+6,py+6,px + b.w - 6, py + b.h - 6);
        grad.addColorStop(0, `rgba(${Math.max(0,r-16)}, ${Math.max(0,g-16)}, ${Math.max(0,bb-16)}, ${alpha})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${bb}, ${alpha})`);
        ctx.save();
        if(b.falling){ ctx.translate(px + b.w/2, py + b.h/2); ctx.rotate((b.phase % 1) * (b.fallY / (H/3)) * 0.4 ); ctx.translate(-(px + b.w/2), -(py + b.h/2)); }
        ctx.fillStyle = grad; roundRect(ctx, px+6, py+6, b.w - 12, b.h - 12, 6); ctx.fill();
        if(t > 0.06 && !b.falling) { ctx.fillStyle = `rgba(255,255,255,${0.02 * t + 0.02 * b.pop})`; ctx.fillRect(px+12, py+10, b.w - 24, Math.max(2, Math.min(5, 3 * t))); }
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    function roundRect(ctx,x,y,w,h,r){ const minr = Math.min(r, w/2, h/2); ctx.beginPath(); ctx.moveTo(x+minr,y); ctx.arcTo(x+w,y,x+w,y+h,minr); ctx.arcTo(x+w,y+h,x,y+h,minr); ctx.arcTo(x,y+h,x,y,minr); ctx.arcTo(x,y,x+ w,y,minr); ctx.closePath(); }

    raf = requestAnimationFrame(draw);

    function onPointerDown(e){ const inUI = e.target && e.target.closest && e.target.closest('button, input, textarea, select, [role="button"], .no-brick'); if(inUI) return; const rect = canvas.getBoundingClientRect(); const px = e.clientX - rect.left; const py = e.clientY - rect.top; canvas._triggerPop(px, py); }
    window.addEventListener('pointerdown', onPointerDown);

    function onResize(){ W = window.innerWidth; H = window.innerHeight; canvas.width = W * DPR; canvas.height = H * DPR; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; ctx.scale(DPR,DPR); }
    window.addEventListener('resize', onResize);

    return ()=>{ window.removeEventListener('resize', onResize); window.removeEventListener('pointerdown', onPointerDown); cancelAnimationFrame(raf); };
  }, [height]);

  // reliable focus after scroll (poll until scroll nears destination)
  function focusSectionAfterScroll(sec, dest){
    const start = performance.now(); const TIMEOUT = 1400; const TOL = 6; const iv = setInterval(()=>{
      const elapsed = performance.now() - start; const diff = Math.abs(currentY.current - dest);
      if(diff <= TOL || elapsed > TIMEOUT){ clearInterval(iv);
        setTimeout(()=>{ // small extra wait to ensure DOM settled
          setFocusedSection(sec); // ensure visual lift immediately when settled
          const node = chapterRefs.current[sec]; if(node){ const first = node.querySelector && (node.querySelector('button, input, textarea, select, [tabindex], [role="button"]')); if(first && first.focus) try{ first.focus({ preventScroll: true }); }catch(e){} }
        }, 80);
      }
    }, 60);
  }

  // helper to reliably trigger pop even if canvas not ready yet
  function triggerPopBurstAroundCenter(){
    const canvas = bgCanvas.current; if(!canvas) return;
    let attempts = 0; const maxAttempts = 10;
    function tryBurst(){ attempts++; if(canvas._triggerPop){ try{
        const rect = canvas.getBoundingClientRect(); const cx = rect.width/2; const cy = rect.height/2; for(let j=0;j<4;j++){ setTimeout(()=> canvas._triggerPop(cx + (j-1.5)*30, cy + (j-1.5)*18), j*80); }
        // dev log
        if(window && window.console) console.debug('[popBurst] fired at attempt', attempts);
      }catch(e){ if(window && window.console) console.warn('popBurst error', e); }
    } else if(attempts < maxAttempts){ setTimeout(tryBurst, 120); } else { if(window && window.console) console.warn('popBurst: canvas._triggerPop not found after', attempts, 'attempts'); }
  }
  tryBurst();
  }

  // improved scrollToIndex: triggers a tiny burst of pops to ensure visible fall even when cards are centered
  function scrollToIndex(i, { pop = false } = {}){
    const max = Math.max(0, (visible.length - 1) * height);
    const dest = Math.max(0, Math.min(i * height, max));
    targetY.current = dest;
    pageIndexRef.current = Math.round(dest / height);
    const sec = Math.round(dest / height);
    // force the focusedSection when programmatic scroll starts
    setFocusedSection(sec);

    focusSectionAfterScroll(sec, dest);

    if(pop){ triggerPopBurstAroundCenter(); }
  }

  function handleAnswer(qid, value){
    setAnswers(prev => ({ ...prev, [qid]: value }));
    setTempSelection({ qid, value });

    const q = QUESTIONS.find(x=>x.id===qid) || {}; let gained = 0; if(q.type==='mcq' && q.points) gained = q.points[value] || 0; else if(q.type==='rating') gained = value * (q.pointsPerStar||1); else if(q.type==='text') gained = q.points||0; if(gained) { setScore(s=>s+gained); pulseScore(); }

    setTimeout(()=>{ setTempSelection(null); scrollToIndex(pageIndexRef.current + 1, { pop: true }); }, AUTO_ADVANCE_DELAY);
  }

  function pulseScore(){ const el = document.getElementById('score-badge'); if(!el) return; el.animate([{ transform:'translateY(0) scale(1)' },{ transform:'translateY(-6px) scale(1.04)' },{ transform:'translateY(0) scale(1)' }], { duration:640, easing:'ease-out' }); }
  function finish(){ setShowFinish(true); if(confettiCanvas.current) confettiBurst(confettiCanvas.current); }

  function submitProfile(){ const name = profileName.trim(); if(!name) return alert('Please enter your name'); setAnswers(prev => ({ ...prev, profileName: name, profileAge, profileBio })); setScore(s=>s+10); pulseScore(); // next
    setTimeout(()=> scrollToIndex(pageIndexRef.current+1, { pop: true }), 600);
  }

  return (
    <div style={{ minHeight:'100vh', background:THEME.bg, color:THEME.text, position:'relative', overflow:'hidden' }}>
      <style>{`
        .btn { padding:10px 14px; border-radius:12px; font-weight:800; cursor:pointer; border:1px solid rgba(255,255,255,0.03); transition: transform 260ms cubic-bezier(.2,.9,.2,1), box-shadow 260ms, background 260ms; }
        .btn-primary { background: linear-gradient(90deg, ${THEME.cyan}, ${THEME.primary}); color:#02171A; box-shadow:0 12px 40px rgba(6,182,212,0.06); }
        .btn-primary:hover { transform: translateY(-4px); box-shadow:0 26px 64px rgba(6,182,212,0.12); }
        .btn-ghost { background: rgba(255,255,255,0.02); color:${THEME.text}; }
        .heading-glow { background-image: linear-gradient(90deg, ${THEME.cyan}, ${THEME.primary}); -webkit-background-clip: text; color: transparent; }
        .no-brick { pointer-events: auto; user-select: text; -webkit-user-select: text; -moz-user-select: text; }
        .choice-selected { box-shadow: 0 18px 50px rgba(124,58,237,0.16); transform: translateY(-6px); border: 1px solid rgba(255,255,255,0.06); }
        input[type=range] { -webkit-appearance:none; height:10px; background:linear-gradient(90deg, ${THEME.cyan}, ${THEME.primary}); border-radius:999px; outline:none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:999px; background:#02171A; box-shadow:0 10px 26px rgba(124,58,237,0.14); border:4px solid ${THEME.cyan}; }
        @keyframes subtleGlow { 0%{ filter:brightness(1) } 50%{ filter:brightness(1.06) } 100%{ filter:brightness(1) } }
      `}</style>

      <CustomCursor />

      {/* Make canvases explicitly pointerEvents none via inline style so they never block clicks */}
      <canvas ref={bgCanvas} className="fixed inset-0" style={{ pointerEvents: 'none', zIndex: 10, left:0, top:0, width:'100%', height:'100%', position:'fixed', filter: loading ? 'blur(6px) brightness(0.56)' : 'none', transition: 'filter 520ms cubic-bezier(.2,.9,.2,1)' }} />
      <canvas ref={confettiCanvas} className="fixed inset-0" style={{ pointerEvents: 'none', zIndex: 200, left:0, top:0, width:'100%', height:'100%', position:'fixed' }} />

      {loading && <div style={{ position:'fixed', inset:0, zIndex:260, background:'rgba(3,4,10,0.42)', backdropFilter:'blur(6px)' }} />}

      <div style={{ position:'fixed', left:16, top:16, zIndex:280, display:'flex', gap:12, alignItems:'center' }}>
        <div id="score-badge" style={{ padding:'10px 14px', borderRadius:9999, background:'linear-gradient(90deg, rgba(6,182,212,0.1), rgba(124,58,237,0.08))', fontWeight:900 }}>{score} pts</div>
      </div>

      {loading && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:900, marginBottom:14, fontSize:18 }}>Loading — Neon Calibration</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center', alignItems:'center' }}>
              <div style={{ width:36, height:80, borderRadius:8, background:`linear-gradient(180deg, rgba(6,182,212,0.14), rgba(124,58,237,0.08))`, transform:'skewX(-6deg)', animation:'pulse 1.2s infinite' }} />
              <div style={{ width:36, height:100, borderRadius:8, background:`linear-gradient(180deg, rgba(124,58,237,0.18), rgba(6,182,212,0.06))`, transform:'skewX(-4deg)', animation:'pulse 1.2s infinite .08s' }} />
              <div style={{ width:36, height:80, borderRadius:8, background:`linear-gradient(180deg, rgba(0,229,255,0.12), rgba(124,58,237,0.04))`, transform:'skewX(-2deg)', animation:'pulse 1.2s infinite .14s' }} />
            </div>
            <div style={{ width:420, height:12, borderRadius:999, background:'rgba(255,255,255,0.02)', margin:'14px auto', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progress}%`, background:`linear-gradient(90deg, ${THEME.cyan}, ${THEME.primary})`, transition:'width 320ms linear' }} />
            </div>
            <div style={{ color:THEME.muted, marginTop:8 }}>{progress}%</div>
          </div>
        </div>
      )}

      {/* Container has a high z-index and pointerEvents auto so UI always receives clicks */}
      <div ref={containerRef} className="fixed inset-0" style={{ willChange:'transform', zIndex:320, pointerEvents: 'none' }}> 
        <div style={{ height:`${visible.length * height}px` }}>
          {visible.map((item, i) => (
            <section key={item.id} ref={addRef} onMouseEnter={()=> setFocusedSection(i)} style={{ height:`${height}px`, display:'flex', alignItems:'center', justifyContent:'center', padding:20, pointerEvents: 'none' }}>
              <div style={{ width:'100%', maxWidth:1100, display:'grid', gridTemplateColumns:'280px 1fr', gap:20, alignItems:'center' }}>

                <aside style={{ display: window.innerWidth >= 1000 ? 'block' : 'none' }}>
                  <div style={{ position:'sticky', top:36 }}>
                    <div style={{ background: i===focusedSection ? '#06080D' : THEME.card, padding:16, borderRadius:14, boxShadow:'0 18px 60px rgba(2,6,12,0.6)', backdropFilter:'blur(4px)', border:'1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ color:THEME.muted }}>Chapter</div>
                      <div style={{ fontSize:22, fontWeight:900, marginTop:8 }}>{String(i+1).padStart(2,'0')}</div>
                      <div style={{ color:THEME.muted, marginTop:6 }}>{item.title}</div>
                      <div style={{ marginTop:12, display:'flex', gap:8 }}>
                        <button onClick={()=> scrollToIndex(i-1)} className="btn btn-ghost">Prev</button>
                        <button onClick={()=> scrollToIndex(i+1, { pop: true })} className="btn btn-primary">Next</button>
                      </div>
                    </div>
                  </div>
                </aside>

                {/* CARD: opaque and lifted when focused so bricks are always behind */}
                <div className="no-brick" style={{ borderRadius:14, padding:24, background: i===focusedSection ? '#050712' : THEME.card, minHeight:260, display:'flex', alignItems:'center', justifyContent:'center', boxShadow: i===focusedSection ? '0 38px 140px rgba(8,6,20,0.88)' : '0 14px 40px rgba(8,6,20,0.4)', backdropFilter:'blur(4px)', border:'1px solid rgba(255,255,255,0.03)', transition:'box-shadow 420ms cubic-bezier(.2,.9,.2,1), transform 420ms, background 360ms', zIndex:340 }}>
                  <div style={{ width:'100%', maxWidth:780 }}>

                    {item.type === 'stage' && (
                      <div style={{ textAlign:'center' }}>
                        <h1 className="heading-glow" style={{ fontSize:32, fontWeight:900, animation:'subtleGlow 3.4s ease-in-out infinite' }}>{item.title}</h1>
                        {item.subtitle && <div style={{ color:THEME.muted, marginTop:8 }}>{item.subtitle}</div>}
                        <div style={{ marginTop:12 }}>
                          <button onClick={()=> scrollToIndex(i+1, { pop: true })} className="btn btn-primary">Enter</button>
                        </div>
                      </div>
                    )}

                    {item.type === 'profile' && (
                      <div>
                        <div style={{ color:THEME.muted, marginBottom:12 }}>{item.flavor}</div>
                        <div style={{ display:'grid', gap:12 }}>
                          <label style={{ color:THEME.muted, fontSize:13 }}>Name</label>
                          <input value={profileName} onChange={(e)=> setProfileName(e.target.value)} placeholder="Your name" className="no-brick" style={{ padding:12, borderRadius:10, border:'1px solid rgba(255,255,255,0.04)', background: i===focusedSection ? '#071017' : THEME.card, color:THEME.text }} />

                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div style={{ color:THEME.muted, fontSize:13 }}>Age</div>
                              <div style={{ fontWeight:800 }}>{profileAge}</div>
                            </div>
                            <input type="range" min={13} max={80} value={profileAge} onChange={(e)=> setProfileAge(Number(e.target.value))} className="no-brick" />
                          </div>

                          <label style={{ color:THEME.muted, fontSize:13 }}>One-line bio</label>
                          <textarea value={profileBio} onChange={(e)=> setProfileBio(e.target.value)} placeholder="I build things that..." rows={3} className="no-brick" style={{ padding:12, borderRadius:10, border:'1px solid rgba(255,255,255,0.04)', background: i===focusedSection ? '#071017' : THEME.card, color:THEME.text }} maxLength={120} />

                          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                            <button onClick={()=> { setProfileName(''); setProfileAge(22); setProfileBio(''); }} className="btn btn-ghost no-brick">Reset</button>
                            <button onClick={()=> submitProfile()} className="btn btn-primary no-brick">Save & Next</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {item.type === 'mcq' && (
                      <div>
                        <div style={{ color:THEME.muted, marginBottom:12 }}>{item.flavor}</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12 }}>
                          {item.choices.map(c => (
                            <button
                              key={c}
                              onClick={()=> handleAnswer(item.id, c)}
                              className={"no-brick"}
                              style={{
                                padding:16,
                                borderRadius:12,
                                textAlign:'left',
                                background: (answers[item.id] === c || (tempSelection && tempSelection.qid === item.id && tempSelection.value === c)) ? `linear-gradient(90deg, ${THEME.cyan}, ${THEME.primary})` : 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))',
                                color: (answers[item.id] === c || (tempSelection && tempSelection.qid === item.id && tempSelection.value === c)) ? '#02171A' : THEME.text,
                                border: (answers[item.id] === c || (tempSelection && tempSelection.qid === item.id && tempSelection.value === c)) ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.02)',
                                boxShadow: (answers[item.id] === c || (tempSelection && tempSelection.qid === item.id && tempSelection.value === c)) ? '0 18px 60px rgba(124,58,237,0.14)' : '0 12px 40px rgba(6,18,32,0.36)',
                                transform: (answers[item.id] === c || (tempSelection && tempSelection.qid === item.id && tempSelection.value === c)) ? 'translateY(-6px)' : 'translateY(0)',
                                transition: 'all 380ms cubic-bezier(.2,.9,.2,1)'
                              }}
                            >
                              <div style={{ fontWeight:800 }}>{c}</div>
                              <div style={{ color:THEME.muted, marginTop:6 }}>{item.points && item.points[c] ? `${item.points[c]} pts` : ''}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.type === 'rating' && (
                      <div style={{ textAlign:'center' }}>
                        <div style={{ color:THEME.muted, marginBottom:12 }}>{item.flavor}</div>
                        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                          {Array.from({ length: item.scale }).map((_,idx)=> (
                            <button key={idx} onClick={()=> handleAnswer(item.id, idx+1)} className="no-brick" style={{ width:56, height:56, borderRadius:999, background:(answers[item.id] === (idx+1) || (tempSelection && tempSelection.qid === item.id && tempSelection.value === (idx+1))) ? `linear-gradient(90deg, ${THEME.cyan}, ${THEME.primary})` : 'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.03)', fontWeight:800, transition:'all 320ms' }}>{idx+1}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.type === 'text' && (
                      <div>
                        <div style={{ color:THEME.muted, marginBottom:8 }}>{item.flavor}</div>
                        <textarea className="no-brick" rows={4} maxLength={item.maxLength} value={answers[item.id]||''} onChange={(e)=> setAnswers(prev=>({ ...prev, [item.id]: e.target.value }))} placeholder="One-line pitch..." style={{ width:'100%', padding:12, borderRadius:8, background: i===focusedSection ? '#071017' : THEME.card, color:THEME.text }} />
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                          <div style={{ color:THEME.muted }}>{(answers[item.id]||'').length}/{item.maxLength}</div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={()=> { if(item.points && (answers[item.id]||'').length>0) setScore(s=>s+item.points); setTempSelection({ qid: item.id, value: 'submitted' }); setTimeout(()=>{ setTempSelection(null); scrollToIndex(pageIndexRef.current+1, { pop: true }); }, AUTO_ADVANCE_DELAY); }} className="btn btn-primary no-brick">Submit</button>
                            <button onClick={()=> setAnswers(prev=>({ ...prev, [item.id]: '' }))} className="btn btn-ghost no-brick">Clear</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {item.type === 'minigame' && <MiniGame timeLimit={item.timeLimit} onComplete={(s)=>{ if(s) setScore(x=>x+item.pointsOnSuccess); setTempSelection({ qid: item.id, value: s ? 'success' : 'fail' }); setTimeout(()=>{ setTempSelection(null); scrollToIndex(pageIndexRef.current+1, { pop: true }); }, AUTO_ADVANCE_DELAY); }} flavor={item.flavor} />}

                  </div>
                </div>

              </div>
            </section>
          ))}
        </div>
      </div>

      <AnimatePresence>{showFinish && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ position:'fixed', inset:0, zIndex:360, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:640, padding:20, borderRadius:10, background:THEME.card, boxShadow:'0 18px 60px rgba(2,6,12,0.6)', backdropFilter:'blur(6px)' }}>
            <h3 style={{ fontSize:22, fontWeight:900 }}>Done — Results</h3>
            <p style={{ color:THEME.muted }}>You scored <strong style={{ color:THEME.text }}>{score}</strong>. Nice work!</p>
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button onClick={()=> { setShowFinish(false); }} className="btn btn-ghost no-brick">Close</button>
              <button onClick={()=> { setShowFinish(false); if(confettiCanvas.current) confettiBurst(confettiCanvas.current); }} className="btn btn-primary no-brick">Celebrate</button>
            </div>
          </div>
        </motion.div>
      )}</AnimatePresence>

    </div>
  );
}
