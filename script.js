const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  overlay: document.getElementById("overlay"),
  overlayKicker: document.getElementById("overlay-kicker"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayCopy: document.getElementById("overlay-copy"),
  actionButton: document.getElementById("action-button"),
  distance: document.getElementById("distance-value"),
  combo: document.getElementById("combo-value"),
  speed: document.getElementById("speed-value"),
  best: document.getElementById("best-value"),
  style: document.getElementById("style-value"),
  energyFill: document.getElementById("energy-fill"),
  mobileButtons: Array.from(document.querySelectorAll(".mobile-button")),
};

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  gravity: 2280,
};

const COLORS = {
  skyTop: "#1f0908",
  skyMid: "#6d2612",
  skyBottom: "#160909",
  rooftop: "#241210",
  rooftopFace: "#3a1814",
  roofEdge: "#ff9b64",
  window: "rgba(255, 198, 118, 0.16)",
  player: "#fff3e6",
  playerAccent: "#39f2c2",
  accentSoft: "#ffd166",
  trail: "rgba(57, 242, 194, 0.16)",
  shard: "#ffd166",
  barrier: "#ff7a2f",
  drone: "#ff5b5b",
  text: "#fff3e6",
};

const input = {
  jumpBuffered: false,
};

const skylineLayers = createSkylineLayers();

const state = {
  status: "ready",
  time: 0,
  distance: 0,
  style: 0,
  combo: 1,
  comboTimer: 0,
  speed: 410,
  speedTarget: 410,
  energy: 100,
  score: 0,
  bestScore: loadBestScore(),
  platforms: [],
  obstacles: [],
  particles: [],
  callouts: [],
  lastTime: 0,
};

const player = {
  x: 244,
  y: 0,
  width: 54,
  height: 86,
  vy: 0,
  onGround: false,
  jumpsAvailable: 2,
  coyote: 0,
  dashTimer: 0,
  trail: [],
  tilt: 0,
  squash: 0,
};

function loadBestScore() {
  try {
    return Number(localStorage.getItem("roofline-rush-best") || 0);
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem("roofline-rush-best", String(value));
  } catch {
    return;
  }
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function createSkylineLayers() {
  const configs = [
    { color: "rgba(23, 9, 10, 0.38)", baseY: 356, speed: 0.14, min: 70, max: 170, minW: 42, maxW: 96 },
    { color: "rgba(28, 11, 11, 0.54)", baseY: 432, speed: 0.27, min: 120, max: 240, minW: 64, maxW: 124 },
    { color: "rgba(20, 7, 9, 0.82)", baseY: 515, speed: 0.42, min: 150, max: 300, minW: 90, maxW: 154 },
  ];

  return configs.map((config) => {
    const buildings = [];
    let x = 0;
    while (x < 2600) {
      const width = Math.round(random(config.minW, config.maxW));
      buildings.push({
        x,
        width,
        height: Math.round(random(config.min, config.max)),
        cap: Math.random() < 0.38,
        beacon: Math.random() < 0.22,
      });
      x += width + Math.round(random(18, 34));
    }
    return {
      ...config,
      cycle: x + 60,
      buildings,
    };
  });
}

function resetGame() {
  state.time = 0;
  state.distance = 0;
  state.style = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.speed = 410;
  state.speedTarget = 410;
  state.energy = 100;
  state.score = 0;
  state.platforms = [
    createPlatform(-160, 548, 460),
    createPlatform(420, 516, 310),
    createPlatform(864, 560, 360),
  ];
  state.obstacles = [];
  state.particles = [];
  state.callouts = [];

  player.y = state.platforms[0].y - player.height;
  player.vy = 0;
  player.onGround = true;
  player.jumpsAvailable = 2;
  player.coyote = 0;
  player.dashTimer = 0;
  player.trail = [];
  player.tilt = 0;
  player.squash = 0;

  while (state.platforms[state.platforms.length - 1].x + state.platforms[state.platforms.length - 1].width < WORLD.width + 520) {
    generateNextPlatform();
  }

  updateUI();
}

function createPlatform(x, y, width) {
  return {
    x,
    y,
    width,
    thickness: WORLD.height - y + 80,
  };
}

function generateNextPlatform() {
  const last = state.platforms[state.platforms.length - 1];
  const tension = clamp(1 + state.distance / 3200, 1, 2.3);
  const gap = random(110, 180 + tension * 24);
  const width = random(220, 410 - tension * 18);
  const nextY = clamp(last.y + random(-68, 72), 372, 576);
  const platform = createPlatform(last.x + last.width + gap, nextY, width);
  state.platforms.push(platform);
  spawnObjectsForPlatform(platform, tension);
}

function spawnObjectsForPlatform(platform, tension) {
  const lane = platform.width - 140;
  if (lane < 80) {
    return;
  }

  const roll = Math.random();
  if (roll < 0.42 + tension * 0.05) {
    state.obstacles.push({
      type: "barrier",
      x: platform.x + random(84, platform.width - 84),
      y: platform.y - random(58, 98),
      width: random(34, 54),
      height: random(58, 98),
      alive: true,
    });
  } else if (roll < 0.67 + tension * 0.05) {
    state.obstacles.push({
      type: "drone",
      x: platform.x + random(82, platform.width - 86),
      y: platform.y - random(112, 164),
      width: 72,
      height: 28,
      phase: random(0, Math.PI * 2),
      alive: true,
    });
  }

  if (Math.random() < 0.92) {
    const count = Math.random() < 0.45 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      state.obstacles.push({
        type: "shard",
        x: platform.x + random(76, platform.width - 70) + index * 34,
        y: platform.y - random(72, 128),
        width: 26,
        height: 26,
        bob: random(0, Math.PI * 2),
        alive: true,
      });
    }
  }
}

