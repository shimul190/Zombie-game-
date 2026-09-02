const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let W = window.innerWidth;
let H = window.innerHeight;

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* Game State */
const SCORE_HISTORY_KEY = "zombieHunterScoreHistory";

const game = {
  running: true,
  paused: false,
  level: 1,
  xp: 0,
  xpNeeded: 100,
  kills: 0,
  coins: 0,
  score: 0,
  wave: 1,
  spawnTimer: 0,
  shake: 0,
  bossAlive: false,
  bossDead: false,
  backgroundTheme: "jungle",
  bossKillCount: 0,
  themes: ["jungle", "dark", "city", "town", "ocean", "hill", "sky", "volcanic"],
  mouse: { x: W / 2, y: H / 2, down: false }
};

/* Player Config */
const player = {
  x: W / 2,
  y: H / 2,
  radius: 38,
  speed: 260,
  health: 100,
  maxHealth: 100,
  damage: 25,
  bulletSpeed: 650,
  fireRate: 170,
  lastShot: 0,
  gunLevel: 1,
  characterLevel: 1,
  shield: false,
  shieldTimer: 0,
  lightningCooldown: 0,
  grenadeCooldown: 0,
  shieldCooldown: 0,
  angle: 0,
  walkTime: 0
};

/* Weapon Definitions */
const guns = {
  1: { name: "PISTOL", type: "pistol", color: "#888888", damage: 25 },
  2: { name: "SHOTGUN", type: "shotgun", color: "#666666", damage: 40 },
  3: { name: "AK-47", type: "ak47", color: "#444444", damage: 55 },
  4: { name: "SNIPER RIFLE", type: "sniper", color: "#333333", damage: 80 },
  5: { name: "CANNON", type: "cannon", color: "#ff9b21", damage: 120 },
  6: { name: "MEGA CANNON", type: "mega", color: "#00ffff", damage: 180 }
};

/* Hero Skins */
const characters = {
  1: { name: "JUNGLE HUNTER", skin: "#9b684b", shirt: "#415d49", pants: "#25382b" },
  2: { name: "ELITE HUNTER", skin: "#9b684b", shirt: "#294d35", pants: "#172b1e" },
  3: { name: "COMMANDER", skin: "#8e6049", shirt: "#254f78", pants: "#142b43" },
  4: { name: "CYBER ELITE", skin: "#87614f", shirt: "#502d72", pants: "#21102e" },
  5: { name: "LEGEND HUNTER", skin: "#774638", shirt: "#762b32", pants: "#280b10" },
  6: { name: "DEMON SLAYER", skin: "#5e3b34", shirt: "#55211f", pants: "#160607" }
};

/* Zombie Config */
const zombieTypes = {
  normal: { name: "Walker", color: "#4f8739", skinColor: "#6ab04c", height: 56, width: 18, health: 55, speed: 60, damage: 8, xp: 20, coins: 2 },
  fast: { name: "Runner", color: "#b89028", skinColor: "#f1c40f", height: 50, width: 16, health: 38, speed: 115, damage: 7, xp: 28, coins: 3 },
  tank: { name: "Mutant", color: "#6b3396", skinColor: "#8e44ad", height: 86, width: 28, health: 220, speed: 40, damage: 18, xp: 60, coins: 8 },
  boss: { name: "JUNGLE BOSS", color: "#9c1c28", skinColor: "#e74c3c", height: 160, width: 50, health: 1200, speed: 30, damage: 30, xp: 350, coins: 50 }
};

/* Entities */
const bullets = [];
const zombies = [];
const particles = [];
const effects = [];
const trees = [];
const keys = {};

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " ") { e.preventDefault(); shoot(); }
  if (e.key.toLowerCase() === "q") useLightning();
  if (e.key.toLowerCase() === "e") useGrenade();
  if (e.key.toLowerCase() === "r") useShield();
  if (e.key === "Escape") togglePause();
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  game.mouse.x = e.clientX - rect.left;
  game.mouse.y = e.clientY - rect.top;
});

canvas.addEventListener("mousedown", e => {
  if (e.button === 0) {
    game.mouse.down = true;
    shoot();
  }
});

window.addEventListener("mouseup", () => {
  game.mouse.down = false;
});

/* Touch bindings */
document.querySelectorAll(".joystick button").forEach(btn => {
  const key = btn.dataset.key;
  btn.addEventListener("touchstart", e => { e.preventDefault(); keys[key] = true; });
  btn.addEventListener("touchend", e => { e.preventDefault(); keys[key] = false; });
  btn.addEventListener("mousedown", () => { keys[key] = true; });
  btn.addEventListener("mouseup", () => { keys[key] = false; });
});

document.getElementById("lightningBtn")?.addEventListener("click", useLightning);
document.getElementById("grenadeBtn")?.addEventListener("click", useGrenade);
document.getElementById("shieldBtn")?.addEventListener("click", useShield);
document.getElementById("pauseBtn")?.addEventListener("click", togglePause);
document.getElementById("restartBtn")?.addEventListener("click", restartGame);

