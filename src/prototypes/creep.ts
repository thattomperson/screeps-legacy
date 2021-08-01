/* eslint-disable no-underscore-dangle */
import "./creep.military";
import "./creep.movement";
import "./creep.train";

declare global {
  interface CreepMemory {
    role: string;
    squadName?: string;
    squadUnitType?: string;
    exploitName: string;
  }

  interface Room {
    creeps: Record<string, Creep>;
    creepsByRole: Record<string, Record<string, Creep>>;
  }

  interface Creep {
    transferAny: (target: Structure) => ScreepsReturnCode;
    dropAny: () => OK | ERR_NOT_OWNER | ERR_BUSY | ERR_NOT_ENOUGH_RESOURCES;
    enhanceData: () => void;
  }
}

if (!Creep.prototype.__enhancementsLoaded) {
  // Define quick access property creep.operation.
  Object.defineProperty(Creep.prototype, "operation", {
    /**
     * Gets the operation this creep belongs to, if any.
     *
     * @return {Operation}
     *   The operation this creep belongs to.
     */
    get() {
      return Game.operations[this.memory.operation || ""];
    },
    enumerable: false,
    configurable: true
  });

  /**
   * Transfer resources to a target, if the creep carries any.
   *
   * @param {RoomObject} target
   *   The target to transfer resources to.
   *
   * @return {number}
   *   Error codes as in Creep.transfer().
   */
  Creep.prototype.transferAny = function (target: Structure) {
    for (const resourceType of RESOURCES_ALL) {
      if (target.structureType === STRUCTURE_LINK && resourceType !== RESOURCE_ENERGY) continue;
      if (this.store[resourceType] > 0) {
        return this.transfer(target, resourceType);
      }
    }

    return ERR_NOT_ENOUGH_RESOURCES;
  };

  /**
   * Drop resources on the ground, if the creep carries any.
   *
   * @return {number}
   *   Error codes as in Creep.drop().
   */
  Creep.prototype.dropAny = function () {
    for (const resourceType of RESOURCES_ALL) {
      if (this.store[resourceType] > 0) {
        return this.drop(resourceType);
      }
    }

    return ERR_NOT_ENOUGH_RESOURCES;
  };

  /**
   * Add additional data for each creep.
   */
  Creep.prototype.enhanceData = function () {
    if (!this.memory.role) {
      this.memory.role = "unassigned";
    }

    const role = this.memory.role;

    // Store creeps by role in global and room data.
    if (!Game.creepsByRole[role]) {
      Game.creepsByRole[role] = {};
    }

    Game.creepsByRole[role][this.name] = this;

    const room = this.room;
    if (!room.creeps) {
      room.creeps = {};
      room.creepsByRole = {};
    }

    room.creeps[this.name] = this;
    if (!room.creepsByRole[role]) {
      room.creepsByRole[role] = {};
    }

    room.creepsByRole[role][this.name] = this;

    // Store creeps that are part of a squad in their respectice squads.
    if (this.memory.squadName) {
      const squad = Game.squads[this.memory.squadName];
      if (squad) {
        if (!squad.units[this.memory.squadUnitType]) {
          squad.units[this.memory.squadUnitType] = [];
        }

        squad.units[this.memory.squadUnitType].push(this);
      }
    }

    // Store creeps that are part of an exploit operation in the correct object.
    if (this.memory.exploitName) {
      if (!Game.exploitTemp[this.memory.exploitName]) {
        Game.exploitTemp[this.memory.exploitName] = [];
      }

      Game.exploitTemp[this.memory.exploitName].push(this.id);
    }
  };

  Creep.prototype.__enhancementsLoaded = true;
}
