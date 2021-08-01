import cache from "../cache";

let ownUserName: string;

/**
 * Dynamically determines the username of the current user.
 *
 * @return {string}
 *   The determined user name.
 */
export function getUsername(): string {
  if (ownUserName) return ownUserName;

  if (_.size(Game.spawns) === 0) {
    if (_.size(Game.creeps) === 0) return "@undefined";

    ownUserName = _.sample(Game.creeps).owner.username;
    return ownUserName;
  }

  ownUserName = _.sample(Game.spawns).owner.username;
  return ownUserName;
}

/**
 * Runs a callback within a try/catch block.
 *
 * @param {function} callback
 *   The callback to run.
 *
 * @return {mixed}
 *   Whatever the original fuction returns.
 */
export function bubbleWrap<T extends any>(callback: () => T): T | null {
  try {
    return callback();
  } catch (error) {
    let errorLocation = "N/A";
    if (global.hivemind.currentProcess) {
      errorLocation = global.hivemind.currentProcess.constructor.name;
    }

    Game.notify(error.name + " in " + errorLocation + ":<br>" + error.stack);
    console.log(error.name + " in " + errorLocation + ":<br>" + error.stack);

    return null;
  }
}

/**
 * Finds a path using PathFinder.search.
 *
 * @param {RoomPosition} startPosition
 *   Position to start the search from.
 * @param {object} endPosition
 *   Position or Positions or object with information about path target.
 * @param {boolean} allowDanger
 *   If true, allow traversing unsafe rooms.
 * @param {object} addOptions
 *   Options to add to pathfinder options.
 *
 * @return {object}
 *   Result of the pathfinding operation.
 */
export function getPath(startPosition, endPosition, allowDanger, addOptions) {
  const options = {
    plainCost: 2,
    swampCost: 10,
    maxOps: 10000, // The default 2000 can be too little even at a distance of only 2 rooms.

    roomCallback: roomName => {
      // If a room is considered inaccessible, don't look for paths through it.
      if (!allowDanger && global.hivemind.segmentMemory.isReady() && global.hivemind.roomIntel(roomName).isOwned()) {
        if (!addOptions || !addOptions.whiteListRooms || addOptions.whiteListRooms.indexOf(roomName) === -1) {
          return false;
        }
      }

      const options = {};
      if (addOptions && addOptions.singleRoom && addOptions.singleRoom === roomName) {
        options.singleRoom = true;
      }

      // Work with roads and structures in a room.
      const costs = getCostMatrix(roomName, options);

      // Also try not to drive through bays.
      if (Game.rooms[roomName] && Game.rooms[roomName].roomPlanner) {
        _.each(Game.rooms[roomName].roomPlanner.getLocations("bay_center"), pos => {
          if (costs.get(pos.x, pos.y) <= 20) {
            costs.set(pos.x, pos.y, 20);
          }
        });
      }

      // @todo Try not to drive too close to sources / minerals / controllers.
      // @todo Avoid source keepers.

      return costs;
    }
  };

  if (addOptions) {
    _.each(addOptions, (value, key) => {
      options[key] = value;
    });
  }

  return PathFinder.search(startPosition, endPosition, options);
}

/**
 * Generates a new CostMatrix for pathfinding.
 *
 * @param {string} roomName
 *   Name of the room to generate a cost matrix for.
 * @param {object} structures
 *   Arrays of structures to navigate around, keyed by structure type.
 * @param {object} constructionSites
 *   Arrays of construction sites to navigate around, keyed by structure type.
 *
 * @return {PathFinder.CostMatrix}
 *   A cost matrix representing the given obstacles.
 */
export function generateCostMatrix(roomName, structures, constructionSites) {
  const costs = new PathFinder.CostMatrix();

  this.markBuildings(
    roomName,
    structures,
    constructionSites,
    structure => {
      if (costs.get(structure.pos.x, structure.pos.y) === 0) {
        costs.set(structure.pos.x, structure.pos.y, 1);
      }
    },
    structure => costs.set(structure.pos.x, structure.pos.y, 0xff),
    (x, y) => costs.set(x, y, 0xff)
  );

  return costs;
}

/**
 * Generates an obstacle list as an alternative to cost matrixes.
 *
 * @param {string} roomName
 *   Name of the room to generate an obstacle list for.
 * @param {object} structures
 *   Arrays of structures to navigate around, keyed by structure type.
 * @param {object} constructionSites
 *   Arrays of construction sites to navigate around, keyed by structure type.
 *
 * @return {object}
 *   An object containing encoded room positions in the following keys:
 *   - obstacles: Any positions a creep cannot move through.
 *   - roads: Any positions where a creep travels with road speed.
 */