document.getElementById("mobileShoot")?.addEventListener("touchstart", e => { e.preventDefault(); shoot(); });
document.getElementById("mobileLightning")?.addEventListener("touchstart", e => { e.preventDefault(); useLightning(); });
document.getElementById("mobileGrenade")?.addEventListener("touchstart", e => { e.preventDefault(); useGrenade(); });
document.getElementById("mobileShield")?.addEventListener("touchstart", e => { e.preventDefault(); useShield(); });

/* Helper Methods */
function random(min, max) { return Math.random() * (max - min) + min; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function romanize(num) { return ["I","II","III","IV","V","VI"][num - 1] || num; }

const audio = {
  ctx: null,
  unlocked: false,
  master: null
};

function ensureAudio() {
  if (!audio.ctx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    audio.ctx = new AudioCtor();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.9;
    audio.master.connect(audio.ctx.destination);
  }

  if (audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }

  audio.unlocked = true;
}

function playTone({ frequency = 440, duration = 0.12, type = "square", volume = 0.16, slide = 0, delay = 0, attack = 0.01, detune = 0 }) {
  if (!audio.ctx || !audio.unlocked || !audio.master) return;

  const startAt = audio.ctx.currentTime + delay;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  osc.detune.setValueAtTime(detune, startAt);
  if (slide !== 0) {
    osc.frequency.linearRampToValueAtTime(Math.max(30, frequency + slide), startAt + duration);
  }

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.04);
}