function startRun() {
  resetGame();
  state.status = "running";
  hideOverlay();
}

function gameOver() {
  state.status = "gameover";
  const meters = Math.floor(state.distance / 16);
  state.score = Math.floor(meters * 8 + state.style);
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    saveBestScore(state.bestScore);
  }
  updateUI();
  showOverlay(
    "Забег сорвался",
    `Результат ${state.score}`,
    `Ты пролетел ${meters} м и набрал ${Math.floor(state.style)} style. Нажми и запусти новый маршрут.`,
    "Еще раз"
  );
}

function showOverlay(title, kicker, copy, buttonText) {
  ui.overlayTitle.textContent = title;
  ui.overlayKicker.textContent = kicker;
  ui.overlayCopy.textContent = copy;
  ui.actionButton.textContent = buttonText;
  ui.overlay.classList.remove("hidden");
}

function hideOverlay() {
  ui.overlay.classList.add("hidden");
}

function handleJumpPress() {
  if (state.status === "ready") {
    startRun();
    input.jumpBuffered = true;
    return;
  }
  if (state.status === "gameover") {
    startRun();
    input.jumpBuffered = true;
    return;
  }
  input.jumpBuffered = true;
}

function handleDashPress() {
  if (state.status === "ready") {
    startRun();
    return;
  }
  if (state.status !== "running") {
    return;
  }
  if (player.dashTimer > 0 || state.energy < 36) {
    return;
  }
  state.energy = Math.max(0, state.energy - 36);
  player.dashTimer = 0.24;
  player.vy = Math.min(player.vy, 90);
  addStyle(65, 1, "Dash");
  burst(player.x + player.width, player.y + player.height * 0.5, 18, COLORS.playerAccent);
}

function tryJump() {
  if (player.jumpsAvailable <= 0) {
    return false;
  }

  const groundedJump = player.onGround || player.coyote > 0;
  player.vy = groundedJump ? -900 : -840;
  player.jumpsAvailable -= 1;
  player.onGround = false;
  player.coyote = 0;
  player.squash = 1;
  addStyle(groundedJump ? 18 : 28, groundedJump ? 0 : 1, groundedJump ? "Leap" : "Double");
  burst(player.x + player.width * 0.45, player.y + player.height, 12, COLORS.accentSoft);
  return true;
}