export function generateObstacleList(roomName, structures, constructionSites) {
  const result = {
    obstacles: [],
    roads: []
  };

  this.markBuildings(
    roomName,
    structures,
    constructionSites,
    structure => {
      const location = serializeCoords(structure.pos.x, structure.pos.y);
      if (!_.contains(result.obstacles, location)) {
        result.roads.push(location);
      }
    },
    structure => result.obstacles.push(serializePosition(structure.pos, roomName)),
    (x, y) => {
      const location = serializeCoords(x, y);
      if (!_.contains(result.obstacles, location)) {
        result.obstacles.push(location);
      }
    }
  );

  return result;
}

/**
 * Runs code for all given obstacles and roads.
 *
 * @param {String} roomName
 *   Name of the room that's being handled.
 * @param {object} structures
 *   Arrays of structures to navigate around, keyed by structure type.
 * @param {object} constructionSites
 *   Arrays of construction sites to navigate around, keyed by structure type.
 * @param {Function} roadCallback
 *   Gets called for every road found in structures.
 * @param {Function} blockerCallback
 *   Gets called for every obstacle found in structures or constructionSites.
 * @param {Function} sourceKeeperCallback
 *   Gets called for every position in range of a source keeper.
 */
export function markBuildings(
  roomName,
  structures,
  constructionSites,
  roadCallback,
  blockerCallback,
  sourceKeeperCallback
) {
  _.each(OBSTACLE_OBJECT_TYPES, structureType => {
    _.each(structures[structureType], structure => {
      // Can't walk through non-walkable buildings.
      blockerCallback(structure);
    });

    _.each(constructionSites[structureType], site => {
      // Can't walk through non-walkable construction sites.
      blockerCallback(site);
    });
  });

  _.each(structures[STRUCTURE_PORTAL], structure => {
    // Treat portals as blocking. They will be targetted intentionally.
    blockerCallback(structure);
  });

  _.each(structures[STRUCTURE_RAMPART], structure => {
    if (!structure.my) {
      // Enemy ramparts are blocking.
      blockerCallback(structure);
    }
  });

  if (global.hivemind.segmentMemory.isReady()) {
    const roomIntel = global.hivemind.roomIntel(roomName);
    if (_.size(structures[STRUCTURE_KEEPER_LAIR]) > 0) {
      // @todo If we're running a (successful) exploit in this room, tiles
      // should not be marked inaccessible.
      // Add area around keeper lairs as obstacles.
      _.each(structures[STRUCTURE_KEEPER_LAIR], structure => {
        handleMapArea(
          structure.pos.x,
          structure.pos.y,
          (x, y) => {
            sourceKeeperCallback(x, y);
          },
          3
        );
      });

      // Add area around sources as obstacles.
      _.each(roomIntel.getSourcePositions(), sourceInfo => {
        handleMapArea(
          sourceInfo.x,
          sourceInfo.y,
          (x: number, y: number) => {
            sourceKeeperCallback(x, y);
          },
          4
        );
      });

      // Add area around mineral as obstacles.
      const mineralInfo = roomIntel.getMineralPosition();
      if (mineralInfo) {
        handleMapArea(
          mineralInfo.x,
          mineralInfo.y,
          (x, y) => {
            sourceKeeperCallback(x, y);
          },
          4
        );
      }
    }

    // For exit consistency, we need to check corresponding exit
    // tiles of adjacend rooms, and if blocked by source keepers, block tiles
    // in our own room as well.
    const exits = roomIntel.getExits();
    for (const dir of [TOP, BOTTOM, LEFT, RIGHT]) {
      if (!exits[dir]) continue;

      const otherRoomName = exits[dir];
      const otherRoomIntel = global.hivemind.roomIntel(otherRoomName);
      if (!otherRoomIntel || !otherRoomIntel.hasCostMatrixData()) continue;

      const matrix = getCostMatrix(otherRoomName);
      if (dir === TOP || dir === BOTTOM) {
        const y = dir === TOP ? 0 : 49;
        for (let x = 1; x < 49; x++) {
          if (matrix.get(x, 49 - y) > 100) sourceKeeperCallback(x, y);
        }

        continue;
      }

      const x = dir === LEFT ? 0 : 49;
      for (let y = 1; y < 49; y++) {
        if (matrix.get(49 - x, y) > 100) sourceKeeperCallback(x, y);
      }
    }
  }

  _.each(structures[STRUCTURE_ROAD], structure => {
    // Favor roads over plain tiles.
    roadCallback(structure);
  });
}

