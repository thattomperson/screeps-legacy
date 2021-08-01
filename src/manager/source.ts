"use strict";

import { inHeap, inObject } from "../cache";
import { isStructureContainer, isStructureKeeperLair, isStructureLink } from "../utils/guards";

declare global {
  interface Source {
    readonly harvesters: Creep[];
    getNumHarvestSpots(): number;
    getNearbyContainer(): StructureContainer | null;
    getNearbyLink(): StructureLink | null;
  }

  interface Mineral {
    readonly harvesters: Creep[];
    getNumHarvestSpots(): number;
    getNearbyContainer(): StructureContainer | null;
  }
}

// Define quick access property source.harvesters.
Object.defineProperty(Source.prototype, "harvesters", {
  /**
   * Gets a source's assigned harvesters.
   *
   * @return {Creep[]}
   *   Harvesters for this source.
   */
  get(this: Source): Creep[] {
    return inObject<Creep[]>(this, "harvesters", 1, () => {
      const harvesters = [];
      for (const harvester of _.values<Creep>(this.room.creepsByRole.harvester) || []) {
        if (harvester.memory.fixedSource === this.id) {
          harvesters.push(harvester);
        }
      }

      return harvesters;
    });
  },
  enumerable: false,
  configurable: true
});

// Define quick access property mineral.harvesters.
Object.defineProperty(Mineral.prototype, "harvesters", {
  /**
   * Gets a mineral's assigned harvesters.
   *
   * @return {Creep[]}
   *   Harvesters for this mineral.
   */
  get(this: Mineral) {
    return inObject(this, "harvesters", 1, () => {
      const harvesters = [];
      if (!this.room) {
        return [];
      }

      for (const harvester of _.values<Creep>(this.room.creepsByRole.harvester) || []) {
        if (harvester.memory.fixedMineral === this.id) {
          harvesters.push(harvester);
        }
      }

      return harvesters;
    });
  },
  enumerable: false,
  configurable: true
});

/**
 * Calculates and caches the number of walkable tiles around a source.
 *
 * @return {number}
 *   Maximum number of harvesters on this source.
 */
const getNumHarvestSpots = function (this: Source | Mineral): number {
  return inHeap(`numFreeSquares:${this.id}`, 5000, () => {
    if (!this.room) return 0;

    const terrain = this.room.lookForAtArea(
      LOOK_TERRAIN,
      this.pos.y - 1,
      this.pos.x - 1,
      this.pos.y + 1,
      this.pos.x + 1,
      true
    );
    const adjacentTerrain = [];
    for (const tile of terrain) {
      if (tile.x === this.pos.x && tile.y === this.pos.y) continue;
      if (tile.terrain === "plain" || tile.terrain === "swamp") {
        // @todo Make sure no structures are blocking this tile.
        adjacentTerrain.push(tile);
      }
    }

    return adjacentTerrain.length;
  });
};

/**
 * Calculates and caches the number of walkable tiles around a source.
 *
 * @return {number}
 *   Maximum number of harvesters on this source.
 */
Source.prototype.getNumHarvestSpots = function () {
  return getNumHarvestSpots.call(this);
};

/**
 * Calculates and caches the number of walkable tiles around a source.
 *
 * @return {number}
 *   Maximum number of harvesters on this mineral.
 */
Mineral.prototype.getNumHarvestSpots = function () {
  return getNumHarvestSpots.call(this);
};

/**
 * Finds a container in close proximity to this source, for dropping off energy.
 *
 * @return {StructureContainer}
 *   A container close to this source.
 */
const getNearbyContainer = function (this: Source | Mineral): StructureContainer | null {
  const containerId = inHeap<Id<StructureContainer> | undefined>(`container:${this.id}`, 150, () => {
    // @todo Could use old data and just check if object still exits.
    // Check if there is a container nearby.
    const structures = this.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: isStructureContainer
    }) as unknown as StructureContainer[];
    if (structures.length > 0) {
      const structure = this.pos.findClosestByRange<StructureContainer>(structures);
      if (structure) return structure.id;
    }
    return;
  });

  if (containerId) {
    return Game.getObjectById(containerId);
  }
  return null;
};

