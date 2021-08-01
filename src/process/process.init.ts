"use strict";

/* global hivemind */

import BoostManager from "./manager.boost";
import Process from "./process";
import RoomPlanner from "./room-planner";
import RoomManager from "./room-manager";
import Squad from "./manager.squad";
import * as operations from "operation";

declare global {
  /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definiton alone.
          You must also give them an implemention if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
  // Memory extension samples
  interface Game {
    squads: Record<string, Squad>;
    exploits: unknown;
    creepsByRole: Record<string, Record<string, Creep>>;
    exploitTemp: Record<string, string[]>;
    operations: Record<string, operations.Operation>;
    operationsByType: Record<string, Record<string, operations.Operation>>;
  }
}

/**
 * Initializes member variables that should be available to all processes.
 * @constructor
 *
 * @param {object} params
 *   Options on how to run this process.
 * @param {object} data
 *   Memory object allocated for this process' stats.
 */
export default class InitProcess extends Process {
  public constructor(params: any, data: any) {
    super(params, data);
  }

  /**
   * @override
   */
  public run(): void {
    Game.squads = {};
    Game.exploits = {};
    Game.creepsByRole = {};
    Game.exploitTemp = {};
    Game.operations = {};
    Game.operationsByType = {};

    // Add data to global Game object.
    for (const squadName in Memory.squads) {
      Game.squads[squadName] = new Squad(squadName);
    }

    _.each(operations, (opClass, opType) => {
      Game.operationsByType[opType.n] = {};
    });
    _.each(Memory.operations, (data, opName) => {
      if (data.shouldTerminate) {
        delete Memory.operations[opName];
        return;
      }

      const operation = new operations[data.type](opName);
      Game.operations[opName] = operation;
      Game.operationsByType[data.type][opName] = operation;
    });

    // Cache creeps per room and role.
    _.each(Game.creeps, creep => {
      creep.enhanceData();
    });

    _.each(Game.rooms, room => {
      if (room.isMine()) {
        if (hivemind.segmentMemory.isReady()) room.roomPlanner = new RoomPlanner(room.name);
        room.roomManager = new RoomManager(room);
        room.boostManager = new BoostManager(room.name);
        room.generateLinkNetwork();
      }

      room.enhanceData();
    });
  }
}
