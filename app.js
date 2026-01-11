document.addEventListener('DOMContentLoaded', () => {
  // --- Theme (simple & reliable) ---
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const stored = localStorage.getItem('calcTheme');
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const initial = stored ? stored : (prefersLight ? 'light' : 'dark');

  const setTheme = (t) => {
    body.classList.toggle('light', t === 'light');
    if(themeToggle){
      themeToggle.textContent = t === 'light' ? '☀' : '☾';
      themeToggle.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
      // mark state class for CSS to style explicitly
      themeToggle.classList.toggle('is-light', t === 'light');
      themeToggle.classList.toggle('is-dark', t !== 'light');
      themeToggle.title = t === 'light' ? 'Switch to dark' : 'Switch to light';
    }
    localStorage.setItem('calcTheme', t);
  };

  setTheme(initial);
  if(themeToggle) themeToggle.addEventListener('click', () => setTheme(body.classList.contains('light') ? 'dark' : 'light'));

  // --- Calculator (concise) ---
  const output = document.getElementById('output');
  const history = document.getElementById('history');
  let expr = '';
  let last = null;

  const render = () => {
    output.textContent = expr || '0';
    history.textContent = last != null ? 'Ans = ' + last : '';
  };

  const append = (ch) => {
    if(expr === '0' && ch !== '.') expr = ch; else expr += ch;
    render();
  };
  const clearAll = () => { expr = ''; last = null; render(); };
  const back = () => { expr = expr.slice(0, -1); render(); };

  const evaluate = () => {
    if(!expr) return;
    try{
      if(!/^[0-9+\-*/().%\s]+$/.test(expr)) throw new Error('Invalid');
      const prepared = expr.replace(/(\d+(?:\.\d+)?)%/g, '(($1)/100)').replace(/×/g,'*').replace(/÷/g,'/');
      const val = Function('return ' + prepared)();
      if(typeof val === 'number' && isFinite(val)){
        const v = Math.round((val + Number.EPSILON) * 1e12) / 1e12;
        last = v; expr = String(v); render();
      } else throw new Error('Math');
    }catch(err){ output.textContent = 'Error'; expr = ''; console.error(err); }
  };

  // --- Audio feedback (higher, professional click using WebAudio) ---
  let audioCtx = null;
  const initAudio = () => {
    if(audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') audioCtx.resume().catch(() => {});
    } catch(e) { audioCtx = null; }
  };
  const playClick = () => {
    initAudio();
    if(!audioCtx) return;
    const now = audioCtx.currentTime;

    // --- Tonal body ---
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    const bp = audioCtx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.value = 1800; // higher pitch
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 6;
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.09, now + 0.003);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    // --- Short noise burst for 'click' texture ---
    const len = Math.floor(audioCtx.sampleRate * 0.05);
    const noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1200;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.06, now + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    // connect nodes
    osc.connect(bp);
    bp.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    // start / stop
    osc.start(now); osc.stop(now + 0.06);
    noise.start(now); noise.stop(now + 0.06);

    // cleanup after nodes finish
    setTimeout(() => {
      try { osc.disconnect(); oscGain.disconnect(); bp.disconnect(); noise.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); } catch(e){}
    }, 200);
  };

  // Event delegation for button clicks
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-calc');
    if(!btn) return;
    playClick();
    const val = btn.dataset.value;
    const action = btn.dataset.action;
    if(action === 'clear') clearAll();
    else if(action === 'back') back();
    else if(action === 'percent') append('%');
    else if(action === 'evaluate') evaluate();
    else if(val) append(val);
  });

  // Keyboard support (keeps it simple)
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if(/^[0-9]$/.test(k)) append(k);
    else if(k === '.') append('.');
    else if(k === 'Enter'){ e.preventDefault(); evaluate(); }
    else if(k === 'Backspace') back();
    else if(k === 'Escape') clearAll();
    else if(/[+\-*/%()]/.test(k)) append(k);
  });

  // Touch feedback (delegated)
  document.addEventListener('touchstart', (e) => { const b = e.target.closest('.btn-calc'); if(b) b.classList.add('active'); }, {passive:true});
  document.addEventListener('touchend', (e) => { const b = e.target.closest('.btn-calc'); if(b) b.classList.remove('active'); }, {passive:true});

  clearAll();
});