function addStyle(amount, comboGain = 0, label = "") {
  const earned = amount * state.combo;
  state.style += earned;
  state.combo = clamp(state.combo + comboGain, 1, 12);
  state.comboTimer = 2.7;
  if (label) {
    state.callouts.push({
      text: `+${Math.round(earned)} ${label}`,
      x: player.x + 22,
      y: player.y - 8,
      life: 1,
      color: comboGain > 0 ? COLORS.playerAccent : COLORS.accentSoft,
    });
  }
}

function burst(x, y, count, color) {
  for (let index = 0; index < count; index += 1) {
    state.particles.push({
      x,
      y,
      vx: random(-220, 240),
      vy: random(-220, 120),
      life: random(0.3, 0.7),
      size: random(3, 8),
      color,
    });
  }
}

function update(dt) {
  state.time += dt;
  updateCallouts(dt);
  updateParticles(dt);

  if (state.status !== "running") {
    return;
  }

  const boost = player.dashTimer > 0 ? 1.38 : 1;
  state.speedTarget = clamp(410 + state.distance * 0.016, 410, 760);
  state.speed += (state.speedTarget - state.speed) * dt * 1.8;

  const scroll = state.speed * boost * dt;
  state.distance += scroll;
  state.energy = clamp(state.energy + dt * (player.onGround ? 9 : 6), 0, 100);

  if (state.combo > 1) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = Math.max(1, state.combo - 1);
      state.comboTimer = state.combo > 1 ? 1.2 : 0;
    }
  }

  for (const platform of state.platforms) {
    platform.x -= scroll;
  }

  for (const obstacle of state.obstacles) {
    obstacle.x -= scroll;
    if (obstacle.type === "drone") {
      obstacle.phase += dt * 3.8;
    }
    if (obstacle.type === "shard") {
      obstacle.bob += dt * 4.6;
    }
  }

  state.platforms = state.platforms.filter((platform) => platform.x + platform.width > -220);
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.alive && obstacle.x + obstacle.width > -120);

  while (state.platforms[state.platforms.length - 1].x + state.platforms[state.platforms.length - 1].width < WORLD.width + 520) {
    generateNextPlatform();
  }

  player.coyote = Math.max(0, player.coyote - dt);
  if (player.dashTimer > 0) {
    player.dashTimer = Math.max(0, player.dashTimer - dt);
  }

  if (input.jumpBuffered) {
    tryJump();
    input.jumpBuffered = false;
  }

  const wasGrounded = player.onGround;
  const previousBottom = player.y + player.height;

  player.vy += WORLD.gravity * dt;
  player.y += player.vy * dt;
  player.squash = Math.max(0, player.squash - dt * 3.5);

  const support = findSupport(previousBottom);
  if (support) {
    player.y = support.y - player.height;
    player.vy = 0;
    player.onGround = true;
    player.coyote = 0.08;
    player.jumpsAvailable = 2;
    if (!wasGrounded) {
      player.squash = 0.7;
      addStyle(24, 1, "Land");
      burst(player.x + player.width * 0.5, support.y, 10, COLORS.accent);
    }
  } else {
    if (wasGrounded) {
      player.coyote = 0.12;
    }
    player.onGround = false;
  }

  resolveObstacleCollisions();

  player.tilt += ((player.dashTimer > 0 ? 0.24 : clamp(player.vy / 1400, -0.35, 0.42)) - player.tilt) * dt * 8;
  player.trail.push({
    x: player.x + player.width * 0.5,
    y: player.y + player.height * 0.6,
    life: 0.4,
  });
  player.trail = player.trail
    .map((point) => ({ ...point, life: point.life - dt }))
    .filter((point) => point.life > 0);

  if (player.y > WORLD.height + 120) {
    gameOver();
  }

  updateUI();
}

