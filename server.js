const http = require('http'), WebSocket = require('ws'), fs = require('fs');
const rooms = {};
const MAX_PLAYERS = 6;
const ARENA_W = 900, ARENA_H = 640;
const MAX_HP = 150, BASE_SIZE = 30, MIN_SPEED = 0.6, MAX_VEL = 4;
function code() { var s = ''; for (var i = 0; i < 4; i++)s += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]; return s }
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/healthz') { res.writeHead(200); res.end('ok'); return }
  if (u === '/' || u === '/index.html' || u.startsWith('/join/')) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(fs.readFileSync('index.html', 'utf8')); return }
  res.writeHead(404); res.end();
});
const wss = new WebSocket.Server({ server });

function spawnPack(r) {
  var margin = 30;
  var x = r.arenaL + margin + Math.random() * (r.arenaR - r.arenaL - margin * 2);
  var y = r.arenaT + margin + Math.random() * (r.arenaB - r.arenaT - margin * 2);
  var heal = Math.floor(15 + Math.random() * 21);
  r.packs.push({ x: x, y: y, hp: heal });
}

// Power-up types: 0=speed, 1=shield, 2=damage, 3=ghost
const POWERUP_TYPES = ['speed', 'shield', 'damage', 'ghost'];
const POWERUP_DURATION = { speed: 200, shield: 250, damage: 200, ghost: 180 }; // ticks (16ms each)
function spawnPowerup(r) {
  var margin = 40;
  var x = r.arenaL + margin + Math.random() * (r.arenaR - r.arenaL - margin * 2);
  var y = r.arenaT + margin + Math.random() * (r.arenaB - r.arenaT - margin * 2);
  var type = POWERUP_TYPES[Math.floor(Math.random() * 4)];
  r.powerups.push({ x: x, y: y, type: type });
}

// Hazard spawning
function spawnHazard(r) {
  var type = Math.random() < 0.5 ? 'fire' : 'vortex';
  var x = r.arenaL + 50 + Math.random() * (r.arenaR - r.arenaL - 100);
  var y = r.arenaT + 50 + Math.random() * (r.arenaB - r.arenaT - 100);
  r.hazards.push({ x: x, y: y, type: type, age: 0, duration: type === 'fire' ? 375 : 500 });
}

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

// Detect shape ability based on stats
function detectAbility(m) {
  // spikeBurst removed
  if (m.c <= 1 && m.s > 0.7) return 'absorb'; // Circle - heal on hit
  if (m.l >= 3) return 'dash'; // Snake/tentacles - speed burst
  if (m.c >= 4) return 'block'; // Square/Star shape - invincibility
  return 'none';
}

