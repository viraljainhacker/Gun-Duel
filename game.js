const socket = io();

const canvas = document.getElementById("gameCanvas");

const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const GROUND = H - 60;

const GRAVITY = 0.6;

let roomCode = "";

let myNumber = 1;

let isHost = false;

let selectedPlayers = 1;

let gameStarted = false;

let level = 1;

let players = [];

let bots = [];

let bullets = [];

let particles = [];

let keys = {};

let waitingForNextLevel = false;

const colors = ["#ff5252", "#448aff", "#69f0ae", "#ffd740"];

const controls = [
  {
    left: "KeyA",
    right: "KeyD",
    jump: "KeyW",
    crouch: "KeyS",
    fire: "Space",
  },

  {
    left: "ArrowLeft",
    right: "ArrowRight",
    jump: "ArrowUp",
    crouch: "ArrowDown",
    fire: "Enter",
  },

  {
    left: "KeyJ",
    right: "KeyL",
    jump: "KeyI",
    crouch: "KeyK",
    fire: "KeyO",
  },

  {
    left: "Numpad1",
    right: "Numpad3",
    jump: "Numpad5",
    crouch: "Numpad2",
    fire: "Numpad0",
  },
];

/* =========================
   PLAYER COUNT
========================= */

window.selectPlayerCount = function (count) {
  selectedPlayers = count;

  document.getElementById("selectedPlayers").textContent = count;
};

/* =========================
   CREATE ROOM
========================= */

window.createRoom = function () {
  const name = document.getElementById("playerName").value.trim() || "Player 1";

  socket.emit("createRoom", {
    name,
  });
};

/* =========================
   JOIN ROOM
========================= */

window.joinRoom = function () {
  const code = document.getElementById("roomInput").value.trim();

  const name = document.getElementById("playerName").value.trim() || "Player";

  if (!code) {
    showStatus("Enter a room code.");

    return;
  }

  socket.emit("joinRoom", {
    code,
    name,
  });
};

/* =========================
   ROOM CREATED
========================= */

socket.on("roomCreated", (data) => {
  roomCode = data.code;

  myNumber = data.number;

  isHost = true;

  showRoom();
});

/* =========================
   ROOM JOINED
========================= */

socket.on("roomJoined", (data) => {
  roomCode = data.code;

  myNumber = data.number;

  isHost = false;

  showRoom();
});

/* =========================
   ROOM UPDATE
========================= */

socket.on("roomUpdate", (room) => {
  document.getElementById("roomCode").textContent = room.code;

  document.getElementById("roomPlayers").innerHTML = room.players
    .map(
      (p) =>
        `<div>
                    🎮 Player ${p.number} :
                    ${escapeHTML(p.name)}
                </div>`,
    )
    .join("");

  document
    .getElementById("startButton")
    .classList.toggle("hidden", room.host !== socket.id);
});

/* =========================
   GAME START
========================= */

socket.on("gameStarted", (data) => {
  players = [];

  data.players.forEach((p, i) => {
    players.push(createPlayer(p.number, i, p.name));
  });

  document.getElementById("lobby").classList.add("hidden");

  document.getElementById("gameScreen").classList.remove("hidden");

  level = 1;

  startLevel();
});

/* =========================
   START ONLINE GAME
========================= */

window.startOnlineGame = function () {
  if (!isHost) return;

  socket.emit("startGame");
};

/* =========================
   CREATE PLAYER
========================= */

function createPlayer(number, index, name) {
  const positions = [80, 330, 650, 950];

  return {
    number,

    name,

    x: positions[index] || 100,

    y: GROUND - 60,

    w: 32,

    h: 60,

    vx: 0,

    vy: 0,

    speed: 4.5,

    health: 100,

    maxHealth: 100,

    alive: true,

    onGround: true,

    crouch: false,

    facing: index < 2 ? 1 : -1,

    cooldown: 0,

    color: colors[index],
  };
}

/* =========================
   START LEVEL
========================= */