/**
 * Finds a container in close proximity to this source, for dropping off energy.
 *
 * @return {StructureContainer}
 *   A container close to this source.
 */
Source.prototype.getNearbyContainer = function () {
  return getNearbyContainer.call(this);
};

/**
 * Finds a container in close proximity to this mineral, for dropping off resources.
 *
 * @return {StructureContainer}
 *   A container close to this mineral.
 */
Mineral.prototype.getNearbyContainer = function () {
  return getNearbyContainer.call(this);
};

/**
 * Finds a link in close proximity to this source, for dropping off energy.
 *
 * @return {StructureLink}
 *   A link close to this source.
 */
Source.prototype.getNearbyLink = function (): StructureLink | null {
  const linkId = inHeap<Id<StructureLink> | undefined>(`link:${this.id}`, 1000, () => {
    // @todo Could use old data and just check if object still exits.
    // Check if there is a link nearby.
    const structures = this.pos.findInRange<StructureLink>(FIND_STRUCTURES, 3, {
      filter: isStructureLink
    });
    if (structures.length > 0) {
      const structure = this.pos.findClosestByRange<StructureLink>(structures);
      if (structure) return structure.id;
    }
    return;
  });

  if (linkId) {
    return Game.getObjectById(linkId);
  }

  return null;
};

/**
 * Finds a source keeper lair in close proximity to this source.
 *
 * @return {StructureKeeperLair}
 *   The lair protecting this source.
 */
const getNearbyLair = function (this: Source | Mineral): StructureKeeperLair | null {
  const lairId = inHeap<Id<StructureKeeperLair> | undefined>(`lair:${this.id}`, 150000, () => {
    // @todo Could use old data and just check if object still exits.
    // Check if there is a lair nearby.
    const structures = this.pos.findInRange(FIND_STRUCTURES, 10, {
      filter: isStructureKeeperLair
    });
    if (structures.length > 0) {
      const structure = this.pos.findClosestByRange(structures);
      if (structure) return structure.id;
    }
    return;
  });

  if (lairId) {
    return Game.getObjectById(lairId);
  }

  return null;
};

/**
 * Finds a source keeper lair in close proximity to this source.
 *
 * @return {StructureKeeperLair}
 *   The lair protecting this source.
 */
Source.prototype.getNearbyLair = function () {
  return getNearbyLair.call(this);
};

/**
 * Finds a source keeper lair in close proximity to this mineral.
 *
 * @return {StructureKeeperLair}
 *   The lair protecting this mineral.
 */
Mineral.prototype.getNearbyLair = function () {
  return getNearbyLair.call(this);
};

/**
 * Checks if a keeper lair is considered dangerous.
 *
 * @return {boolean}
 *   True if a source keeper is spawned or about to spawn.
 */
StructureKeeperLair.prototype.isDangerous = function () {
  return !this.ticksToSpawn || this.ticksToSpawn < 20;
};

/**
 * Checks if being close to this source is currently dangerous.
 *
 * @return {boolean}
 *   True if an active keeper lair is nearby and we have no defenses.
 */
const isDangerous = function () {
  const lair = this.getNearbyLair();
  if (!lair || !lair.isDangerous()) return false;

  // It's still safe if a guardian with sufficient lifespan is nearby to take care of any source keepers.
  if (this.room.creepsByRole.brawler) {
    for (const guardian of this.room.creepsByRole.brawler) {
      if (
        lair.pos.getRangeTo(guardian) < 5 &&
        guardian.ticksToLive > 30 &&
        guardian.memory.exploitUnitType === "guardian"
      ) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Checks if being close to this source is currently dangerous.
 *
 * @return {boolean}
 *   True if an active keeper lair is nearby and we have no defenses.
 */
Source.prototype.isDangerous = function () {
  return isDangerous.call(this);
};

/**
 * Checks if being close to this mineral is currently dangerous.
 *
 * @return {boolean}
 *   True if an active keeper lair is nearby and we have no defenses.
 */
Mineral.prototype.isDangerous = function () {
  return isDangerous.call(this);
};