function playNoiseBurst({ duration = 0.12, volume = 0.12, delay = 0, highpass = 300, lowpass = 5000, attack = 0.01 }) {
  if (!audio.ctx || !audio.unlocked || !audio.master) return;

  const startAt = audio.ctx.currentTime + delay;
  const buffer = audio.ctx.createBuffer(1, Math.ceil(audio.ctx.sampleRate * duration), audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const envelope = 1 - (i / data.length);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const source = audio.ctx.createBufferSource();
  const filter = audio.ctx.createBiquadFilter();
  const gain = audio.ctx.createGain();

  filter.type = "highpass";
  filter.frequency.setValueAtTime(highpass, startAt);
  filter.Q.value = 0.8;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  source.start(startAt);
  source.stop(startAt + duration + 0.03);
}

function playGunShot(gunLevel = 1) {
  ensureAudio();
  const profiles = {
    1: { base: 120, slide: 140, noise: 0.08, tone: 0.12, duration: 0.1, type: "square" },
    2: { base: 90, slide: 200, noise: 0.11, tone: 0.14, duration: 0.14, type: "sawtooth" },
    3: { base: 80, slide: 180, noise: 0.14, tone: 0.18, duration: 0.12, type: "sawtooth" },
    4: { base: 60, slide: 150, noise: 0.15, tone: 0.16, duration: 0.16, type: "triangle" },
    5: { base: 45, slide: 120, noise: 0.18, tone: 0.2, duration: 0.18, type: "sawtooth" },
    6: { base: 35, slide: 100, noise: 0.22, tone: 0.24, duration: 0.2, type: "sawtooth" }
  };

  const config = profiles[gunLevel] || profiles[1];
  playTone({ frequency: config.base, duration: config.duration, type: config.type, volume: config.tone, slide: config.slide, attack: 0.005, detune: -4 });
  playNoiseBurst({ duration: config.duration * 1.2, volume: config.noise, delay: 0.01, highpass: 400, lowpass: 7000, attack: 0.006 });
}

function playHitSound() {
  ensureAudio();
  playTone({ frequency: 180, duration: 0.05, type: "triangle", volume: 0.11, slide: -35, attack: 0.004 });
  playNoiseBurst({ duration: 0.07, volume: 0.07, delay: 0.01, highpass: 700, attack: 0.002 });
}

function playExplosionSound(isBoss = false) {
  ensureAudio();
  playTone({ frequency: isBoss ? 50 : 100, duration: isBoss ? 0.45 : 0.2, type: "sawtooth", volume: isBoss ? 0.22 : 0.13, slide: isBoss ? 220 : 160, attack: 0.01 });
  playNoiseBurst({ duration: isBoss ? 0.55 : 0.22, volume: isBoss ? 0.22 : 0.12, delay: 0.02, highpass: 160, attack: 0.004 });
  if (isBoss) {
    playTone({ frequency: 30, duration: 0.6, type: "square", volume: 0.15, slide: 90, delay: 0.08, attack: 0.03 });
  }
}

function playLevelUpSound() {
  ensureAudio();
  playTone({ frequency: 440, duration: 0.12, type: "triangle", volume: 0.18, slide: 80, attack: 0.008 });
  playTone({ frequency: 660, duration: 0.16, type: "triangle", volume: 0.2, slide: 120, delay: 0.07, attack: 0.008 });
  playTone({ frequency: 880, duration: 0.2, type: "triangle", volume: 0.18, slide: 140, delay: 0.12, attack: 0.01 });
}

function playAbilitySound(frequency, type = "square", volume = 0.18) {
  ensureAudio();
  playTone({ frequency, duration: 0.22, type, volume, slide: 180, attack: 0.005 });
  playTone({ frequency: frequency * 1.5, duration: 0.2, type: "triangle", volume: volume * 0.9, slide: 160, delay: 0.04, attack: 0.005 });
  playNoiseBurst({ duration: 0.18, volume: volume * 0.6, delay: 0.02, highpass: 250, attack: 0.004 });
}

function playGameOverSound() {
  ensureAudio();
  playTone({ frequency: 220, duration: 0.2, type: "sawtooth", volume: 0.2, slide: -70, attack: 0.01 });
  playTone({ frequency: 140, duration: 0.34, type: "sawtooth", volume: 0.18, slide: -120, delay: 0.1, attack: 0.02 });
  playNoiseBurst({ duration: 0.3, volume: 0.14, delay: 0.05, highpass: 180, attack: 0.01 });
}

function playShieldSound() {
  ensureAudio();
  playTone({ frequency: 330, duration: 0.18, type: "triangle", volume: 0.15, slide: 100, attack: 0.01 });
  playTone({ frequency: 520, duration: 0.22, type: "sine", volume: 0.12, slide: 80, delay: 0.06, attack: 0.01 });
}

function playZombieSound(type = "normal", variant = "groan") {
  ensureAudio();

  const profiles = {
    normal: {
      groan: { base: 90, slide: -40, duration: 0.25, type: "triangle", volume: 0.12 },
      death: { base: 60, slide: -90, duration: 0.18, type: "sawtooth", volume: 0.12 },
      attack: { base: 120, slide: -20, duration: 0.12, type: "square", volume: 0.08 }
    },
    fast: {
      groan: { base: 180, slide: -60, duration: 0.2, type: "triangle", volume: 0.1 },
      death: { base: 150, slide: -110, duration: 0.16, type: "sawtooth", volume: 0.1 },
      attack: { base: 220, slide: -50, duration: 0.1, type: "square", volume: 0.08 }
    },
    tank: {
      groan: { base: 55, slide: -25, duration: 0.35, type: "sawtooth", volume: 0.14 },
      death: { base: 35, slide: -110, duration: 0.28, type: "square", volume: 0.15 },
      attack: { base: 70, slide: -15, duration: 0.15, type: "triangle", volume: 0.1 }
    },
    boss: {
      groan: { base: 36, slide: -15, duration: 0.52, type: "sawtooth", volume: 0.2 },
      death: { base: 25, slide: -160, duration: 0.5, type: "square", volume: 0.22 },
      attack: { base: 45, slide: -35, duration: 0.2, type: "triangle", volume: 0.18 },
      spawn: { base: 52, slide: 110, duration: 0.7, type: "sawtooth", volume: 0.22 }
    }
  };

  const config = profiles[type]?.[variant] || profiles.normal.groan;
  playTone({
    frequency: config.base,
    duration: config.duration,
    type: config.type,
    volume: config.volume,
    slide: config.slide,
    attack: variant === "death" ? 0.02 : 0.01
  });

  if (variant !== "death") {
    playNoiseBurst({ duration: config.duration * 0.8, volume: config.volume * 0.6, delay: 0.03, highpass: type === "boss" ? 40 : 120, attack: 0.01 });
  }
}

window.addEventListener("pointerdown", ensureAudio, { once: true });
window.addEventListener("keydown", ensureAudio, { once: true });

function createExplosion(x, y, color, count = 20) {
  for (let i = 0; i < count; i++) {
    const angle = random(0, Math.PI * 2);
    const speed = random(50, 250);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: random(2, 5),
      color: color,
      alpha: 1,
      life: random(0.3, 0.7)
    });
  }
}

function generateJungle() {
  trees.length = 0;
  for (let i = 0; i < 100; i++) {
    trees.push({
      x: random(-50, W + 50),
      y: random(-50, H + 50),
      size: random(30, 70)
    });
  }
}
generateJungle();

function spawnZombie(type = null) {
  const edge = Math.floor(random(0, 4));
  let x, y;

  if (edge === 0) { x = random(0, W); y = -80; }
  else if (edge === 1) { x = W + 80; y = random(0, H); }
  else if (edge === 2) { x = random(0, W); y = H + 80; }
  else { x = -80; y = random(0, H); }

  if (!type) {
    const roll = Math.random();
    type = "normal";
    if (game.level >= 3 && roll < 0.25) type = "fast";
    if (game.level >= 5 && roll < 0.12) type = "tank";
  }

  const data = zombieTypes[type];
  const mult = 1 + (game.level - 1) * 0.15;
  const hp = data.health * mult;

  zombies.push({
    type,
    x, y,
    height: data.height,
    width: data.width,
    radius: data.height / 2,
    health: hp,
    maxHealth: hp,
    speed: data.speed * (1 + (game.level - 1) * 0.02),
    damage: data.damage * mult,
    color: data.color,
    skinColor: data.skinColor,
    angle: 0,
    hitFlash: 0,
    walkAnim: random(0, 100),
    isBoss: type === "boss"
  });
}