function startArena(roomCode) {
  const r = rooms[roomCode];
  if (!r || r.started) return;
  r.started = true;
  r.monsters = {}; r.tick = 0; r.arenaL = 0; r.arenaT = 0; r.arenaR = ARENA_W; r.arenaB = ARENA_H;
  r.packs = []; r.blasts = []; r.powerups = []; r.hazards = []; r.floatTexts = []; r.kills = []; r.particles = [];
  r.suddenDeath = false;

  const pids = Object.keys(r.monsterData);
  r.teamMode = false;

  for (let ti = 0; ti < pids.length; ti++) {
    const pid = pids[ti];
    const m = r.monsterData[pid];
    const hp = Math.min(MAX_HP, Math.max(80, Math.round(m.a * 0.6)));
    // Position monsters and aim them towards center
    const px = r.arenaL + 80 + Math.random() * (ARENA_W - 160);
    const py = r.arenaT + 60 + Math.random() * (ARENA_H - 120);
    const cx = ARENA_W / 2, cy = ARENA_H / 2;
    const dx = cx - px, dy = cy - py;
    const dist = Math.hypot(dx, dy) || 1;
    const ability = detectAbility(m);
    r.monsters[pid] = {
      x: px, y: py,
      vx: (dx / dist) * 1.5 + (Math.random() - 0.5) * 0.3,
      vy: (dy / dist) * 1.5 + (Math.random() - 0.5) * 0.3,
      path: m.p, name: m.n || '???', baseSize: BASE_SIZE, size: BASE_SIZE, hp: hp, maxHp: hp, iframes: 0,
      spikes: Math.min(m.c, 5), stability: Math.min(m.s * 3, 2) + (ability === 'none' ? 1 : 0), baseSpeed: 1.0 + Math.min(m.l * 0.15, 0.5), speed: 0,
      color: r.colors[pid] || '#9b59b6',
      ability: ability, abilityCooldown: 0,
      effects: {}, // { speed: ticksLeft, shield: ticksLeft, etc }
      kills: 0, trail: []
    };
    r.monsters[pid].speed = Math.max(MIN_SPEED, r.monsters[pid].baseSpeed);
  }
  spawnPack(r); spawnPack(r);
}
function verts(m) {
  const s = m.size / 40; let cx = 0, cy = 0;
  for (let i = 0; i < m.path.length; i++) { cx += m.path[i][0] * 12; cy += m.path[i][1] * 12 }
  cx /= m.path.length; cy /= m.path.length;
  const o = [];
  for (let i = 0; i < m.path.length; i++)
    o.push([m.x + (m.path[i][0] * 12 - cx) * s, m.y + (m.path[i][1] * 12 - cy) * s]);
  return o;
}
function ptInPoly(px, py, v) {
  let n = 0;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const yi = v[i][1], yj = v[j][1], xi = v[i][0], xj = v[j][0];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi + 1e-10) + xi)) n++;
  }
  return n % 2 === 1;
}
// Check if line segments a1->a2 and b1->b2 intersect
function segsIntersect(a1, a2, b1, b2) {
  const d = (b2[1] - b1[1]) * (a2[0] - a1[0]) - (b2[0] - b1[0]) * (a2[1] - a1[1]);
  if (Math.abs(d) < 1e-10) return false;
  const ua = ((b2[0] - b1[0]) * (a1[1] - b1[1]) - (b2[1] - b1[1]) * (a1[0] - b1[0])) / d;
  const ub = ((a2[0] - a1[0]) * (a1[1] - b1[1]) - (a2[1] - a1[1]) * (a1[0] - b1[0])) / d;
  return ua > 0 && ua < 1 && ub > 0 && ub < 1;
}
function polyOverlap(a, b) {
  const va = verts(a), vb = verts(b);
  // Check vertex containment
  for (let i = 0; i < va.length; i++)if (ptInPoly(va[i][0], va[i][1], vb)) return true;
  for (let i = 0; i < vb.length; i++)if (ptInPoly(vb[i][0], vb[i][1], va)) return true;
  // Check edge intersections
  for (let i = 0; i < va.length; i++) {
    const a1 = va[i], a2 = va[(i + 1) % va.length];
    for (let j = 0; j < vb.length; j++) {
      if (segsIntersect(a1, a2, vb[j], vb[(j + 1) % vb.length])) return true;
    }
  }
  return false;
}

function clampBounds(m, r) {
  const v = verts(m);
  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  for (let i = 0; i < v.length; i++) { mnX = Math.min(mnX, v[i][0]); mxX = Math.max(mxX, v[i][0]); mnY = Math.min(mnY, v[i][1]); mxY = Math.max(mxY, v[i][1]) }
  if (mnX < r.arenaL) { m.x += r.arenaL - mnX; m.vx = Math.abs(m.vx) * 0.9 }
  if (mxX > r.arenaR) { m.x -= mxX - r.arenaR; m.vx = -Math.abs(m.vx) * 0.9 }
  if (mnY < r.arenaT) { m.y += r.arenaT - mnY; m.vy = Math.abs(m.vy) * 0.9 }
  if (mxY > r.arenaB) { m.y -= mxY - r.arenaB; m.vy = -Math.abs(m.vy) * 0.9 }
}