function startLevel() {
  bullets = [];

  particles = [];

  waitingForNextLevel = false;

  players.forEach((p, i) => {
    p.x = [80, 330, 650, 950][i] || 100;

    p.y = GROUND - p.h;

    p.health = 100;

    p.alive = true;

    p.vx = 0;

    p.vy = 0;
  });

  bots = [];

  /*
       Level = number of bots

       Level 1 = 1 bot
       Level 10 = 10 bots
       Level 25 = 25 bots
       Level 50 = 50 bots
    */

  for (let i = 0; i < level; i++) {
    bots.push(createBot());
  }

  updateUI();

  gameStarted = true;
}

/* =========================
   CREATE BOT
========================= */

function createBot() {
  const difficulty = level / 50;

  return {
    x: 120 + Math.random() * (W - 240),

    y: GROUND - 60,

    w: 30,

    h: 60,

    vx: 0,

    vy: 0,

    speed: 2 + difficulty * 3.5,

    health: 60 + level * 4,

    maxHealth: 60 + level * 4,

    alive: true,

    onGround: true,

    crouch: false,

    facing: Math.random() < 0.5 ? 1 : -1,

    cooldown: Math.random() * 30,

    color: "#a855f7",
  };
}

/* =========================
   KEYBOARD
========================= */

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  ) {
    e.preventDefault();
  }

  sendInput();
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;

  sendInput();
});

/* =========================
   SEND INPUT
========================= */

function sendInput() {
  if (isHost) return;

  const c = controls[myNumber - 1];

  if (!c) return;

  socket.emit("playerInput", {
    left: !!keys[c.left],

    right: !!keys[c.right],

    jump: !!keys[c.jump],

    crouch: !!keys[c.crouch],

    fire: !!keys[c.fire],
  });
}

/* =========================
   APPLY INPUT
========================= */

function applyInput(player, input) {
  const c = controls[player.number - 1];

  player.vx = 0;

  if (input.left) {
    player.vx = -player.speed;

    player.facing = -1;
  }

  if (input.right) {
    player.vx = player.speed;

    player.facing = 1;
  }

  if (input.jump && player.onGround) {
    player.vy = -12;

    player.onGround = false;
  }

  player.crouch = input.crouch && player.onGround;

  if (input.fire) {
    shoot(player);
  }
}

/* =========================
   GET LOCAL INPUT
========================= */

function localInput(playerIndex) {
  const c = controls[playerIndex];

  return {
    left: !!keys[c.left],

    right: !!keys[c.right],

    jump: !!keys[c.jump],

    crouch: !!keys[c.crouch],

    fire: !!keys[c.fire],
  };
}

/* =========================
   SHOOT
========================= */

function shoot(player) {
  if (!player.alive || player.cooldown > 0) {
    return;
  }

  player.cooldown = 14;

  bullets.push({
    x: player.facing > 0 ? player.x + player.w : player.x,

    y: player.y + (player.crouch ? player.h * 0.65 : player.h * 0.3),

    vx: 13 * player.facing,

    owner: player,
  });
}

/* =========================
   BOT AI
========================= */

function botAI(bot) {
  if (!bot.alive) return;

  let target = null;

  let closest = Infinity;

  players.forEach((p) => {
    if (!p.alive) return;

    const d = Math.abs(p.x - bot.x);

    if (d < closest) {
      closest = d;

      target = p;
    }
  });

  if (!target) return;

  const distance = target.x - bot.x;

  /*
       Higher levels:
       faster movement
       better shooting
    */

  if (Math.abs(distance) > 180) {
    bot.vx = distance > 0 ? bot.speed : -bot.speed;
  } else {
    bot.vx = 0;
  }

  bot.facing = distance > 0 ? 1 : -1;

  /*
       Jump
    */

  if (bot.onGround && Math.random() < 0.002 + level * 0.00015) {
    bot.vy = -11;

    bot.onGround = false;
  }

  /*
       Shoot
    */

  bot.cooldown--;

  if (bot.cooldown <= 0) {
    const accuracy = 0.25 + level * 0.014;

    if (Math.random() < Math.min(0.95, accuracy)) {
      shoot(bot);
    }

    bot.cooldown = 12 + Math.random() * 25;
  }
}

