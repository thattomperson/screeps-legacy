/* eslint-disable @typescript-eslint/no-namespace */

import "./prototypes/construction-site";
import "./prototypes/creep";
import "./prototypes/room";
import "./prototypes/structure";

import {
  CreepsProcess,
  ExpandProcess,
  InitProcess,
  InterShardProcess,
  ManagePowerCreepsProcess,
  MapVisualsProcess,
  PowerMiningProcess,
  RemoteMiningProcess,
  ReportProcess,
  ResourcesProcess,
  RoomsProcess,
  ScoutProcess,
  TradeProcess
} from "./process";

import interShard from "./intershard";
import { ErrorMapper } from "./utils";
import Hivemind from "./hivemind";
import Operation from "./operation/operation";
import cache from "./cache";

// import profiler from ("./profiler");
import stats from "./stats";
import Bay from "./manager/bay";

import "./manager/military";
import "./manager/source";

declare global {
  /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definiton alone.
          You must also give them an implemention if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
  // Memory extension samples
  interface Memory {
    uuid: number;
    log: any;
    hivemind: HivemindMemory;
    isAccountThrottled: boolean;
    strategy: any;
    squads: { [key: string]: SquadMemory };
  }

  interface SquadMemory {
    spawnRoom: string;
    squadName: string;
  }

  interface RoomMemory {
    bays: any;
    sources: any;
    minerals: any;
    structureCache: any;
    remoteHarvesting: any;
    intel: any;
    roomPlanner: any;
    inactiveStructures: Record<string, number>;
  }

  interface RawMemory {
    _parsed: Memory;
  }

  interface Creep {
    __enhancementsLoaded: boolean;
    operation: Operation;
  }

  interface Room {
    __enhancementsLoaded: boolean;
    bays: Bay[];
  }

  interface CreepMemory {
    source?: any;
    operation?: string;
    fixedSource?: Id<Source>;
    fixedMineral?: Id<Mineral>;
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      Memory?: Memory;
      log: any;
      _wasReset: boolean;
      hivemind: Hivemind;
      PROCESS_PRIORITY_LOW: number;
      PROCESS_PRIORITY_DEFAULT: number;
      PROCESS_PRIORITY_HIGH: number;
      PROCESS_PRIORITY_ALWAYS: number;
    }
  }
}

// Make sure game object prototypes are enhanced.

console.log("new global reset");
global._wasReset = true;

const hivemind = (global.hivemind = new Hivemind());

// Load top-level processes.

/* eslint-disable import/no-unassigned-import */
require("./manager.military");
require("./manager.source");
/* eslint-enable import/no-unassigned-import */

// Allow profiling of code.

// @todo Add a healer to defender squads, or spawn one when creeps are injured.

// @todo make unarmed creeps run from hostiles.

// @todo Spawn creeps using "sequences" where more control is needed.

function runTick() {
  useMemoryFromHeap();

  hivemind.getSegmentMemory().manage();

  if (hivemind.migrateData()) return;

  if (Memory.isAccountThrottled) {
    Game.cpu.limit = 20;
  }

  hivemind.onTickStart();

  cleanup();

  hivemind.runProcess("init", InitProcess, {
    priority: global.PROCESS_PRIORITY_ALWAYS
  });

  const interShardMemory = interShard.getLocalMemory();
  const shardHasRooms = interShardMemory.info && interShardMemory.info.ownedRooms > 0;
  const shardHasEstablishedRooms = shardHasRooms && interShardMemory.info && interShardMemory.info.maxRoomLevel > 3;

  hivemind.runProcess("creeps", CreepsProcess, {
    priority: global.PROCESS_PRIORITY_ALWAYS
  });

  hivemind.runProcess("rooms", RoomsProcess, {
    priority: global.PROCESS_PRIORITY_ALWAYS
  });
  hivemind.runProcess("strategy.scout", ScoutProcess, {
    interval: hivemind.getSetting("scoutProcessInterval") as number,
    priority: global.global.PROCESS_PRIORITY_LOW,
    requireSegments: true
  });

  if (shardHasEstablishedRooms) {
    // @todo This process could be split up - decisions about when and where to expand can be executed at low priority. But management of actual expansions is high priority.
    hivemind.runProcess("strategy.expand", ExpandProcess, {
      interval: Memory.hivemind.canExpand ? 5 : 50,
      priority: global.PROCESS_PRIORITY_HIGH
    });
  }

  if (shardHasRooms) {
    hivemind.runProcess("strategy.remote_mining", RemoteMiningProcess, {
      interval: 100
    });
  }

  if (shardHasEstablishedRooms) {
    hivemind.runProcess("strategy.power_mining", PowerMiningProcess, {
      interval: 100
    });
  }

  hivemind.runProcess("strategy.inter_shard", InterShardProcess, {
    interval: 100,
    priority: global.PROCESS_PRIORITY_LOW
  });

  if (shardHasEstablishedRooms) {
    hivemind.runProcess("empire.trade", TradeProcess, {
      interval: 50,
      priority: global.PROCESS_PRIORITY_LOW
    });
    hivemind.runProcess("empire.resources", ResourcesProcess, {
      interval: 50
    });
  }

  hivemind.runProcess("empire.report", ReportProcess, {
    interval: 100
  });
  hivemind.runProcess("empire.power_creeps", ManagePowerCreepsProcess, {
    interval: 100
  });
  hivemind.runProcess("map-visuals", MapVisualsProcess, {
    priority: global.PROCESS_PRIORITY_ALWAYS
  });

  showDebug();
  recordStats();
}

