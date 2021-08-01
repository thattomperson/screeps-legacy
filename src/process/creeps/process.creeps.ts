"use strict";

/* global hivemind */

import * as utilities from "../../utils";
import CreepManager from "../../creep-manager";
import Process from "../process";
import SpawnPowerCreepsProcess from "./process.creeps.power.spawn";
// Power creep roles.
import OperatorRole from "./role.operator";

// Normal creep roles.
const creepRoles = [
  "brawler",
  "builder",
  "builder.exploit",
  "builder.remote",
  "claimer",
  "dismantler",
  "gatherer",
  "gift",
  "harvester",
  "harvester.exploit",
  "harvester.power",
  "harvester.remote",
  "hauler",
  "hauler.exploit",
  "hauler.power",
  "helper",
  "scout",
  "transporter",
  "unassigned",
  "upgrader"
];

/**
 * Runs logic for all creeps and power creeps.
 * @constructor
 *
 * @param {object} params
 *   Options on how to run this process.
 * @param {object} data
 *   Memory object allocated for this process' stats.
 */
export default class CreepsProcess extends Process {
  public constructor(params, data) {
    super(params, data);

    this.creepManager = new CreepManager();
    for (const roleName of creepRoles) {
      const RoleClass = require("./role." + roleName);
      this.creepManager.registerCreepRole(roleName, new RoleClass());
    }

    const HarvesterRole = require("./role.harvester");
    this.creepManager.registerCreepRole("harvester.minerals", new HarvesterRole());

    this.powerCreepManager = new CreepManager();
    this.powerCreepManager.registerCreepRole("operator", new OperatorRole());
  }

  /**
   * Runs logic for all creeps.
   */
  public run() {
    // Run normal creeps.
    this.creepManager.onTickStart();
    _.each(Game.creepsByRole, (creeps, role) => {
      hivemind.runSubProcess("creeps_" + role, () => {
        utilities.bubbleWrap(() => {
          this.creepManager.manageCreeps(creeps);
        });
      });
    });
    this.creepManager.report();

    // Run power creeps.
    const powerCreeps = _.filter(Game.powerCreeps, creep => (creep.ticksToLive || 0) > 0);
    this.powerCreepManager.onTickStart();
    utilities.bubbleWrap(() => {
      this.powerCreepManager.manageCreeps(powerCreeps);
    });
    this.powerCreepManager.report();

    // Spawn power creeps.
    hivemind.runProcess("creeps_power_spawn", SpawnPowerCreepsProcess, {
      interval: 10
    });

    // Move blocking creeps if necessary.
    _.each(Game.creeps, creep => {
      if (creep._blockingCreepMovement) {
        creep.room.visual.text("X", creep.pos);
      }

      if (creep._blockingCreepMovement && !creep._hasMoveIntent) {
        if (creep.pos.getRangeTo(creep._blockingCreepMovement) === 1) {
          // Swap with blocked creep.
          creep.move(creep.pos.getDirectionTo(creep._blockingCreepMovement.pos));
          creep._blockingCreepMovement.move(creep._blockingCreepMovement.pos.getDirectionTo(creep.pos));
        } else {
          creep.moveTo(creep._blockingCreepMovement.pos, { range: 1 });
        }
      }
    });
  }
}
