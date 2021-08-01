"use strict";

/* global LOOK_STRUCTURES STRUCTURE_RAMPART ATTACK HEAL CLAIM */

// @todo Evacuate room when walls are breached, or when spawns are gone, ...
// @todo Destroy terminal and storage if not hope of recovery, then unclaim

export default class RoomDefense {
  protected roomName: string;
  protected room: Room;

  public constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];
  }

  /**
   * Checks if a room's walls are intact.
   *
   * @return {boolean}
   *   True if all planned ramparts are built and strong enough.
   */
  public isWallIntact() {
    if (!this.room.roomPlanner) return true;

    const rampartPositions = this.room.roomPlanner.getLocations("rampart");
    const requiredHits = 25000 * this.room.controller.level * this.room.controller.level;

    for (const pos of rampartPositions) {
      // Check if there's a rampart here already.
      const structures = pos.lookFor(LOOK_STRUCTURES);
      if (
        _.filter(
          structures,
          structure => structure.structureType === STRUCTURE_RAMPART && structure.hits >= requiredHits
        ).length === 0
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Determines enemy strength in a room.
   *
   * @return {Number}
   *   0: No enemies in the room.
   *   1: Enemies are very weak, towers can take them out.
   *   2: Enemies are strong or numerous.
   */
  public getEnemyStrength() {
    let attackStrength = 0;
    let boosts = 0;

    _.each(this.room.enemyCreeps, creeps => {
      for (const creep of creeps) {
        for (const part of creep.body) {
          if (part.type === ATTACK || part.type === HEAL || part.type === CLAIM) {
            attackStrength++;
            if (part.boost) {
              boosts += part.boost.length;
            }

            continue;
          }
        }
      }
    });

    if (attackStrength === 0) return 0;
    if (boosts + attackStrength < 30) return 1;
    return 2;
  }
}