let lastTime = 0;
let lastMemory: Memory | null = null;

function useMemoryFromHeap() {
  if (lastTime && lastMemory && Game.time === lastTime + 1) {
    delete global.Memory;
    global.Memory = lastMemory;
    RawMemory._parsed = lastMemory;
  } else {
    // Force parsing of Memory.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    Memory.rooms;
    lastMemory = RawMemory._parsed;
  }

  lastTime = Game.time;
}

/**
 * Saves CPU stats for the current tick to memory.
 */
function recordStats() {
  if (Game.time % 10 === 0 && Game.cpu.bucket < 9800) {
    hivemind.log("main").info("Bucket:", Game.cpu.bucket);
  }

  const time = Game.cpu.getUsed();

  if (time > Game.cpu.limit * 1.2) {
    hivemind.log("cpu").info("High CPU:", time + "/" + Game.cpu.limit);
  }

  stats.recordStat("cpu_total", time);
  stats.recordStat("bucket", Game.cpu.bucket);
  stats.recordStat("creeps", _.size(Game.creeps));
}

/**
 * Periodically deletes unused data from memory.
 */
function cleanup() {
  // Periodically clean creep memory.
  if (Game.time % 16 === 7) {
    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
      }
    }
  }

  // Periodically clean flag memory.
  if (Game.time % 1000 === 725) {
    for (const flagName in Memory.flags) {
      if (!Game.flags[flagName]) {
        delete Memory.flags[flagName];
      }
    }
  }

  // Check if memory is getting too bloated.
  const usedMemory = RawMemory.get().length;
  if (Game.time % 7836 === 0 || usedMemory > 2000000) {
    const currentScoutDistance = Memory.hivemind.maxScoutDistance || 7;
    if (usedMemory > 1800000 && currentScoutDistance > 2) {
      Memory.hivemind.maxScoutDistance = currentScoutDistance - 1;
      for (const roomName in Memory.strategy.roomList) {
        if (Memory.strategy.roomList[roomName].range > Memory.hivemind.maxScoutDistance) {
          delete Memory.rooms[roomName];
          delete Memory.strategy.roomList[roomName];
        }
      }
    } else if (usedMemory < 1500000 && currentScoutDistance < 10) {
      Memory.hivemind.maxScoutDistance = currentScoutDistance + 1;
    }
  }

  // Periodically clean old room memory.
  if (Game.time % 3738 === 2100 && hivemind.getSegmentMemory().isReady()) {
    let count = 0;
    for (const roomName in Memory.rooms) {
      if (hivemind.roomIntel(roomName).getAge() > 100000) {
        delete Memory.rooms[roomName];
        count++;
      }
    }

    if (count > 0) {
      hivemind.log("main").debug("Pruned old memory for", count, "rooms.");
    }
  }

  // @todo Periodically clean old room intel from segment memory.
  // @todo Periodically clean old room planner from segment memory.

  // Periodically clean old squad memory.
  if (Game.time % 548 === 3) {
    for (const squadName in Memory.squads) {
      const memory = Memory.squads[squadName];
      // Only delete if squad can't be spawned.
      if (memory.spawnRoom && Game.rooms[memory.spawnRoom]) return;

      // Don't delete inter-shard squad that can't have a spawn room.
      if (squadName === "interShardExpansion") return;

      // Only delete if there are no creeps belonging to this squad.
      if (_.size(_.filter(Game.creeps, creep => creep.memory.squadName === squadName)) > 0) return;

      delete Memory.squads[squadName];
    }
  }

  // Periodically garbage collect in caches.
  if (Game.time % 253 === 0) {
    cache.collectGarbage();
    cache.collectGarbage(Memory);
  }

  // Periodically clean memory that is no longer needed.
  if (Game.time % 1234 === 56) {
    _.each(Memory.rooms, roomMemory => {
      delete roomMemory.bays;
      delete roomMemory.sources;
      delete roomMemory.minerals;
      delete roomMemory.structureCache;
      delete roomMemory.remoteHarvesting;
    });
  }
}

/**
 *
 */
function showDebug() {
  if (typeof Memory.hivemind.showProcessDebug === "number" && Memory.hivemind.showProcessDebug > 0) {
    Memory.hivemind.showProcessDebug--;
    hivemind.drawProcessDebug();
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);
  // if (profiler) {
  //   profiler.wrap(this.runTick);
  // } else {
  runTick();
  // }
});