/**
 * Gets the pathfinding cost matrix for a room.
 *
 * @param {string} roomName
 *   Name of the room.
 * @param {object} options
 *   Further options regarding the matrix. Can have the following keys:
 *   - `singleRoom`: If true, return a matrix for creeps that cannot leave
 *     the room.
 *
 * @return {PathFinder.CostMatrix}
 *   The requested cost matrix.
 */
export function getCostMatrix(roomName: string, options: { singleRoom: boolean } = { singleRoom: false }) {
  let cacheKey = "costMatrix:" + roomName;
  let matrix = global.hivemind.segmentMemory.isReady()
    ? cache.inHeap(cacheKey, 500, () => {
        const roomIntel = global.hivemind.roomIntel(roomName);
        return roomIntel.getCostMatrix();
      })
    : new PathFinder.CostMatrix();

  if (matrix && options.singleRoom && global.hivemind.segmentMemory.isReady()) {
    // Highly discourage room exits if creep is supposed to stay in a room.
    cacheKey += ":singleRoom";

    matrix = cache.inHeap(cacheKey, 500, () => {
      return generateSingleRoomCostMatrix(matrix, roomName);
    });
  }

  return matrix;
}

/**
 * Generates a derivative cost matrix that highly discourages room exits.
 *
 * @param {PathFinder.CostMatrix} matrix
 *   The matrix to use as a base.
 * @param {string} roomName
 *   Name of the room this matrix represents.
 *
 * @return {PathFinder.CostMatrix}
 *   The modified cost matrix.
 */
export function generateSingleRoomCostMatrix(matrix: CostMatrix, roomName: string): CostMatrix {
  const newMatrix = matrix.clone();
  const terrain = new Room.Terrain(roomName);
  for (let x = 0; x < 50; x++) {
    for (let y = 0; y < 50; y++) {
      if ((x === 0 || y === 0 || x === 49 || y === 49) && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
        newMatrix.set(x, y, 50);
      }
    }
  }

  return newMatrix;
}

/**
 * Returns closest target to a room object.
 *
 * @param {RoomObject} roomObject
 *   The room object the search originates from.
 * @param {RoomObject[]} targets
 *   A list of room objects to check.
 *
 * @return {RoomObject}
 *   The closest target.
 */
export function getClosest<T extends _HasId & RoomObject>(roomObject: _HasRoomPosition, targets: T[]): Id<T> | null {
  if (targets.length > 0) {
    const target = roomObject.pos.findClosestByRange(targets);
    if (target) {
      target.id;
    }
  }

  return null;
}

/**
 * Gets most highly rated option from a list.
 *
 * @param {Array} options
 *   List of options, each option should at least contain the keys `priority`
 *   and `weight`.
 *
 * @return {object}
 *   The object with the highest priority and weight (within that priority).
 */
export function getBestOption(options: { priority: number; weight: number }[]) {
  let best = null;

  for (const option of options) {
    if (option.priority < 0) continue;
    if (
      !best ||
      option.priority > best.priority ||
      (option.priority === best.priority && option.weight > best.weight)
    ) {
      best = option;
    }
  }

  return best;
}

/**
 * Calculates how much a creep cost to spawn.
 * @todo Move into Creep.prototype.
 *
 * @param {Creep} creep
 *   The creep in question.
 *
 * @return {number}
 *   Energy cost for this creep.
 */
export function getBodyCost(creep: Creep) {
  let cost = 0;
  for (const part of creep.body) {
    cost += BODYPART_COST[part.type];
  }

  return cost;
}

/**
 * Get part counts for this creep.
 * @todo Move into Creep.prototype.
 *
 * @param {Creep} creep
 *   The creep in question.
 *
 * @return {object}
 *   Amount of parts of each type in the creep's body.
 */
export function getBodyParts(creep) {
  return creep.memory.body;
}

/**
 * Serializes a position for storing it in memory.
 * @todo Move to RoomPosition.prototype.
 *
 * @param {RoomPosition} position
 *   The position to encode.
 *
 * @return {string}
 *   The encoded position.
 */
export function encodePosition(position: undefined): undefined;
export function encodePosition(position: RoomPosition): string;
export function encodePosition(position: RoomPosition | undefined): string | undefined {
  if (!position) return;

  return `${position.roomName}@${position.x}x${position.y}`;
}

/**
 * Creates a RoomPosition object from serialized data.
 * @todo Move to RoomPosition as static function.
 *
 * @param {string} position
 *   The encoded position.
 *
 * @return {RoomPosition}
 *   The original room position.
 */