function spawnBoss() {
  if (game.bossAlive) return;
  game.bossAlive = true;
  spawnZombie("boss");

  const boss = zombies[zombies.length - 1];
  boss.health *= 1 + game.level * 0.2;
  boss.maxHealth = boss.health;
  playZombieSound("boss", "spawn");

  showBossWarning();
  updateBossBar();
}

function showBossWarning() {
  // Boss warning message removed
}

function updateBossBar() {
  const bossBar = document.getElementById("bossBar");
  const boss = zombies.find(z => z.isBoss);

  if (bossBar && boss) {
    bossBar.classList.add("active");
    document.getElementById("bossName").innerText = boss.type.toUpperCase();
    document.getElementById("bossLevel").innerText = `BOSS LV ${game.level}`;
    document.getElementById("bossHealthText").innerText = `${Math.ceil(boss.health)} / ${Math.ceil(boss.maxHealth)}`;
    document.getElementById("bossHealthFill").style.width = Math.max(0, (boss.health / boss.maxHealth) * 100) + "%";
  } else if (bossBar) {
    bossBar.classList.remove("active");
  }
}

function shoot() {
  const now = Date.now();
  if (now - player.lastShot < player.fireRate) return;
  player.lastShot = now;

  const angle = Math.atan2(game.mouse.y - player.y, game.mouse.x - player.x);
  const gun = guns[player.gunLevel];
  const barrelLength = 16;

  const barrelTipX = player.x + Math.cos(angle) * (barrelLength + 8);
  const barrelTipY = player.y + Math.sin(angle) * (barrelLength + 8);

  bullets.push({
    x: barrelTipX,
    y: barrelTipY,
    vx: Math.cos(angle) * player.bulletSpeed,
    vy: Math.sin(angle) * player.bulletSpeed,
    radius: 5 + player.gunLevel,
    damage: player.damage,
    color: gun.color
  });

  for (let i = 0; i < 5; i++) {
    particles.push({
      x: barrelTipX,
      y: barrelTipY,
      vx: Math.cos(angle + random(-0.3, 0.3)) * random(50, 150),
      vy: Math.sin(angle + random(-0.3, 0.3)) * random(50, 150),
      radius: random(2, 4),
      color: "#fff",
      alpha: 1,
      life: 0.1
    });
  }

  playGunShot(player.gunLevel);
  game.shake = Math.min(game.shake + 3, 9);
}

function useLightning() {
  if (player.lightningCooldown > 0) return;
  player.lightningCooldown = 12;

  playAbilitySound(520, "sawtooth", 0.07);

  zombies.forEach(z => {
    // Kill all zombies except boss
    if (!z.isBoss) {
      z.health = 0;
    } else {
      // Boss takes damage
      if (distance(player, z) < 450) {
        z.health -= player.damage * 2.8;
        z.hitFlash = 0.2;
      }
    }
    // Show lightning effect for all zombies
    if (distance(player, z) < 500) {
      effects.push({ type: "lightning", x1: player.x, y1: player.y, x2: z.x, y2: z.y, life: 0.2 });
    }
  });
  game.shake = 12;
}

function useGrenade() {
  if (player.grenadeCooldown > 0) return;
  player.grenadeCooldown = 8;

  const angle = player.angle;
  const targetX = player.x + Math.cos(angle) * 220;
  const targetY = player.y + Math.sin(angle) * 220;

  effects.push({
    type: "grenade",
    x: targetX,
    y: targetY,
    radius: 0,
    maxRadius: 140,
    damage: player.damage * 4.5,
    life: 0.4
  });

  playAbilitySound(180, "sawtooth", 0.06);
  createExplosion(targetX, targetY, "#ff6b00", 35);
  playExplosionSound(false);
  game.shake = 15;
}

function useShield() {
  if (player.shieldCooldown > 0) return;
  player.shield = true;
  player.shieldTimer = 6;
  player.shieldCooldown = 18;
  playShieldSound();
}