function findSupport(previousBottom) {
  const footLeft = player.x + 8;
  const footRight = player.x + player.width - 8;
  const currentBottom = player.y + player.height;
  let bestPlatform = null;

  for (const platform of state.platforms) {
    const overlaps = footRight > platform.x && footLeft < platform.x + platform.width;
    if (!overlaps) {
      continue;
    }
    const crossingTop = previousBottom <= platform.y + 16 && currentBottom >= platform.y;
    const huggingTop = currentBottom >= platform.y - 14 && currentBottom <= platform.y + 22;
    if ((crossingTop || huggingTop) && player.vy >= 0) {
      if (!bestPlatform || platform.y < bestPlatform.y) {
        bestPlatform = platform;
      }
    }
  }

  return bestPlatform;
}

function resolveObstacleCollisions() {
  const body = {
    x: player.x + 8,
    y: player.y + 8,
    width: player.width - 16,
    height: player.height - 10,
  };

  for (const obstacle of state.obstacles) {
    if (!obstacle.alive) {
      continue;
    }

    const hitbox =
      obstacle.type === "drone"
        ? { x: obstacle.x, y: obstacle.y + Math.sin(obstacle.phase) * 14, width: obstacle.width, height: obstacle.height }
        : obstacle.type === "shard"
          ? { x: obstacle.x, y: obstacle.y + Math.sin(obstacle.bob) * 12, width: obstacle.width, height: obstacle.height }
          : { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height };

    if (!rectsOverlap(body, hitbox)) {
      continue;
    }

    if (obstacle.type === "shard") {
      obstacle.alive = false;
      state.energy = clamp(state.energy + 24, 0, 100);
      addStyle(36, 1, "Style");
      burst(hitbox.x + hitbox.width * 0.5, hitbox.y + hitbox.height * 0.5, 14, COLORS.shard);
      continue;
    }

    if (player.dashTimer > 0) {
      obstacle.alive = false;
      addStyle(obstacle.type === "drone" ? 75 : 58, 2, obstacle.type === "drone" ? "Drone Down" : "Break");
      burst(hitbox.x + hitbox.width * 0.5, hitbox.y + hitbox.height * 0.5, 18, obstacle.type === "drone" ? COLORS.drone : COLORS.barrier);
      continue;
    }

    gameOver();
    break;
  }
}

function updateParticles(dt) {
  state.particles = state.particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * dt,
      y: particle.y + particle.vy * dt,
      vy: particle.vy + 600 * dt,
      life: particle.life - dt,
    }))
    .filter((particle) => particle.life > 0);
}

function updateCallouts(dt) {
  state.callouts = state.callouts
    .map((callout) => ({
      ...callout,
      y: callout.y - 34 * dt,
      life: callout.life - dt,
    }))
    .filter((callout) => callout.life > 0);
}

function updateUI() {
  const meters = Math.floor(state.distance / 16);
  ui.distance.textContent = `${meters} м`;
  ui.combo.textContent = `x${state.combo}`;
  ui.speed.textContent = `${Math.round(state.speed)}`;
  ui.best.textContent = `${Math.round(state.bestScore)}`;
  ui.style.textContent = `Style ${Math.floor(state.style)}`;
  ui.energyFill.style.transform = `scaleX(${state.energy / 100})`;
}