/* =========================
   PHYSICS
========================= */

function physics(player) {
  player.x += player.vx;

  player.vy += GRAVITY;

  player.y += player.vy;

  if (player.y + player.h >= GROUND) {
    player.y = GROUND - player.h;

    player.vy = 0;

    player.onGround = true;
  }

  player.x = Math.max(0, Math.min(W - player.w, player.x));

  if (player.cooldown > 0) {
    player.cooldown--;
  }
}

/* =========================
   BULLETS
========================= */

function updateBullets() {
  bullets.forEach((b) => {
    b.x += b.vx;
  });

  bullets = bullets.filter((bullet) => {
    if (bullet.x < 0 || bullet.x > W) {
      return false;
    }

    const targets = [...players, ...bots];

    for (const target of targets) {
      if (!target.alive || target === bullet.owner) {
        continue;
      }

      const top = target.crouch ? target.y + target.h * 0.4 : target.y;

      const height = target.crouch ? target.h * 0.6 : target.h;

      if (
        bullet.x > target.x &&
        bullet.x < target.x + target.w &&
        bullet.y > top &&
        bullet.y < top + height
      ) {
        hitTarget(target, bullet.owner);

        return false;
      }
    }

    return true;
  });
}

/* =========================
   HIT EFFECT
========================= */

function hitTarget(target, attacker) {
  target.health -= 20;

  /*
       Non-graphic hit effect:
       red particles + flash
    */

  createHitEffect(
    target.x + target.w / 2,

    target.y + target.h * 0.4,
  );

  if (target.health <= 0) {
    target.health = 0;

    target.alive = false;
  }
}

/* =========================
   RED HIT PARTICLES
========================= */

function createHitEffect(x, y) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x,

      y,

      vx: (Math.random() - 0.5) * 7,

      vy: (Math.random() - 0.5) * 7,

      life: 25 + Math.random() * 15,

      size: 2 + Math.random() * 4,

      color: Math.random() < 0.5 ? "#ff304f" : "#ff7373",
    });
  }
}

/* =========================
   PARTICLES
========================= */

function updateParticles() {
  particles.forEach((p) => {
    p.x += p.vx;

    p.y += p.vy;

    p.vy += 0.15;

    p.life--;
  });

  particles = particles.filter((p) => p.life > 0);
}

/* =========================
   LEVEL COMPLETE
========================= */

function checkLevel() {
  if (waitingForNextLevel) {
    return;
  }

  const alivePlayers = players.filter((p) => p.alive).length;

  const aliveBots = bots.filter((b) => b.alive).length;

  if (alivePlayers === 0) {
    showGameOver();

    return;
  }

  if (aliveBots === 0) {
    waitingForNextLevel = true;

    /*
          IMPORTANT:

          Level automatically DOES NOT
          increase here.

          First show WIN interface.
        */

    showWinScreen();
  }
}

/* =========================
   WIN SCREEN
========================= */

function showWinScreen() {
  document.getElementById("completedLevel").textContent = level;

  document.getElementById("winScreen").classList.remove("hidden");
}

/* =========================
   NEXT LEVEL BUTTON
========================= */

window.nextLevel = function () {
  document.getElementById("winScreen").classList.add("hidden");

  if (level >= 50) {
    showFinalWin();

    return;
  }

  level++;

  socket.emit("levelChanged", level);

  startLevel();
};

/* =========================
   FINAL LEVEL
========================= */

function showFinalWin() {
  document.getElementById("winScreen").innerHTML = `

        <div class="winBox">

            <div class="winIcon">
                👑
            </div>

            <h2>
                YOU ARE THE CHAMPION!
            </h2>

            <p>
                All 50 levels completed.
            </p>

            <h3>
                💀 LEVEL 50 DEFEATED 💀
            </h3>

            <button
                onclick="location.reload()">

                PLAY AGAIN

            </button>

        </div>

    `;

  document.getElementById("winScreen").classList.remove("hidden");
}

/* =========================
   GAME OVER
========================= */

