"use strict";

/* global hivemind Room FIND_STRUCTURES FIND_MY_CONSTRUCTION_SITES
STRUCTURE_KEEPER_LAIR */

const utilities = require("./utilities");

if (!Room.prototype.__enhancementsLoaded) {
  Room.prototype.getCostMatrix = function () {
    return utilities.getCostMatrix(this.name);
  };

  /**
   * Generates a new CostMatrix for pathfinding in this room.
   *
   * @param {Array} structures
   *   An array of structures to navigate around.
   * @param {Array} constructionSites
   *   An array of construction sites to navigate around.
   *
   * @return {PathFinder.CostMatrix}
   *   A cost matrix representing this room.
   */
  Room.prototype.generateCostMatrix = function (structures, constructionSites) {
    if (!structures) {
      structures = _.groupBy(this.find(FIND_STRUCTURES), "structureType");
    }

    if (!constructionSites) {
      constructionSites = _.groupBy(this.find(FIND_MY_CONSTRUCTION_SITES), "structureType");
    }

    return utilities.generateCostMatrix(this.name, structures, constructionSites);
  };

  /**
   * Calculates a list of room names for traveling to a target room.
   *
   * @param {string} targetRoom
   *   Name of the room to navigate to.
   * @param {object} options
   *   - maxPathLength: Paths longer than this will be discarded.
   *   - allowDanger: If true, creep may move through unsafe rooms.
   *
   * @return {string[]}
   *   An array of room names a creep needs to move throught to reach targetRoom.
   */
  Room.prototype.calculateRoomPath = function (targetRoom, options) {
    const roomName = this.name;

    if (!options) options = {};

    const openList = {};
    const closedList = {};
    const allowDanger = options.allowDanger;
    const maxPathLength = options.maxPathLength;

    openList[roomName] = {
      range: 0,
      dist: Game.map.getRoomLinearDistance(roomName, targetRoom),
      origin: roomName,
      path: []
    };

    // A* from here to targetRoom.
    // @todo Avoid unsafe rooms.
    // @todo Some rooms' obstacles prevent moving from one exit to another,
    // but we can deduce that from the cost matrixes we store.
    let finalPath;
    while (_.size(openList) > 0) {
      let minDist;
      let nextRoom;
      let cost = 1;
      _.each(openList, (info, rName) => {
        if (!minDist || info.range + info.dist < minDist) {
          minDist = info.range + info.dist;
          nextRoom = rName;
        }
      });

      if (!nextRoom) break;

      const info = openList[nextRoom];
      delete openList[nextRoom];
      closedList[nextRoom] = true;

      // We're done if we reached targetRoom.
      if (nextRoom === targetRoom) {
        finalPath = info.path;
        break;
      }

      if (maxPathLength && info.path.length >= maxPathLength) {
        // Don't add more exits if max path length has been reached.
        continue;
      }

      // Add unhandled adjacent rooms to open list.
      let exits;
      if (hivemind.segmentMemory.isReady()) {
        exits = _.values(hivemind.roomIntel(nextRoom).getExits());
      } else {
        exits = _.values(Game.map.describeExits(nextRoom));
      }

      for (const exit of exits) {
        if (openList[exit] || closedList[exit]) continue;

        if (hivemind.segmentMemory.isReady()) {
          const exitIntel = hivemind.roomIntel(exit);
          if (exitIntel.isOwned()) {
            if (!allowDanger) continue;

            cost *= 5;
          } else if (exitIntel.isClaimed()) {
            cost *= 1.5;
          }

          if (_.size(exitIntel.getStructures(STRUCTURE_KEEPER_LAIR)) > 0) {
            // Allow pathing through source keeper rooms since we can safely avoid them most of the time.
            cost *= 2;
          }
        }

        const distance = Game.map.getRoomLinearDistance(exit, targetRoom);
        if (distance > 20) continue;

        const path = [];
        for (const step of info.path) {
          path.push(step);
        }

        path.push(exit);

        openList[exit] = {
          range: info.range + cost,
          dist: distance,
          origin: info.origin,
          path
        };
      }
    }

    return finalPath;
  };
}