function getScoreHistory() {
  try {
    const saved = localStorage.getItem(SCORE_HISTORY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveScoreHistory(history) {
  try {
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(history.slice(-25)));
  } catch {
    // Ignore storage errors in restricted browsers.
  }
}

function getHighScore() {
  const history = getScoreHistory();
  return history.reduce((best, entry) => Math.max(best, Number(entry.score) || 0), 0);
}

function recalculateScore() {
  game.score = Math.floor(game.kills * 120 + game.coins * 35 + (game.level - 1) * 250 + game.xp);
}

function addXP(amount) {
  game.xp += amount;
  if (game.xp >= game.xpNeeded) {
    game.xp -= game.xpNeeded;
    game.level++;
    game.xpNeeded = Math.floor(game.xpNeeded * 1.35);

    player.characterLevel = Math.min(6, Math.floor((game.level - 1) / 2) + 1);
    player.gunLevel = Math.min(6, Math.floor((game.level - 1) / 2) + 1);
    player.damage = 25 + (game.level - 1) * 12;
    player.maxHealth += 15;
    player.health = player.maxHealth;

    playLevelUpSound();
    showLevelIndicator();

    if (game.level % 3 === 0) {
      spawnBoss();
    }
  }
  recalculateScore();
  updateUI();
}

function upgradeBossGun() {
  if (player.gunLevel < 6) {
    player.gunLevel++;
    const gun = guns[player.gunLevel];
    player.damage += gun.damage;
    updateUI();
  }
}

function showLevelIndicator() {
  // Level up message removed
}

function updateUI() {
  recalculateScore();
  document.getElementById("healthText").innerText = `${Math.ceil(Math.max(0, player.health))} / ${player.maxHealth}`;
  document.getElementById("healthFill").style.width = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;
  document.getElementById("levelText").innerText = game.level;
  document.getElementById("killText").innerText = game.kills;
  document.getElementById("waveText").innerText = game.wave;
  document.getElementById("coinText").innerText = game.coins;

  document.getElementById("xpText").innerText = `${game.xp} / ${game.xpNeeded}`;
  document.getElementById("xpFill").style.width = `${Math.min(100, (game.xp / game.xpNeeded) * 100)}%`;

  const char = characters[player.characterLevel];
  const gun = guns[player.gunLevel];

  document.getElementById("characterName").innerText = char.name;
  document.getElementById("gunName").innerText = gun.name;
  document.getElementById("characterLevelText").innerText = romanize(player.characterLevel);
  document.getElementById("gunLevelText").innerText = romanize(player.gunLevel);
  document.getElementById("bulletSpeedText").innerText = player.bulletSpeed;
  document.getElementById("damageText").innerText = player.damage;

  updateCooldownUI("lightningCooldown", player.lightningCooldown, 12);
  updateCooldownUI("grenadeCooldown", player.grenadeCooldown, 8);
  updateCooldownUI("shieldCooldown", player.shieldCooldown, 18);
}

function updateCooldownUI(id, current, max) {
  const el = document.getElementById(id);
  if (el) el.style.height = `${Math.max(0, (current / max) * 100)}%`;
}

function togglePause() { game.paused = !game.paused; }

function gameOver() {
  game.running = false;
  recalculateScore();

  const history = getScoreHistory();
  history.push({
    score: game.score,
    kills: game.kills,
    level: game.level,
    date: new Date().toISOString()
  });
  saveScoreHistory(history);

  const bestScore = getHighScore();
  playGameOverSound();
  document.getElementById("messageText").innerText = `Score: ${game.score} | Kills: ${game.kills} | Level: ${game.level}\nHigh Score: ${bestScore}`;
  document.getElementById("message").classList.remove("hidden");
}

function restartGame() {
  game.running = true;
  game.paused = false;
  game.level = 1;
  game.xp = 0;
  game.xpNeeded = 100;
  game.kills = 0;
  game.coins = 0;
  game.score = 0;
  game.wave = 1;
  game.bossAlive = false;
  game.bossDead = false;
  game.bossKillCount = 0;
  game.backgroundTheme = "jungle";

  player.health = 100;
  player.maxHealth = 100;
  player.damage = 25;
  player.gunLevel = 1;
  player.characterLevel = 1;
  player.x = W / 2;
  player.y = H / 2;

  bullets.length = 0;
  zombies.length = 0;
  particles.length = 0;
  effects.length = 0;

  document.getElementById("message").classList.add("hidden");
  updateUI();
  updateBossBar();
}

function update(dt) {
  if (!game.running || game.paused) return;

  let dx = 0;
  let dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;

  if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;
  player.x = Math.max(player.radius, Math.min(W - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(H - player.radius, player.y));

  if (dx !== 0 || dy !== 0) player.walkTime += dt * 10;

  player.angle = Math.atan2(game.mouse.y - player.y, game.mouse.x - player.x);
  if (game.mouse.down) shoot();

  if (player.lightningCooldown > 0) player.lightningCooldown = Math.max(0, player.lightningCooldown - dt);
  if (player.grenadeCooldown > 0) player.grenadeCooldown = Math.max(0, player.grenadeCooldown - dt);
  if (player.shieldCooldown > 0) player.shieldCooldown = Math.max(0, player.shieldCooldown - dt);

  if (player.shield) {
    player.shieldTimer -= dt;
    if (player.shieldTimer <= 0) player.shield = false;
  }

  game.spawnTimer += dt;
  const currentSpawnRate = Math.max(0.4, 1.8 - game.level * 0.1);
  if (game.spawnTimer >= currentSpawnRate) {
    game.spawnTimer = 0;
    if (zombies.length < 45) spawnZombie();
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
      bullets.splice(i, 1);
    }
  }

  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    const angle = Math.atan2(player.y - z.y, player.x - z.x);

    z.angle = angle;
    z.x += Math.cos(angle) * z.speed * dt;
    z.y += Math.sin(angle) * z.speed * dt;
    z.walkAnim += dt * 8;
    if (z.hitFlash > 0) z.hitFlash -= dt;

    if (distance(player, z) < player.radius + z.width) {
      if (!player.shield) {
        player.health -= z.damage * dt;
        playHitSound();
        playZombieSound(z.type, "attack");
        game.shake = Math.min(game.shake + 1, 6);
        if (player.health <= 0) gameOver();
      }
    }

    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (distance(b, z) < b.radius + z.width) {
        z.health -= b.damage;
        z.hitFlash = 0.15;

        for (let k = 0; k < 3; k++) {
          particles.push({
            x: b.x, y: b.y,
            vx: random(-60, 60), vy: random(-60, 60),
            radius: random(1.5, 3),
            color: z.color, alpha: 1, life: 0.25
          });
        }

        bullets.splice(j, 1);

        if (z.health <= 0) {
          createExplosion(z.x, z.y, z.color, z.isBoss ? 50 : 18);
          playExplosionSound(z.isBoss);
          playZombieSound(z.type, "death");
          addXP(zombieTypes[z.type].xp);
          game.kills++;
          game.coins += zombieTypes[z.type].coins;

          if (z.isBoss) {
            game.bossAlive = false;
            game.bossDead = true;
            game.bossKillCount++;
            // Cycle through themes: jungle -> dark -> city -> town -> ocean -> hill -> sky -> volcanic -> jungle
            const themeIndex = (game.bossKillCount) % game.themes.length;
            game.backgroundTheme = game.themes[themeIndex];
            upgradeBossGun();
            updateBossBar();
          }

          zombies.splice(i, 1);
          break;
        }
      }
    }
  }

  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i];
    eff.life -= dt;
    if (eff.type === "grenade") {
      eff.radius += (eff.maxRadius / 0.4) * dt;
      zombies.forEach(z => {
        if (distance(eff, z) < eff.radius + z.width) {
          z.health -= eff.damage * dt;
          z.hitFlash = 0.1;
        }
      });
    }
    if (eff.life <= 0) effects.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alpha -= dt / p.life;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  if (game.shake > 0) {
    game.shake -= dt * 25;
    if (game.shake < 0) game.shake = 0;
  }

  updateUI();
  if (game.bossAlive) updateBossBar();
}