function showGameOver() {
  gameStarted = false;

  document.getElementById("gameOver").classList.remove("hidden");
}

/* =========================
   RESTART LEVEL
========================= */

window.restartLevel = function () {
  document.getElementById("gameOver").classList.add("hidden");

  startLevel();
};

/* =========================
   DRAW PLAYER
========================= */

function drawPlayer(p) {
  if (!p.alive) return;

  const height = p.crouch ? p.h * 0.6 : p.h;

  const y = p.crouch ? p.y + p.h * 0.4 : p.y;

  /*
       Flash around player
       after getting hit.
    */

  ctx.fillStyle = p.color;

  ctx.fillRect(p.x, y, p.w, height);

  ctx.beginPath();

  ctx.arc(p.x + p.w / 2, y - 9, 11, 0, Math.PI * 2);

  ctx.fill();

  ctx.fillStyle = "#111";

  ctx.fillRect(
    p.facing > 0 ? p.x + p.w : p.x - 20,

    y + height * 0.35,

    20,

    7,
  );
}

/* =========================
   DRAW BOT
========================= */

function drawBot(bot) {
  if (!bot.alive) return;

  const height = bot.crouch ? bot.h * 0.6 : bot.h;

  const y = bot.crouch ? bot.y + bot.h * 0.4 : bot.y;

  ctx.fillStyle = bot.color;

  ctx.fillRect(bot.x, y, bot.w, height);

  ctx.beginPath();

  ctx.arc(bot.x + bot.w / 2, y - 9, 10, 0, Math.PI * 2);

  ctx.fill();

  ctx.fillStyle = "#111";

  ctx.fillRect(
    bot.facing > 0 ? bot.x + bot.w : bot.x - 20,

    y + height * 0.35,

    20,

    7,
  );
}

/* =========================
   DRAW
========================= */

function draw() {
  ctx.clearRect(0, 0, W, H);

  const gradient = ctx.createLinearGradient(0, 0, 0, H);

  gradient.addColorStop(0, "#20243d");

  gradient.addColorStop(1, "#3b3f61");

  ctx.fillStyle = gradient;

  ctx.fillRect(0, 0, W, H);

  /* Ground */

  ctx.fillStyle = "#474b6a";

  ctx.fillRect(0, GROUND, W, H - GROUND);

  /* Players */

  players.forEach(drawPlayer);

  /* Bots */

  bots.forEach(drawBot);

  /* Bullets */

  bullets.forEach((b) => {
    ctx.fillStyle = "#ffd740";

    ctx.beginPath();

    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);

    ctx.fill();
  });

  /* Hit particles */

  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / 40);

    ctx.fillStyle = p.color;

    ctx.fillRect(p.x, p.y, p.size, p.size);
  });

  ctx.globalAlpha = 1;
}

/* =========================
   GAME LOOP
========================= */

