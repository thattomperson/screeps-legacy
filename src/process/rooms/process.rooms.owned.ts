import Process from "../process";

const InactiveStructuresProcess = require("./process.rooms.owned.inactive-structures");
const ManageLabsProcess = require("./process.rooms.owned.labs");
const ManageLinksProcess = require("./process.rooms.owned.links");
const ManageSpawnsProcess = require("./process.rooms.owned.spawns");
const RoomDefenseProcess = require("./process.rooms.owned.defense");
const RoomManagerProcess = require("./process.rooms.owned.manager");
const RoomOperation = require("./operation.room");
const RoomSongsProcess = require("./process.rooms.owned.songs");

const gatherStats = true;

/**
 * Manages rooms we own.
 * @constructor
 *
 * @param {object} params
 *   Options on how to run this process.
 * @param {object} data
 *   Memory object allocated for this process' stats.
 */
const OwnedRoomProcess = function (params, data) {
  Process.call(this, params, data);
  this.room = params.room;
};

OwnedRoomProcess.prototype = Object.create(Process.prototype);

/**
 * Manages one of our rooms.
 */
OwnedRoomProcess.prototype.run = function () {
  const startTime = Game.cpu.getUsed();

  const operationName = "room:" + this.room.name;
  let operation = Game.operationsByType.room[operationName];
  if (!operation) {
    operation = new RoomOperation(operationName);
    operation.setRoom(this.room.name);
  }

  hivemind.runSubProcess("rooms_roomplanner", () => {
    // RoomPlanner has its own 100 tick throttling, so we runLogic every tick.
    if (this.room.roomPlanner) this.room.roomPlanner.runLogic();
  });

  const prioritizeRoomManager = this.room.roomManager.shouldRunImmediately();
  hivemind.runSubProcess("rooms_manager", () => {
    hivemind.runProcess(this.room.name + "_manager", RoomManagerProcess, {
      interval: prioritizeRoomManager ? 0 : 100,
      room: this.room,
      priority: prioritizeRoomManager ? PROCESS_PRIORITY_ALWAYS : PROCESS_PRIORITY_DEFAULT
    });
  });

  hivemind.runSubProcess("rooms_inactive_structs", () => {
    hivemind.runProcess(this.room.name + "_inactive_structs", InactiveStructuresProcess, {
      interval: 500,
      room: this.room,
      priority: PROCESS_PRIORITY_LOW
    });
  });

  // @todo Only run processes based on current room level or existing structures.
  hivemind.runSubProcess("rooms_defense", () => {
    hivemind.runProcess(this.room.name + "_defense", RoomDefenseProcess, {
      room: this.room,
      priority: PROCESS_PRIORITY_ALWAYS
    });
  });

  hivemind.runSubProcess("rooms_links", () => {
    hivemind.runProcess(this.room.name + "_links", ManageLinksProcess, {
      interval: 10,
      room: this.room
    });
  });

  hivemind.runSubProcess("rooms_labs", () => {
    hivemind.runProcess(this.room.name + "_labs", ManageLabsProcess, {
      room: this.room
    });
  });

  hivemind.runSubProcess("rooms_spawns", () => {
    hivemind.runProcess(this.room.name + "_spawns", ManageSpawnsProcess, {
      room: this.room,
      priority: PROCESS_PRIORITY_ALWAYS
    });
  });

  hivemind.runSubProcess("rooms_power", () => {
    // Process power in power spawns.
    const powerSpawn = this.room.powerSpawn;
    if (powerSpawn && powerSpawn.my && powerSpawn.power > 0 && powerSpawn.energy >= POWER_SPAWN_ENERGY_RATIO) {
      powerSpawn.processPower();
    }
  });

  hivemind.runSubProcess("rooms_observers", () => {
    // Use observers if requested.
    if (this.room.observer && this.room.memory.observeTargets && this.room.memory.observeTargets.length > 0) {
      const target = this.room.memory.observeTargets.pop();
      this.room.observer.observeRoom(target);
      this.room.observer.hasScouted = true;
    }
  });

  hivemind.runSubProcess("rooms_songs", () => {
    // Sing a song.
    hivemind.runProcess(this.room.name + "_song", RoomSongsProcess, {
      room: this.room,
      priority: PROCESS_PRIORITY_LOW
    });
  });

  if (gatherStats) {
    hivemind.runSubProcess("rooms_stats", () => {
      this.gatherStats();
    });
  }

  const totalTime = Game.cpu.getUsed() - startTime;
  operation.addCpuCost(totalTime);
};

OwnedRoomProcess.prototype.gatherStats = function () {
  const roomName = this.room.name;

  if (!Memory.roomStats) Memory.roomStats = {};
  if (!Memory.roomStats[roomName]) {
    Memory.roomStats[roomName] = {
      claimed: Game.time
    };
  }

  const memory = Memory.roomStats[roomName];
  const key = "rcl" + this.room.controller.level;
  if (!memory[key]) memory[key] = Game.time - memory.claimed;

  if (!memory.tower) {
    if (this.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length > 0) {
      memory.tower = Game.time - memory.claimed;
    }
  }

  if (!memory.storage && this.room.storage) {
    memory.storage = Game.time - memory.claimed;
  }
};

export default OwnedRoomProcess;
