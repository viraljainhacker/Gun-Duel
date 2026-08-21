const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

const MAX_PLAYERS = 4;

function generateRoomCode() {
  let code;

  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));

  return code;
}

function roomInfo(room) {
  return {
    code: room.code,

    host: room.host,

    started: room.started,

    players: [...room.players.values()].map((player) => ({
      id: player.id,
      number: player.number,
      name: player.name,
    })),
  };
}

function updateRoom(room) {
  io.to(room.code).emit("roomUpdate", roomInfo(room));
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // CREATE ROOM
  socket.on("createRoom", (data) => {
    const code = generateRoomCode();

    const room = {
      code,

      host: socket.id,

      started: false,

      players: new Map(),
    };

    room.players.set(socket.id, {
      id: socket.id,
      number: 1,
      name: data.name || "Player 1",
    });

    rooms.set(code, room);

    socket.join(code);

    socket.roomCode = code;

    socket.playerNumber = 1;

    socket.emit("roomCreated", {
      code,
      number: 1,
    });

    updateRoom(room);
  });

  // JOIN ROOM
  socket.on("joinRoom", (data) => {
    const code = String(data.code || "").trim();

    const room = rooms.get(code);

    if (!room) {
      socket.emit("errorMessage", "Room not found.");

      return;
    }

    if (room.started) {
      socket.emit("errorMessage", "Game already started.");

      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      socket.emit("errorMessage", "Room is full.");

      return;
    }

    const usedNumbers = [...room.players.values()].map((p) => p.number);

    let number = 1;

    while (usedNumbers.includes(number)) {
      number++;
    }

    room.players.set(socket.id, {
      id: socket.id,

      number,

      name: data.name || `Player ${number}`,
    });

    socket.join(code);

    socket.roomCode = code;

    socket.playerNumber = number;

    socket.emit("roomJoined", {
      code,
      number,
    });

    updateRoom(room);
  });

  // HOST STARTS GAME
  socket.on("startGame", () => {
    const room = rooms.get(socket.roomCode);

    if (!room) return;

    if (room.host !== socket.id) return;

    room.started = true;

    io.to(room.code).emit("gameStarted", {
      players: [...room.players.values()],
    });

    updateRoom(room);
  });

  // PLAYER INPUT
  socket.on("playerInput", (input) => {
    const room = rooms.get(socket.roomCode);

    if (!room || !room.started) return;

    socket.to(room.code).emit("remoteInput", {
      player: socket.playerNumber,

      input,
    });
  });

  // HOST SENDS GAME STATE
  socket.on("gameState", (state) => {
    const room = rooms.get(socket.roomCode);

    if (!room) return;

    if (room.host !== socket.id) return;

    socket.to(room.code).emit("gameState", state);
  });

  // LEVEL CHANGED
  socket.on("levelChanged", (level) => {
    const room = rooms.get(socket.roomCode);

    if (!room) return;

    if (room.host !== socket.id) return;

    io.to(room.code).emit("levelChanged", level);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const room = rooms.get(socket.roomCode);

    if (!room) return;

    room.players.delete(socket.id);

    if (room.players.size === 0) {
      rooms.delete(room.code);

      return;
    }

    if (room.host === socket.id) {
      room.host = room.players.keys().next().value;

      io.to(room.code).emit("newHost", room.host);
    }

    updateRoom(room);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Gun Duel running on port ${PORT}`);
});