export function decodePosition(position: undefined): undefined;
export function decodePosition(position: string): RoomPosition;
export function decodePosition(position: string | undefined): RoomPosition | undefined {
  if (!position) return;

  const parts = /^(.*)@(\d*)x(\d*)$/.exec(position);

  if (parts && parts.length > 0) {
    return new RoomPosition(parseInt(parts[2], 10), parseInt(parts[3], 10), parts[1]);
  }

  return;
}

export function serializeCoords(x: number, y: number, roomName: string) {
  const coords = x + 50 * y;

  if (!roomName) return coords;

  return [coords, roomName];
}

export function deserializeCoords(coords: unknown) {
  // Fallback for old string positions.
  if (typeof coords === "string") {
    const pos = decodePosition(coords);
    return { x: pos.x, y: pos.y };
  }

  // Numbers are positions without a room name.
  if (typeof coords === "number") {
    const x = coords % 50;
    const y = Math.floor(coords / 50);
    return { x, y };
  }

  // Last alternative: Array of coords and room name.
  const x = coords[0] % 50;
  const y = Math.floor(coords[0] / 50);
  return { x, y };
}

export function serializePosition(position, fixedRoom) {
  return serializeCoords(position.x, position.y, position.roomName === fixedRoom ? null : position.roomName);
}

export function deserializePosition(coords: unknown, fixedRoom: string): RoomPosition | null {
  // Fallback for old string positions.
  if (typeof coords === "string") return decodePosition(coords);

  // Numbers are positions without a room name.
  if (typeof coords === "number") {
    const x = coords % 50;
    const y = Math.floor(coords / 50);
    return new RoomPosition(x, y, fixedRoom);
  }

  // Last alternative: Array of coords and room name.
  if (Array.isArray(coords)) {
    const x = coords[0] % 50;
    const y = Math.floor(coords[0] / 50);
    return new RoomPosition(x, y, coords[1]);
  }

  return null;
}

const xOffsets = {
  [TOP]: 0,
  [TOP_RIGHT]: 1,
  [RIGHT]: 1,
  [BOTTOM_RIGHT]: 1,
  [BOTTOM]: 0,
  [BOTTOM_LEFT]: -1,
  [LEFT]: -1,
  [TOP_LEFT]: -1
};

const yOffsets = {
  [TOP]: -1,
  [TOP_RIGHT]: -1,
  [RIGHT]: 0,
  [BOTTOM_RIGHT]: 1,
  [BOTTOM]: 1,
  [BOTTOM_LEFT]: 1,
  [LEFT]: 0,
  [TOP_LEFT]: -1
};

const directions = {
  [-1]: {
    [-1]: TOP_LEFT,
    0: TOP,
    1: TOP_RIGHT
  },
  0: {
    [-1]: LEFT,
    0: null,
    1: RIGHT
  },
  1: {
    [-1]: BOTTOM_LEFT,
    0: BOTTOM,
    1: BOTTOM_RIGHT
  }
};

/**
 * Serializes an array of RoomPosition objects for storing in memory.
 *
 * @param {RoomPosition[]} path
 *   A list of positions to encode.
 *
 * @return {string[]}
 *   The encoded path.
 */
export function serializePositionPath(path) {
  let previous;
  return _.map(path, pos => {
    let result;
    if (previous && previous.roomName === pos.roomName) {
      const dx = pos.x - previous.x;
      const dy = pos.y - previous.y;
      result = directions[dy] && directions[dy][dx];
    }

    previous = pos;
    return result || encodePosition(pos);
  });
}

/**
 * Deserializes a serialized path into an array of RoomPosition objects.
 *
 * @param {string[]} path
 *   A list of positions to decode.
 *
 * @return {RoomPosition[]}
 *   The decoded path.
 */
export function deserializePositionPath(path) {
  let pos;
  return _.map(path, location => {
    if (typeof location === "string") {
      pos = decodePosition(location);
    } else {
      pos = new RoomPosition(pos.x + xOffsets[location], pos.y + yOffsets[location], pos.roomName);
    }

    return pos;
  });
}

/**
 * Generates a Van der Corput sequence.
 *
 * @param {number} power
 *   Number of "digits" relative to base to generate a sequence for.
 * @param {number} base
 *   Base for the sequence. Detemines spacing of the sequence.
 *
 * @return {number[]}
 *   The generated sequence, containing all numbers from 1 to base^power.
 */
export function generateEvenSequence(power, base) {
  const numbers = [];
  const digits = [];
  for (let i = 0; i < power; i++) {
    digits[i] = 0;
  }

  function increase(digit) {
    if (digit >= power) return;

    digits[digit]++;
    if (digits[digit] >= base) {
      digits[digit] = 0;
      increase(digit + 1);
    }
  }

  function getNumber() {
    let sum = 0;
    for (let i = 0; i < power; i++) {
      sum *= base;
      sum += digits[i];
    }

    return sum;
  }

  increase(0);
  let number = getNumber();
  const max = number * base;
  numbers.push(max);
  while (number !== 0) {
    numbers.push(number);
    increase(0);
    number = getNumber();
  }

  return numbers;
}