function gameLoop() {
  if (!gameStarted) {
    requestAnimationFrame(gameLoop);

    return;
  }

  if (isHost) {
    /*
           Local host player
        */

    players.forEach((p, i) => {
      if (!p.alive) return;

      if (i === myNumber - 1) {
        applyInput(p, localInput(i));
      }

      physics(p);
    });

    /*
           Bots
        */

    bots.forEach((bot) => {
      if (!bot.alive) return;

      botAI(bot);

      physics(bot);
    });

    updateBullets();

    updateParticles();

    checkLevel();

    /*
           Send state
           to other devices
        */

    sendGameState();
  }

  updateUI();

  draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

/* =========================
   REMOTE INPUT
========================= */

socket.on("remoteInput", (data) => {
  if (!isHost) return;

  const player = players[data.player - 1];

  if (!player) return;

  applyInput(player, data.input);
});

/* =========================
   GAME STATE
========================= */

function sendGameState() {
  socket.emit("gameState", {
    level,

    players: players.map((p) => ({
      number: p.number,

      x: p.x,

      y: p.y,

      health: p.health,

      alive: p.alive,

      facing: p.facing,

      crouch: p.crouch,
    })),

    bots: bots.map((b) => ({
      x: b.x,

      y: b.y,

      health: b.health,

      alive: b.alive,

      facing: b.facing,

      crouch: b.crouch,
    })),

    bullets: bullets.map((b) => ({
      x: b.x,

      y: b.y,
    })),
  });
}

/* =========================
   REMOTE GAME STATE
========================= */

socket.on("gameState", (state) => {
  if (isHost) return;

  level = state.level;

  state.players.forEach((data) => {
    let p = players.find((x) => x.number === data.number);

    if (!p) {
      p = createPlayer(data.number, data.number - 1, "Player");

      players.push(p);
    }

    p.x = data.x;

    p.y = data.y;

    p.health = data.health;

    p.alive = data.alive;

    p.facing = data.facing;

    p.crouch = data.crouch;
  });

  bullets = state.bullets.map((b) => ({
    x: b.x,
    y: b.y,
    vx: 0,
  }));

  bots = state.bots.map((b, i) => ({
    ...b,

    w: 30,

    h: 60,

    color: "#a855f7",
  }));
});

/* =========================
   LEVEL SYNC
========================= */

socket.on("levelChanged", (newLevel) => {
  level = newLevel;

  startLevel();
});

/* =========================
   NEW HOST
========================= */

socket.on("newHost", (id) => {
  if (id === socket.id) {
    isHost = true;
  }
});

/* =========================
   UI
========================= */

function updateUI() {
  document.getElementById("level").textContent = level;

  let difficulty;

  if (level === 50) {
    difficulty = "💀 ULTIMATE";
  } else if (level >= 46) {
    difficulty = "☠️ DEMON";
  } else if (level >= 41) {
    difficulty = "👹 LEGENDARY";
  } else if (level >= 36) {
    difficulty = "💀 INSANE";
  } else if (level >= 31) {
    difficulty = "☠️ NIGHTMARE";
  } else if (level >= 26) {
    difficulty = "🔥 EXTREME";
  } else if (level >= 21) {
    difficulty = "🔴 VERY HARD";
  } else if (level >= 16) {
    difficulty = "🟠 HARD";
  } else if (level >= 11) {
    difficulty = "🟡 MEDIUM";
  } else if (level >= 6) {
    difficulty = "🟢 EASY";
  } else {
    difficulty = "🟢 BEGINNER";
  }

  document.getElementById("difficulty").textContent = difficulty;

  updateHUD();
}

/* =========================
   HUD
========================= */

function updateHUD() {
  const hud = document.getElementById("playersHUD");

  hud.innerHTML = players
    .map(
      (p) => `

            <div
                class="hudPlayer">

                <div
                    class="hudName"
                    style="
                    color:${p.color}">

                    P${p.number}

                </div>

                <div
                    class="healthBG">

                    <div
                        class="health"
                        style="
                        width:${p.health}%;

                        background:
                        ${p.color}">

                    </div>

                </div>

            </div>

            `,
    )
    .join("");
}

/* =========================
   STATUS
========================= */

function showStatus(text) {
  document.getElementById("status").textContent = text;
}

function showRoom() {
  document.getElementById("roomBox").classList.remove("hidden");

  document.getElementById("roomCode").textContent = roomCode;

  showStatus(`You are Player ${myNumber}`);
}

/* =========================
   ERRORS
========================= */

socket.on("errorMessage", (message) => {
  showStatus(message);
});

/* =========================
   MOBILE CONTROLS
========================= */

document.querySelectorAll(".control,.fire").forEach((button) => {
  const action = button.dataset.action;

  function press(value) {
    const c = controls[myNumber - 1];

    if (!c) return;

    const key = c[action];

    if (key) {
      keys[key] = value;

      sendInput();
    }
  }

  button.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();

      press(true);
    },
    {
      passive: false,
    },
  );

  button.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();

      press(false);
    },
    {
      passive: false,
    },
  );

  button.addEventListener(
    "touchcancel",
    (e) => {
      e.preventDefault();

      press(false);
    },
    {
      passive: false,
    },
  );
});

/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(text) {
  return String(text).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}