function tick(roomCode) {
  const r = rooms[roomCode];
  if (!r || !r.monsters || r.done) return;
  r.tick = (r.tick || 0) + 1;
  const logs = [];
  // Speed boost every 6s (375 ticks at 16ms)
  if (r.tick % 375 === 0) {
    for (const id of Object.keys(r.monsters)) { var m = r.monsters[id]; m.baseSpeed = Math.min(1.5, m.baseSpeed + 0.03) }
    logs.push('Speed up!');
  }
  // Shrink arena - increments grow over time
  if (r.tick % 900 === 0 && (r.arenaR - r.arenaL) > 180) {
    var phase = Math.floor(r.tick / 900);
    var shrinkX = Math.min(12, 4 + phase);
    var shrinkY = Math.min(10, 3 + Math.floor(phase * 0.7));
    r.arenaL += shrinkX; r.arenaT += shrinkY; r.arenaR -= shrinkX; r.arenaB -= shrinkY;
    if (r.arenaR - r.arenaL < 180) { r.arenaL = (r.arenaL + r.arenaR) / 2 - 90; r.arenaR = r.arenaL + 180 }
    if (r.arenaB - r.arenaT < 130) { r.arenaT = (r.arenaT + r.arenaB) / 2 - 65; r.arenaB = r.arenaT + 130 }
    logs.push('Arena shrinks!');
    for (const id of Object.keys(r.monsters)) clampBounds(r.monsters[id], r);
    // Remove health packs outside new bounds
    for (let pi = r.packs.length - 1; pi >= 0; pi--) {
      const pk = r.packs[pi];
      if (pk.x < r.arenaL || pk.x > r.arenaR || pk.y < r.arenaT || pk.y > r.arenaB) r.packs.splice(pi, 1);
    }
  }
  // Spawn health packs - slower rate as arena shrinks
  var aliveCount = Object.keys(r.monsters).length;
  var phase = Math.floor(r.tick / 900);
  var packRate = (aliveCount <= 2 ? 450 : aliveCount <= 3 ? 750 : 1200) + phase * 100;
  if (r.tick % packRate === 0 && r.packs.length < 3) spawnPack(r);

  // Spawn power-ups every ~15 seconds
  if (r.tick % 900 === 0 && r.powerups.length < 2) spawnPowerup(r);

  // Spawn hazards after 45 seconds, more frequent as game goes on
  if (r.tick > 2700 && r.tick % (1200 - Math.min(phase * 100, 600)) === 0 && r.hazards.length < 3) spawnHazard(r);

  // Remove powerups/hazards outside arena bounds
  for (let i = r.powerups.length - 1; i >= 0; i--) {
    const p = r.powerups[i];
    if (p.x < r.arenaL || p.x > r.arenaR || p.y < r.arenaT || p.y > r.arenaB) r.powerups.splice(i, 1);
  }

  // Process hazards
  for (let hi = r.hazards.length - 1; hi >= 0; hi--) {
    const h = r.hazards[hi];
    h.age++;
    if (h.age > h.duration) { r.hazards.splice(hi, 1); continue; }
    // Apply hazard effects to monsters
    for (const id of Object.keys(r.monsters)) {
      const m = r.monsters[id];
      const dist = Math.hypot(m.x - h.x, m.y - h.y);
      if (h.type === 'fire' && dist < 50) {
        if (r.tick % 30 === 0 && !m.effects.shield) { m.hp -= 3; r.floatTexts.push({ x: m.x, y: m.y - 20, text: '-3', color: '#f00' }); }
      }
      if (h.type === 'vortex' && dist < 100 && dist > 10) {
        const pull = 0.15 * (1 - dist / 100);
        m.vx += (h.x - m.x) / dist * pull;
        m.vy += (h.y - m.y) / dist * pull;
      }
    }
  }

  // Lightning strike warning + strike
  if (r.tick > 3600 && r.tick % 900 === 500) {
    // Warning
    const x = r.arenaL + 50 + Math.random() * (r.arenaR - r.arenaL - 100);
    const y = r.arenaT + 50 + Math.random() * (r.arenaB - r.arenaT - 100);
    r.lightningWarning = { x, y, tick: r.tick };
  }
  if (r.lightningWarning && r.tick - r.lightningWarning.tick === 60) {
    const lw = r.lightningWarning;
    for (const id of Object.keys(r.monsters)) {
      const m = r.monsters[id];
      if (Math.hypot(m.x - lw.x, m.y - lw.y) < 60 && !m.effects.shield) {
        m.hp -= 18;
        r.floatTexts.push({ x: m.x, y: m.y - 30, text: '-18', color: '#ff0' });
        logs.push(m.name + ' struck by lightning!');
      }
    }
    r.lightningStrike = { x: lw.x, y: lw.y };
    r.lightningWarning = null;
  }
  if (r.lightningStrike && r.tick % 10 === 0) r.lightningStrike = null;

  // Sudden death - when arena is minimum size
  if ((r.arenaR - r.arenaL) <= 180 && (r.arenaB - r.arenaT) <= 130 && !r.suddenDeath) {
    r.suddenDeath = true;
    logs.push('⚠️ SUDDEN DEATH!');
  }
  if (r.suddenDeath && r.tick % 60 === 0) {
    for (const id of Object.keys(r.monsters)) {
      const m = r.monsters[id];
      if (!m.effects.shield) { m.hp -= 3; r.floatTexts.push({ x: m.x, y: m.y - 15, text: '-3', color: '#a00' }); }
    }
  }

  // Process monster effects (countdown timers)
  for (const id of Object.keys(r.monsters)) {
    const m = r.monsters[id];
    for (const eff of Object.keys(m.effects)) {
      m.effects[eff]--;
      if (m.effects[eff] <= 0) delete m.effects[eff];
    }
    if (m.abilityCooldown > 0) m.abilityCooldown--;
    // Trail for visual effect
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 8) m.trail.shift();
  }
  // Process new blasts -> convert to active blast accelerations
  var blastFx = [];
  if (r.blasts && r.blasts.length) {
    if (!r.activeBlasts) r.activeBlasts = [];
    for (const bl of r.blasts) {
      blastFx.push({ x: bl.x, y: bl.y });
      r.activeBlasts.push({ x: bl.x, y: bl.y, ticks: 6 });
      logs.push('BLAST!');
    }
    r.blasts = [];
  }
  // Apply active blast accelerations over multiple ticks
  if (r.activeBlasts && r.activeBlasts.length) {
    for (let bi = r.activeBlasts.length - 1; bi >= 0; bi--) {
      const bl = r.activeBlasts[bi];
      for (const id of Object.keys(r.monsters)) {
        const m = r.monsters[id];
        const dx = m.x - bl.x, dy = m.y - bl.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 250) {
          const force = Math.max(0.4, (250 - dist) / 50) * bl.ticks / 3;
          m.vx += dx / dist * force; m.vy += dy / dist * force;
        }
      }
      bl.ticks--;
      if (bl.ticks <= 0) r.activeBlasts.splice(bi, 1);
    }
  }
  for (const id of Object.keys(r.monsters)) if (r.monsters[id].iframes > 0) r.monsters[id].iframes--;
  for (const id of Object.keys(r.monsters)) {
    const m = r.monsters[id];
    m.size = Math.max(8, m.baseSize * (m.hp / m.maxHp));
    // Apply speed boost effect
    let speedMult = 1 + (1 - m.hp / m.maxHp) * 1.5;
    if (m.effects.speed) speedMult *= 2;
    m.speed = Math.max(MIN_SPEED, m.baseSpeed * speedMult);
    m.hp = Math.min(m.hp, m.maxHp);
    // Ensure minimum velocity magnitude
    const curV = Math.hypot(m.vx, m.vy);
    if (curV < MIN_SPEED && curV > 0.01) { m.vx = m.vx / curV * MIN_SPEED; m.vy = m.vy / curV * MIN_SPEED }
    else if (curV <= 0.01) { var a = Math.random() * Math.PI * 2; m.vx = Math.cos(a) * MIN_SPEED; m.vy = Math.sin(a) * MIN_SPEED }
    m.x += m.vx * m.speed; m.y += m.vy * m.speed;
    clampBounds(m, r);
    // Cap velocity
    const v = Math.hypot(m.vx, m.vy); if (v > MAX_VEL) { m.vx = m.vx / v * MAX_VEL; m.vy = m.vy / v * MAX_VEL }
  }
  // Health pack pickup - check if pack is inside shape polygon
  for (const id of Object.keys(r.monsters)) {
    const m = r.monsters[id];
    const v = verts(m);
    for (let pi = r.packs.length - 1; pi >= 0; pi--) {
      const pk = r.packs[pi];
      // Check if health pack center is inside monster polygon
      if (ptInPoly(pk.x, pk.y, v)) {
        m.hp = Math.min(m.maxHp, m.hp + pk.hp);
        r.floatTexts.push({ x: pk.x, y: pk.y, text: '+' + pk.hp, color: '#2f2' });
        logs.push(m.name + ' +' + pk.hp + 'hp!');
        r.packs.splice(pi, 1);
      }
    }
    // Power-up pickup
    for (let pi = r.powerups.length - 1; pi >= 0; pi--) {
      const pu = r.powerups[pi];
      if (ptInPoly(pu.x, pu.y, v)) {
        m.effects[pu.type] = POWERUP_DURATION[pu.type];
        r.floatTexts.push({ x: pu.x, y: pu.y, text: pu.type.toUpperCase(), color: '#ff0' });
        logs.push(m.name + ' got ' + pu.type + '!');
        r.powerups.splice(pi, 1);
      }
    }
  }
  // Collision
  const ids = Object.keys(r.monsters);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = r.monsters[ids[i]], b = r.monsters[ids[j]];
      if (!a || !b) continue;
      // Ghost effect: pass through
      if (a.effects.ghost || b.effects.ghost) continue;
      if (!polyOverlap(a, b)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 0.1;
      const nx = dx / dist, ny = dy / dist;
      // Push always happens
      const push = Math.max(0.15, (a.spikes - b.stability + b.spikes - a.stability) * 0.08);
      a.vx -= nx * push; a.vy -= ny * push;
      b.vx += nx * push; b.vy += ny * push;
      const sep = (a.size + b.size) * 0.1;
      a.x -= nx * sep; a.y -= ny * sep; b.x += nx * sep; b.y += ny * sep;
      clampBounds(a, r); clampBounds(b, r);
      // Damage only if no iframes, check shield
      if (a.iframes <= 0 && b.iframes <= 0) {
        // Velocity-based damage multiplier: faster = more damage (0.5x at rest, 2.0x at max vel)
        const velA = Math.hypot(a.vx, a.vy);
        const velB = Math.hypot(b.vx, b.vy);
        const velMultA = 0.5 + (velA / MAX_VEL) * 1.5;
        const velMultB = 0.5 + (velB / MAX_VEL) * 1.5;
        const baseDmgA = (b.spikes - a.stability) * 2.5 * (b.effects.damage ? 2 : 1);
        const baseDmgB = (a.spikes - b.stability) * 2.5 * (a.effects.damage ? 2 : 1);
        const dmgA = a.effects.shield ? 0 : Math.min(20, Math.max(1, Math.round(baseDmgA * velMultB)));
        const dmgB = b.effects.shield ? 0 : Math.min(20, Math.max(1, Math.round(baseDmgB * velMultA)));
        a.hp -= dmgA; b.hp -= dmgB; a.iframes = 25; b.iframes = 25;
        if (dmgA > 0) r.floatTexts.push({ x: a.x, y: a.y - 20, text: '-' + dmgA, color: velMultB > 1.2 ? '#ff0' : '#f55' });
        if (dmgB > 0) r.floatTexts.push({ x: b.x, y: b.y - 20, text: '-' + dmgB, color: velMultA > 1.2 ? '#ff0' : '#f55' });
        // Absorb ability: heal on hit
        if (a.ability === 'absorb' && dmgB > 0) a.hp = Math.min(a.maxHp, a.hp + Math.ceil(dmgB * 0.75));
        if (b.ability === 'absorb' && dmgA > 0) b.hp = Math.min(b.maxHp, b.hp + Math.ceil(dmgA * 0.75));
        logs.push(a.name + ' -' + dmgA + ' / ' + b.name + ' -' + dmgB);
      }
    }
  }
  // Check deaths and track kills
  for (const id of Object.keys(r.monsters)) {
    if (r.monsters[id].hp <= 0) {
      const dead = r.monsters[id];
      logs.push(dead.name + ' defeated!');
      r.floatTexts.push({ x: dead.x, y: dead.y, text: 'KO', color: '#fff' });
      r.kills.push({ name: dead.name, x: dead.x, y: dead.y });
      // Spawn death explosion particles
      for (let pi = 0; pi < 12; pi++) {
        const angle = Math.PI * 2 * pi / 12;
        r.particles.push({ x: dead.x, y: dead.y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, color: dead.color, age: 0 });
      }
      delete r.monsters[id];
    }
  }
  // Update particles
  for (let pi = r.particles.length - 1; pi >= 0; pi--) {
    const p = r.particles[pi];
    p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy *= 0.95; p.age++;
    if (p.age > 30) r.particles.splice(pi, 1);
  }

  // Win condition
  const alive = Object.keys(r.monsters);
  let gameOver = false;
  if (alive.length <= 1 && !r.done) {
    if (alive.length === 1) logs.push(r.monsters[alive[0]].name + ' wins!');
    else if (alive.length === 0) logs.push('Draw!');
    gameOver = true;
  }
  if (gameOver && !r.done) {
    r.done = true;
    // Schedule restart after 4 seconds
    setTimeout(() => {
      if (!r || !rooms[roomCode]) return;
      r.started = false; r.done = false; r.monsters = null; r.packs = []; r.blasts = [];
      r.powerups = []; r.hazards = []; r.floatTexts = []; r.kills = []; r.suddenDeath = false; r.particles = [];
      // Keep monsterData so shapes are preserved, but clear ready state
      const saved = {}; for (const pid of Object.keys(r.monsterData)) saved[pid] = r.monsterData[pid];
      r.monsterData = {}; r.savedShapes = saved;
      r.players.forEach(p => { if (p.readyState === 1) { p.send(JSON.stringify({ t: 'restart' })); p.send(JSON.stringify({ t: 'status', ready: 0, total: r.players.length })) } });
    }, 4000);
  }
  // Clear float texts after sending (one-time display)
  const floats = r.floatTexts.slice(); r.floatTexts = [];
  const data = JSON.stringify({
    t: 'arena', m: r.monsters, b: [r.arenaL, r.arenaT, r.arenaR, r.arenaB],
    pk: r.packs, pu: r.powerups, hz: r.hazards,
    bl: blastFx.length ? blastFx : undefined,
    ft: floats.length ? floats : undefined,
    pt: r.particles.length ? r.particles : undefined,
    lw: r.lightningWarning, ls: r.lightningStrike,
    sd: r.suddenDeath,
    log: logs.length ? logs : undefined
  });
  r.players.forEach(p => { if (p.readyState === 1) p.send(data) });
}
wss.on('connection', ws => {
  ws.room = null; ws.id = null;
  ws.on('message', buf => {
    try {
      const d = JSON.parse(buf);
      if (d.t === 'create') {
        const c = code();
        rooms[c] = { players: [ws], monsterData: {}, monsters: null, started: false, nextId: 2, colors: {}, colorIdx: 0 };
        ws.room = c; ws.id = 1;
        rooms[c].colors[1] = COLORS[rooms[c].colorIdx++ % 6];
        ws.send(JSON.stringify({ t: 'code', code: c }));
        ws.send(JSON.stringify({ t: 'start', id: 1, color: rooms[c].colors[1] }));
      } else if (d.t === 'join' && d.code) {
        const r = rooms[d.code];
        if (!r) { ws.send(JSON.stringify({ t: 'invalid' })); return }
        if (r.players.length >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: 'full' })); return }
        ws.room = d.code; ws.id = r.nextId++;
        r.colors[ws.id] = COLORS[r.colorIdx++ % 6];
        r.players.push(ws);
        ws.send(JSON.stringify({ t: 'start', id: ws.id, color: r.colors[ws.id] }));
        r.players.forEach(p => p.send(JSON.stringify({ t: 'joined', count: r.players.length })));
      } else if (d.t === 'monster' && ws.room) {
        const r = rooms[ws.room];
        if (d.m) r.monsterData[ws.id] = d.m;
        else if (d.reuse && r.savedShapes && r.savedShapes[ws.id]) r.monsterData[ws.id] = r.savedShapes[ws.id];
        else return;
        const ready = Object.keys(r.monsterData).length;
        r.players.forEach(p => p.send(JSON.stringify({ t: 'status', ready: ready, total: r.players.length })));
        if (ready >= 2 && ready === r.players.length) startArena(ws.room);
      } else if (d.t === 'unready' && ws.room) {
        const r = rooms[ws.room];
        delete r.monsterData[ws.id];
        const ready = Object.keys(r.monsterData).length;
        r.players.forEach(p => p.send(JSON.stringify({ t: 'status', ready: ready, total: r.players.length })));
      } else if (d.t === 'blast' && ws.room) {
        const r = rooms[ws.room];
        if (r && r.monsters && !r.done && r.monsters[ws.id]) {
          if (!r.blasts) r.blasts = [];
          const me = r.monsters[ws.id];
          r.blasts.push({ x: me.x, y: me.y, by: ws.id });
        }
      } else if (d.t === 'ability' && ws.room) {
        const r = rooms[ws.room];
        if (r && r.monsters && !r.done && r.monsters[ws.id]) {
          const me = r.monsters[ws.id];
          if (me.abilityCooldown > 0 || me.ability === 'none') return;
          me.abilityCooldown = me.ability === 'dash' ? 480 : 600;
          if (me.ability === 'dash') {
            // Speed burst
            me.effects.speed = 180; // 3 second super speed
            const vel = Math.hypot(me.vx, me.vy) || 1;
            me.vx = me.vx / vel * 4; me.vy = me.vy / vel * 4;
            r.floatTexts.push({ x: me.x, y: me.y - 30, text: 'DASH!', color: '#0ff' });
          } else if (me.ability === 'block') {
            // Temp invincibility
            me.effects.shield = 240; // ~4 seconds
            r.floatTexts.push({ x: me.x, y: me.y - 30, text: 'BLOCK!', color: '#88f' });
          }
          // absorb is passive, handled in collision
        }
      }
    }
    catch (e) { }
  });
  ws.on('close', () => {
    if (ws.room && rooms[ws.room]) {
      delete rooms[ws.room].monsterData[ws.id];
      if (rooms[ws.room].monsters) delete rooms[ws.room].monsters[ws.id];
      const p = rooms[ws.room].players;
      const i = p.indexOf(ws);
      if (i >= 0) p.splice(i, 1);
      if (p.length === 0) delete rooms[ws.room];
    }
  });
});
setInterval(() => { for (const c of Object.keys(rooms)) tick(c) }, 16);
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => { console.log('Server listening on port ' + PORT) });