/**
 * Choose whether an operation should currently run based on priorities.
 *
 * @param {number} offset
 *   Offset to add to time, so not all operations get throttled on the same tick.
 * @param {number} minBucket
 *   Minimum amount of bucket needed for this operation to run.
 * @param {number} maxBucket
 *   Amount of bucket at which this operation should always run.
 *
 * @return {boolean}
 *   True if the operation is allowed to run.
 */
export function throttle(offset, minBucket, maxBucket) {
  initThrottleMemory();

  if (!offset) offset = 0;
  if (!minBucket) minBucket = Memory.throttleInfo.bucket.critical;
  if (!maxBucket) maxBucket = Memory.throttleInfo.bucket.normal;

  const bucket = Game.cpu.bucket;
  if (bucket >= maxBucket) return false;
  if (bucket < minBucket) return true;

  const tick = (Game.time + offset) % Memory.throttleInfo.max;
  const ratio = (bucket - minBucket) / (maxBucket - minBucket);

  if (ratio >= Memory.throttleInfo.numbers[tick]) return false;

  return true;
}

/**
 * Gets a new offset for a throttled operation.
 *
 * @return {number}
 *   Offset to store for a throttled operation.
 */
export function getThrottleOffset() {
  initThrottleMemory();

  if (!Memory.throttleInfo.currentOffset) {
    Memory.throttleInfo.currentOffset = 0;
  }

  Memory.throttleInfo.currentOffset++;
  return Memory.throttleInfo.currentOffset;
}

/**
 * Initializes memory with general throttling information.
 */
export function initThrottleMemory() {
  if (!Memory.throttleInfo) {
    Memory.throttleInfo = {
      bucket: {
        normal: 8000,
        warning: 5000,
        critical: 2000
      }
    };
  }

  if (!Memory.throttleInfo.numbers) {
    Memory.throttleInfo.numbers = [];

    const sequence = generateEvenSequence(8, 2);
    const max = sequence[0];
    Memory.throttleInfo.max = max;

    _.each(sequence, (number, index) => {
      Memory.throttleInfo.numbers[number] = 1 - index / max;
    });

    Memory.throttleInfo.numbers[0] = 1;
  }
}

/**
 * Runs a function for every tile in range around a given center coordinate.
 *
 * @param {number} x
 *   Center tile's x coordinate.
 * @param {number} y
 *   Center tile's y coordinate.
 * @param {function} callback
 *   Callback that gets invoked for every tile with x and y coordinates as
 *   arguments. It may explicitly return false to stop looping through tiles.
 * @param {number} range
 *   (Optional) Range around the center to run code for. Defaults to 1.
 */
export function handleMapArea(x, y, callback, range) {
  if (typeof range === "undefined") range = 1;
  for (let dx = -range; dx <= range; dx++) {
    if (x + dx < 0) continue;
    if (x + dx >= 50) continue;
    for (let dy = -range; dy <= range; dy++) {
      // Clamp to map boundaries.
      if (y + dy < 0) continue;
      if (y + dy >= 50) continue;
      if (callback(x + dx, y + dy) === false) return;
    }
  }
}

/**
 * Generates lookup table for the ingredients used to crate a compound.
 *
 * @return {Object}
 *   A list of recipe reaction components, keyed by the name of the created
 *   compound.
 */
export function getReactionRecipes() {
  return cache.inHeap("reverseReactions", 100000, () => {
    const recipes = {};

    _.each(REACTIONS, (reaction, resourceType) => {
      _.each(reaction, (result, resourceType2) => {
        if (recipes[result]) return;

        recipes[result] = [resourceType, resourceType2];
      });
    });

    return recipes;
  });
}

export default {
  getUsername,
  bubbleWrap,
  getPath,
  generateCostMatrix,
  generateObstacleList,
  markBuildings,
  getCostMatrix,
  generateSingleRoomCostMatrix,
  getClosest,
  getBestOption,
  getBodyCost,
  getBodyParts,
  encodePosition,
  decodePosition,
  serializeCoords,
  deserializeCoords,
  serializePosition,
  deserializePosition,
  serializePositionPath,
  deserializePositionPath,
  generateEvenSequence,
  throttle,
  getThrottleOffset,
  initThrottleMemory,
  handleMapArea,
  getReactionRecipes
};
