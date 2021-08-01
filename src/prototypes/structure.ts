/* eslint-disable no-underscore-dangle */
"use strict";

import Bay from "../manager/bay";
import { isStructureRampart } from "../utils/guards";

declare global {
  interface Structure {
    __enhancementsLoaded: boolean;
    isWalkable(): boolean;
    isOperational(): boolean;
  }

  interface StructureExtension {
    isBayExtension(): boolean;
    bayChecked: boolean;
    bay: Bay | null;
  }

  interface StructureSpawn {
    isBaySpawn(): boolean;
    calculateCreepBodyCost(bodyMemory: Record<BodyPartConstant, number>): number;
  }

  interface StructureTower {
    getPowerAtRange(range: number): number;
  }
}

if (!Structure.prototype.__enhancementsLoaded) {
  /**
   * Checks whether a structure can be moved onto.
   *
   * @return {boolean}
   *   True if a creep can move onto this structure.
   */
  Structure.prototype.isWalkable = function () {
    if (_.includes(OBSTACLE_OBJECT_TYPES, this.structureType)) return false;
    if (isStructureRampart(this)) {
      return this.my || this.isPublic;
    }

    return true;
  };

  /**
   * Replacement for Structure.prototype.isActive that is less CPU intensive.
   * @see InactiveStructuresProcess
   *
   * @return {boolean}
   *   True if the structure is operational.
   */
  Structure.prototype.isOperational = function () {
    if (!this.room.memory.inactiveStructures) return true;
    if (!this.room.memory.inactiveStructures[this.id]) return true;
    return false;
  };

  /**
   * Checks whether this extension belongs to any bay.
   *
   * @return {boolean}
   *   True if the extension is part of a bay.
   */
  StructureExtension.prototype.isBayExtension = function () {
    if (!this.bayChecked) {
      this.bayChecked = true;
      this.bay = null;

      for (const bay of this.room.bays) {
        if (bay.hasExtension(this)) {
          this.bay = bay;
          break;
        }
      }
    }

    return this.bay !== null;
  };

  StructureSpawn.prototype.isBaySpawn = StructureExtension.prototype.isBayExtension;

  /**
   * Calculates relative tower power at a certain range.
   *
   * @param {number} range
   *   Tile distance between tower and target.
   *
   * @return {number}
   *   Relative power between 0 and 1.
   */
  StructureTower.prototype.getPowerAtRange = function (range) {
    if (range < TOWER_OPTIMAL_RANGE) range = TOWER_OPTIMAL_RANGE;
    if (range > TOWER_FALLOFF_RANGE) range = TOWER_FALLOFF_RANGE;

    return 1 - ((range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE)) * TOWER_FALLOFF;
  };

  /**
   * Calculates the cost of a creep's body parts.
   *
   * @param {object} bodyMemory
   *   An object keyed by body part type, with number of parts as values.
   *
   * @return {number}
   *   The total cost in energy units.
   */
  StructureSpawn.prototype.calculateCreepBodyCost = function (bodyMemory: Record<BodyPartConstant, number>) {
    let cost = 0;

    const partTypes = Object.keys(bodyMemory) as BodyPartConstant[];

    partTypes.forEach(partType => {
      const count = bodyMemory[partType];
      cost += BODYPART_COST[partType] * count;
    });

    return cost;
  };
}