function draw() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawSky();
  drawSun();
  drawSkyline();
  drawRooftops();
  drawObstacles();
  drawParticlesLayer();
  drawPlayer();
  drawCallouts();
  drawGroundGlow();
  if (state.status === "ready") {
    drawHint("Прыжок: Space / W / ↑    Рывок: Shift / F");
  }
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(0.42, COLORS.skyMid);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = "rgba(255, 242, 220, 0.16)";
  for (let i = 0; i < 90; i += 1) {
    const x = (i * 149) % WORLD.width;
    const y = (i * 83) % 260;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawSun() {
  const pulse = Math.sin(state.time * 0.8) * 10;
  const x = WORLD.width * 0.78;
  const y = 146;
  const radius = 92 + pulse * 0.12;

  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.8);
  glow.addColorStop(0, "rgba(255, 212, 129, 0.56)");
  glow.addColorStop(0.4, "rgba(255, 111, 47, 0.25)");
  glow.addColorStop(1, "rgba(255, 111, 47, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 212, 129, 0.8)";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkyline() {
  for (const layer of skylineLayers) {
    const offset = (state.distance * layer.speed) % layer.cycle;
    ctx.fillStyle = layer.color;

    for (const building of layer.buildings) {
      for (let repeat = -1; repeat <= 1; repeat += 1) {
        const x = building.x - offset + repeat * layer.cycle;
        const y = layer.baseY - building.height;
        if (x > WORLD.width + 40 || x + building.width < -40) {
          continue;
        }

        ctx.fillRect(x, y, building.width, building.height);

        ctx.fillStyle = "rgba(255, 199, 122, 0.1)";
        for (let wx = x + 8; wx < x + building.width - 8; wx += 16) {
          for (let wy = y + 14; wy < layer.baseY - 18; wy += 18) {
            ctx.fillRect(wx, wy, 6, 9);
          }
        }

        ctx.fillStyle = layer.color;
        if (building.cap) {
          ctx.fillRect(x + building.width * 0.3, y - 18, building.width * 0.12, 18);
        }
        if (building.beacon) {
          ctx.fillStyle = "rgba(255, 91, 91, 0.8)";
          ctx.fillRect(x + building.width * 0.5, y - 6, 4, 4);
          ctx.fillStyle = layer.color;
        }
      }
    }
  }
}

function drawRooftops() {
  for (const platform of state.platforms) {
    ctx.fillStyle = COLORS.rooftopFace;
    ctx.beginPath();
    ctx.moveTo(platform.x, platform.y);
    ctx.lineTo(platform.x + platform.width, platform.y);
    ctx.lineTo(platform.x + platform.width - 32, WORLD.height);
    ctx.lineTo(platform.x + 18, WORLD.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.rooftop;
    ctx.fillRect(platform.x, platform.y - 8, platform.width, 12);
    ctx.fillStyle = COLORS.roofEdge;
    ctx.fillRect(platform.x, platform.y - 8, platform.width, 4);
    ctx.fillStyle = COLORS.window;

    for (let wx = platform.x + 18; wx < platform.x + platform.width - 18; wx += 24) {
      for (let wy = platform.y + 28; wy < WORLD.height - 22; wy += 26) {
        ctx.fillRect(wx, wy, 10, 14);
      }
    }
  }
}

function drawObstacles() {
  for (const obstacle of state.obstacles) {
    if (!obstacle.alive) {
      continue;
    }

    if (obstacle.type === "barrier") {
      ctx.fillStyle = COLORS.barrier;
      ctx.beginPath();
      ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
      ctx.lineTo(obstacle.x + obstacle.width * 0.18, obstacle.y);
      ctx.lineTo(obstacle.x + obstacle.width, obstacle.y);
      ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(255, 243, 230, 0.32)";
      ctx.fillRect(obstacle.x + obstacle.width * 0.22, obstacle.y + 12, obstacle.width * 0.16, obstacle.height - 22);
      ctx.fillRect(obstacle.x + obstacle.width * 0.58, obstacle.y + 6, obstacle.width * 0.16, obstacle.height - 14);
      continue;
    }

    if (obstacle.type === "drone") {
      const y = obstacle.y + Math.sin(obstacle.phase) * 14;
      ctx.fillStyle = "rgba(255, 91, 91, 0.28)";
      ctx.fillRect(obstacle.x - 10, y + 10, obstacle.width + 20, 6);
      ctx.fillStyle = COLORS.drone;
      ctx.fillRect(obstacle.x, y, obstacle.width, obstacle.height);
      ctx.fillStyle = "rgba(255, 243, 230, 0.9)";
      ctx.fillRect(obstacle.x + 14, y + 8, obstacle.width - 28, 6);
      ctx.fillRect(obstacle.x + obstacle.width * 0.5 - 6, y - 8, 12, 8);
      continue;
    }

    if (obstacle.type === "shard") {
      const y = obstacle.y + Math.sin(obstacle.bob) * 12;
      ctx.save();
      ctx.translate(obstacle.x + obstacle.width * 0.5, y + obstacle.height * 0.5);
      ctx.rotate(state.time * 1.5);
      ctx.fillStyle = COLORS.shard;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 16);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawParticlesLayer() {
  for (const particle of state.particles) {
    ctx.globalAlpha = clamp(particle.life * 1.6, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  for (const point of player.trail) {
    ctx.globalAlpha = point.life * (player.dashTimer > 0 ? 1.6 : 0.45);
    ctx.fillStyle = player.dashTimer > 0 ? COLORS.playerAccent : COLORS.trail;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 20 * point.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(player.x + player.width * 0.5, player.y + player.height * 0.55);
  ctx.rotate(player.tilt);

  const squashY = 1 - player.squash * 0.18;
  const stretchX = 1 + player.squash * 0.16;
  ctx.scale(stretchX, squashY);

  ctx.fillStyle = player.dashTimer > 0 ? COLORS.playerAccent : COLORS.player;
  ctx.beginPath();
  ctx.arc(0, -28, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(-8, -14, 16, 34);
  ctx.fillRect(-20, -6, 40, 8);

  const stride = Math.sin(state.time * 14 + (player.onGround ? 0 : 1.4)) * 10;
  ctx.save();
  ctx.rotate((stride / 80) * (player.onGround ? 1 : 0.35));
  ctx.fillRect(-18, 16, 10, 32);
  ctx.restore();

  ctx.save();
  ctx.rotate((-stride / 80) * (player.onGround ? 1 : 0.35));
  ctx.fillRect(8, 16, 10, 32);
  ctx.restore();

  ctx.fillStyle = "rgba(255, 122, 47, 0.92)";
  ctx.fillRect(-8, -18, 16, 6);
  ctx.restore();
}

function drawCallouts() {
  ctx.font = '700 24px "Avenir Next Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = "left";
  for (const callout of state.callouts) {
    ctx.globalAlpha = clamp(callout.life * 1.4, 0, 1);
    ctx.fillStyle = callout.color;
    ctx.fillText(callout.text, callout.x, callout.y);
  }
  ctx.globalAlpha = 1;
}

function drawGroundGlow() {
  const glow = ctx.createLinearGradient(0, WORLD.height - 180, 0, WORLD.height);
  glow.addColorStop(0, "rgba(255, 122, 47, 0)");
  glow.addColorStop(1, "rgba(255, 122, 47, 0.26)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, WORLD.height - 180, WORLD.width, 180);
}

function drawHint(text) {
  ctx.fillStyle = "rgba(15, 6, 5, 0.46)";
  ctx.fillRect(26, WORLD.height - 68, 420, 36);
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 18px "Avenir Next Condensed", "Arial Narrow", sans-serif';
  ctx.fillText(text, 40, WORLD.height - 44);
}

function loop(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  const delta = Math.min((timestamp - state.lastTime) / 1000, 0.032);
  state.lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function bindEvents() {
  ui.actionButton.addEventListener("click", startRun);
  canvas.addEventListener("pointerdown", () => {
    if (state.status === "running") {
      handleJumpPress();
    }
  });

  for (const button of ui.mobileButtons) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (button.dataset.action === "jump") {
        handleJumpPress();
      } else {
        handleDashPress();
      }
    });
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ([" ", "arrowup", "w"].includes(key) || event.code === "Space") {
      event.preventDefault();
      handleJumpPress();
      return;
    }

    if (["shift", "f"].includes(key)) {
      event.preventDefault();
      handleDashPress();
    }
  });
}

function init() {
  bindEvents();
  resetGame();
  showOverlay(
    "Включай забег",
    "Roofline Rush",
    "Прыгай по крышам, цепляй кристаллы и прожимай рывок, чтобы пробивать препятствия на скорости.",
    "Старт"
  );
  updateUI();
  requestAnimationFrame(loop);
}

init();