function drawGun(ctx, gunType, side = "right") {
  let baseX = side === "right" ? 10 : -18;
  const baseY = 6;

  ctx.save();

  switch (gunType) {
    case "pistol":
      // Pistol: small compact gun
      ctx.fillStyle = "#888888";
      ctx.fillRect(baseX, baseY - 2, 12, 4);
      ctx.fillRect(baseX + 10, baseY - 3, 2, 6);
      ctx.fillStyle = "#444444";
      ctx.fillRect(baseX + 1, baseY - 1, 3, 2);
      break;

    case "shotgun":
      // Shotgun: wider barrel
      ctx.fillStyle = "#666666";
      ctx.fillRect(baseX, baseY - 3, 16, 6);
      ctx.fillStyle = "#444444";
      ctx.fillRect(baseX + 1, baseY - 2, 4, 4);
      ctx.fillStyle = "#555555";
      ctx.beginPath();
      ctx.arc(baseX + 14, baseY, 3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "ak47":
      // AK-47: rifle with stock
      ctx.fillStyle = "#444444";
      ctx.fillRect(baseX, baseY - 2, 20, 4);
      ctx.fillStyle = "#333333";
      ctx.fillRect(baseX - 3, baseY + 2, 5, 3);
      ctx.fillRect(baseX + 5, baseY - 4, 8, 2);
      ctx.fillStyle = "#222222";
      ctx.fillRect(baseX + 1, baseY - 1, 3, 2);
      break;

    case "sniper":
      // Sniper rifle: long barrel with scope
      ctx.fillStyle = "#333333";
      ctx.fillRect(baseX, baseY - 2, 26, 4);
      ctx.fillStyle = "#555555";
      ctx.beginPath();
      ctx.arc(baseX + 8, baseY - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#666666";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#222222";
      ctx.fillRect(baseX + 1, baseY - 1, 3, 2);
      break;

    case "cannon":
      // Cannon: large and powerful
      ctx.fillStyle = "#ff9b21";
      ctx.fillRect(baseX, baseY - 4, 18, 8);
      ctx.fillStyle = "#cc7a0d";
      ctx.fillRect(baseX - 2, baseY - 2, 4, 4);
      ctx.fillStyle = "#ffb84d";
      ctx.beginPath();
      ctx.arc(baseX + 16, baseY, 4, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "mega":
      // Mega cannon: huge powerful gun
      ctx.fillStyle = "#00ffff";
      ctx.fillRect(baseX, baseY - 5, 22, 10);
      ctx.fillStyle = "#0099cc";
      ctx.fillRect(baseX - 2, baseY - 3, 5, 6);
      ctx.fillStyle = "#00ffff";
      ctx.beginPath();
      ctx.arc(baseX + 20, baseY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#00ccff";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
  }

  ctx.restore();
}

function drawPlayer(ctx) {
  const char = characters[player.characterLevel];
  const gun = guns[player.gunLevel];

  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.shield) {
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.rotate(player.angle);

  const legSwing = Math.sin(player.walkTime) * 8;

  // Draw Legs
  ctx.fillStyle = char.pants;
  ctx.fillRect(-5, 8 + legSwing, 5, 18);
  ctx.fillRect(0, 8 - legSwing, 5, 18);

  // Draw Torso (Body)
  ctx.fillStyle = char.shirt;
  ctx.fillRect(-8, 0, 16, 14);

  // Draw Arms (now following the gun angle/mouse direction)
  ctx.fillStyle = char.skin;
  // Right arm holds gun
  ctx.fillRect(8, 2, 4, 12);
  // Left arm (dual gun for pistols)
  if (player.gunLevel <= 2) {
    ctx.fillRect(-12, 2, 4, 12);
  } else {
    ctx.fillRect(-12, 2, 4, 12);
  }

  // Draw Dual Guns for Pistols (Level 1-2)
  if (player.gunLevel === 1 || player.gunLevel === 2) {
    drawGun(ctx, gun.type, "right");
    drawGun(ctx, gun.type, "left");
  } else {
    // Single gun for other weapons
    drawGun(ctx, gun.type, "right");
  }

  // Draw Head
  ctx.fillStyle = char.skin;
  ctx.beginPath();
  ctx.arc(0, -8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0d1a10";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw Eyes
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(-3, -9, 2, 0, Math.PI * 2);
  ctx.arc(3, -9, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawZombie(ctx, z) {
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(z.angle);

  const bodyScale = z.width / 16;
  const legSwing = Math.sin(z.walkAnim) * 5;
  const armSwing = Math.sin(z.walkAnim) * 7;

  // Draw Legs
  ctx.fillStyle = z.hitFlash > 0 ? "#ffffff" : z.color;
  ctx.fillRect(-4 * bodyScale, 6 * bodyScale + legSwing, 4 * bodyScale, 14 * bodyScale);
  ctx.fillRect(0, 6 * bodyScale - legSwing, 4 * bodyScale, 14 * bodyScale);

  // Draw Torso
  ctx.fillStyle = z.hitFlash > 0 ? "#ffffff" : z.color;
  ctx.fillRect(-7 * bodyScale, 0, 14 * bodyScale, 12 * bodyScale);

  // Draw Arms
  ctx.fillStyle = z.hitFlash > 0 ? "#ffffff" : z.skinColor;
  ctx.fillRect(-12 * bodyScale, 2 * bodyScale + armSwing, 4 * bodyScale, 10 * bodyScale);
  ctx.fillRect(8 * bodyScale, 2 * bodyScale - armSwing, 4 * bodyScale, 10 * bodyScale);

  // Draw Head
  ctx.fillStyle = z.hitFlash > 0 ? "#ffffff" : z.skinColor;
  ctx.beginPath();
  ctx.arc(0, -7 * bodyScale, 6 * bodyScale, 0, Math.PI * 2);
  ctx.fill();

  // Draw Eyes (zombified look)
  ctx.fillStyle = z.hitFlash > 0 ? "#fff" : "#000";
  ctx.beginPath();
  ctx.arc(-2.5 * bodyScale, -8 * bodyScale, 1.5 * bodyScale, 0, Math.PI * 2);
  ctx.arc(2.5 * bodyScale, -8 * bodyScale, 1.5 * bodyScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEnvironment() {
  if (game.backgroundTheme === "jungle") {
    // Original jungle theme - Green and natural
    ctx.fillStyle = "#09170d";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(40, 80, 50, 0.15)";
    ctx.lineWidth = 1;
    const step = 80;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    trees.forEach(t => {
      ctx.fillStyle = "rgba(15, 45, 25, 0.4)";
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (game.backgroundTheme === "dark") {
    // Dark forest theme - ominous
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255, 50, 50, 0.1)";
    ctx.lineWidth = 1;
    const step = 80;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    trees.forEach(t => {
      ctx.fillStyle = "rgba(40, 10, 10, 0.5)";
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Red fog effect
    ctx.fillStyle = "rgba(200, 30, 30, 0.05)";
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(Math.random() * W, Math.random() * H, 100, 100);
    }
  } else if (game.backgroundTheme === "city") {
    // City theme - Urban buildings and concrete
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, W, H);

    // Draw buildings as rectangles
    ctx.fillStyle = "#3a3a3a";
    for (let i = 0; i < 6; i++) {
      const buildingX = (i * 250) - 100;
      const buildingHeight = 150 + Math.random() * 200;
      ctx.fillRect(buildingX, H - buildingHeight, 200, buildingHeight);
      
      // Windows
      ctx.fillStyle = "#ffff99";
      for (let row = 0; row < Math.ceil(buildingHeight / 40); row++) {
        for (let col = 0; col < 5; col++) {
          ctx.fillRect(buildingX + col * 35 + 5, H - buildingHeight + row * 40 + 5, 20, 15);
        }
      }
      ctx.fillStyle = "#3a3a3a";
    }

    // Grid pattern
    ctx.strokeStyle = "rgba(100, 100, 100, 0.2)";
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  } else if (game.backgroundTheme === "town") {
    // Town theme - Rustic/wooden houses
    ctx.fillStyle = "#4a6b4d";
    ctx.fillRect(0, 0, W, H);

    // Draw houses
    ctx.fillStyle = "#8b6d47";
    for (let i = 0; i < 4; i++) {
      const houseX = (i * 300) - 50;
      const roofX = [houseX + 30, houseX + 100, houseX + 170];
      
      // House wall
      ctx.fillRect(houseX + 20, H - 180, 150, 150);
      
      // Roof (triangle)
      ctx.fillStyle = "#a0522d";
      ctx.beginPath();
      ctx.moveTo(houseX + 20, H - 180);
      ctx.lineTo(houseX + 95, H - 250);
      ctx.lineTo(houseX + 170, H - 180);
      ctx.fill();
      
      // Door
      ctx.fillStyle = "#654321";
      ctx.fillRect(houseX + 80, H - 100, 30, 80);
    }

    // Grass/trees
    ctx.fillStyle = "rgba(50, 120, 50, 0.3)";
    trees.forEach(t => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (game.backgroundTheme === "ocean") {
    // Ocean theme - Water and waves
    ctx.fillStyle = "#001a4d";
    ctx.fillRect(0, 0, W, H);

    // Water waves
    ctx.strokeStyle = "rgba(100, 200, 255, 0.3)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const waveOffset = (performance.now() / 100 + i * 0.5) % W;
      ctx.beginPath();
      ctx.moveTo(0, H / 2 + i * 30 + Math.sin(waveOffset / 20) * 10);
      for (let x = 0; x < W; x += 10) {
        ctx.lineTo(x, H / 2 + i * 30 + Math.sin((x + waveOffset) / 20) * 10);
      }
      ctx.stroke();
    }

    // Sand/island at bottom
    ctx.fillStyle = "#d4a574";
    ctx.fillRect(0, H - 80, W, 80);

    // Rocks/islands
    ctx.fillStyle = "#888888";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(W / 3 + i * 150, H / 3 + Math.random() * 100, 40 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (game.backgroundTheme === "hill") {
    // Hill theme - Rolling hills and grass
    ctx.fillStyle = "#87ceeb";
    ctx.fillRect(0, 0, W, H / 2);
    
    ctx.fillStyle = "#228b22";
    ctx.fillRect(0, H / 2, W, H / 2);

    // Rolling hills
    ctx.fillStyle = "rgba(34, 139, 34, 0.6)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(W / 4 + i * 200, H / 2 + 30 + i * 20, 200, 80, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Trees on hills
    trees.forEach(t => {
      ctx.fillStyle = "rgba(0, 100, 0, 0.7)";
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (game.backgroundTheme === "sky") {
    // Sky theme - Clouds and atmosphere
    ctx.fillStyle = "linear-gradient(180deg, #87ceeb 0%, #e0f6ff 100%)";
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#4a90e2");
    gradient.addColorStop(0.5, "#87ceeb");
    gradient.addColorStop(1, "#e0f6ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Draw clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let i = 0; i < 5; i++) {
      const cloudX = (i * 250 + performance.now() / 500) % (W + 200);
      // Cloud shape with circles
      ctx.beginPath();
      ctx.arc(cloudX, 100 + i * 80, 40, 0, Math.PI * 2);
      ctx.arc(cloudX + 50, 100 + i * 80, 50, 0, Math.PI * 2);
      ctx.arc(cloudX + 100, 100 + i * 80, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grid pattern
    ctx.strokeStyle = "rgba(100, 150, 200, 0.1)";
    ctx.lineWidth = 1;
    const step = 80;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  } else if (game.backgroundTheme === "volcanic") {
    // Volcanic theme - Lava and fire
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, W, H);

    // Lava flows
    ctx.fillStyle = "rgba(255, 100, 0, 0.6)";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, H - i * 150);
      for (let x = 0; x < W; x += 20) {
        ctx.lineTo(x, H - i * 150 + Math.sin(x / 50) * 40);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
    }

    // Rocks
    ctx.fillStyle = "#444444";
    trees.forEach(t => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Fire glow
    ctx.fillStyle = "rgba(255, 150, 50, 0.1)";
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(Math.random() * W, Math.random() * H, 150, 150);
    }
  }
}

function render() {
  ctx.save();

  if (game.shake > 0) {
    const rx = (Math.random() - 0.5) * game.shake;
    const ry = (Math.random() - 0.5) * game.shake;
    ctx.translate(rx, ry);
  }

  drawEnvironment();

  bullets.forEach(b => {
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  effects.forEach(eff => {
    if (eff.type === "lightning") {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(eff.x1, eff.y1);
      ctx.lineTo(eff.x2, eff.y2);
      ctx.stroke();
    } else if (eff.type === "grenade") {
      ctx.fillStyle = "rgba(255, 107, 0, 0.35)";
      ctx.strokeStyle = "#ff6b00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  });

  zombies.forEach(z => drawZombie(ctx, z));
  drawPlayer(ctx);

  particles.forEach(p => {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

updateUI();
requestAnimationFrame(loop);