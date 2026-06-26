/* ===================================================================
   script.js — Void Onion Landing Page
   =================================================================== */

'use strict';

// ── Matrix Rain ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('matrix');
const ctx    = canvas.getContext('2d');

const FONT_SIZE = 13;
const CHARS     = 'アイウエオカキクケコサシスセソタチツテト01BCDEFGHVOIDNULLアイ0xff';

let drops = [];

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const cols    = Math.floor(canvas.width / FONT_SIZE);
  // Preserve existing drops; fill new columns
  drops = Array.from({ length: cols }, (_, i) => drops[i] ?? Math.random() * canvas.height / FONT_SIZE);
}

resizeCanvas();
// Throttle resize to avoid layout thrash
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeCanvas, 150);
});

function drawMatrix() {
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font      = `${FONT_SIZE}px "Share Tech Mono", monospace`;

  for (let i = 0; i < drops.length; i++) {
    const char      = CHARS[Math.floor(Math.random() * CHARS.length)];
    ctx.fillStyle   = i % 5 === 0 ? '#00ffff' : '#00ff41';
    ctx.globalAlpha = Math.random() * 0.5 + 0.3;
    ctx.fillText(char, i * FONT_SIZE, drops[i] * FONT_SIZE);

    if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
  ctx.globalAlpha = 1;
}

// Use requestAnimationFrame throttled to ~20 fps for performance
let matrixLast = 0;
function matrixLoop(ts) {
  if (ts - matrixLast > 50) { drawMatrix(); matrixLast = ts; }
  requestAnimationFrame(matrixLoop);
}
requestAnimationFrame(matrixLoop);


// ── Clock ────────────────────────────────────────────────────────────────────
const clockEl = document.getElementById('clock');
function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  clockEl.textContent = `UTC ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
updateClock();
setInterval(updateClock, 1000);


// ── Terminal Typing Animation ─────────────────────────────────────────────────
const commands = [
  {
    cmd:    'cat /var/lib/tor/hidden_service/hostname',
    output: [{ text: 'lhqyjiwkqfq7s2jtp2visp5vpdendkv2ynhjt7qtpuoognyc7r4q2bid.onion', cls: 'success' }]
  },
  {
    cmd:    'systemctl status tor',
    output: [
      { text: '● tor.service - Anonymizing overlay network for TCP', cls: 'info'    },
      { text: '   Active: active (running) since startup',           cls: 'success' },
      { text: '   Circuit: ESTABLISHED — 3 hops encrypted',         cls: 'success' }
    ]
  },
  {
    cmd:    'netstat -tlnp | grep nginx',
    output: [{ text: 'tcp  0  0  127.0.0.1:8080  0.0.0.0:*  LISTEN  nginx', cls: 'info' }]
  },
  {
    cmd:    'echo "You are now in the onion."',
    output: [{ text: 'You are now in the onion.', cls: 'warn' }]
  }
];

let cmdIndex  = 0;
const typingEl = document.getElementById('typing-cmd');
const outputEl = document.getElementById('terminal-output');

function typeCommand(cmdStr, cb) {
  typingEl.textContent = '';
  let i = 0;
  const iv = setInterval(() => {
    typingEl.textContent += cmdStr[i++];
    if (i >= cmdStr.length) { clearInterval(iv); setTimeout(cb, 400); }
  }, 42);
}

function showOutput(lines, cb) {
  outputEl.innerHTML = '';
  lines.forEach((line, idx) => {
    setTimeout(() => {
      const div       = document.createElement('div');
      div.className   = line.cls;
      div.textContent = '> ' + line.text;
      outputEl.appendChild(div);
      if (idx === lines.length - 1) setTimeout(cb, 1500);
    }, idx * 300);
  });
}

function runNextCommand() {
  const item = commands[cmdIndex++ % commands.length];
  typeCommand(item.cmd, () => showOutput(item.output, () => setTimeout(runNextCommand, 800)));
}
setTimeout(runNextCommand, 1200);


// ── Animated Stats ────────────────────────────────────────────────────────────
function animateValue(id, target, suffix = '', duration = 2000) {
  const el   = document.getElementById(id);
  if (!el)   return;
  let start  = 0;
  const step = target / (duration / 16);
  const iv   = setInterval(() => {
    start += step;
    if (start >= target) { el.textContent = target.toLocaleString() + suffix; clearInterval(iv); }
    else                  el.textContent  = Math.floor(start).toLocaleString() + suffix;
  }, 16);
}

const statsSection = document.querySelector('.stats');
if (statsSection) {
  const statsObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      animateValue('stat-nodes',   7826,       '');
      animateValue('stat-users',   2_000_000,  '');
      animateValue('stat-latency', 284,        'ms');
      statsObs.disconnect();
    }
  }, { threshold: 0.3 });
  statsObs.observe(statsSection);
}


// ── Card Entrance Animation ───────────────────────────────────────────────────
const cardObs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
      }, i * 150);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.card').forEach(card => {
  card.style.cssText += 'opacity:0;transform:translateY(30px);transition:opacity 0.6s ease,transform 0.6s ease,border-color 0.3s,box-shadow 0.3s,background 0.3s';
  cardObs.observe(card);
});


// ── Glitch Effect on Title ────────────────────────────────────────────────────
const glitchEl = document.querySelector('.glitch');
if (glitchEl) {
  setInterval(() => {
    if (Math.random() > 0.85) {
      glitchEl.style.textShadow = `
        ${(Math.random() - 0.5) * 10}px 0 #00ffff,
        ${(Math.random() - 0.5) * 10}px 0 #bf00ff,
        0 0 10px rgba(0,255,65,0.5)`;
      setTimeout(() => { glitchEl.style.textShadow = ''; }, 100);
    }
  }, 500);
}


// ── Status Bar Rotating Messages ──────────────────────────────────────────────
const STATUS_MSGS = [
  'TOR CIRCUIT ESTABLISHED',
  'ENCRYPTED — 3 HOPS ACTIVE',
  'IP MASKED — 127.0.0.1',
  'HIDDEN SERVICE ONLINE',
  'ANONYMITY LEVEL: MAXIMUM',
  'NO LOGS. NO TRACE. NO FEAR.'
];

const statusTextEl = document.getElementById('status-text');
if (statusTextEl) {
  statusTextEl.style.transition = 'opacity 0.3s';
  let sIdx = 0;
  setInterval(() => {
    sIdx = (sIdx + 1) % STATUS_MSGS.length;
    statusTextEl.style.opacity = '0';
    setTimeout(() => {
      statusTextEl.textContent   = STATUS_MSGS[sIdx];
      statusTextEl.style.opacity = '1';
    }, 300);
  }, 3000);
}
