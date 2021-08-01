import * as utilities from "./utils";

let memory: Partial<ShardMemory>;
let memoryAge: number;

declare global {
  interface Memory {
    interShardReplacement: Partial<ShardMemory>;
  }

  interface ShardMemory {
    portals: Record<string, Record<string, { dest: string }>>;
    info: {
      ownedRooms: number;
      maxRoomLevel: number;
    };
  }
}

/**
 * Gets the memory object for the current shard.
 *
 * @return {object}
 *   This shard's inter-shard memory.
 */
export function getLocalMemory(): Partial<ShardMemory> {
  if (typeof InterShardMemory === "undefined") {
    // Create mock intershard memory object.
    if (!Memory.interShardReplacement) Memory.interShardReplacement = {};

    memory = Memory.interShardReplacement as ShardMemory;
    return memory;
  }

  if (!memory || Game.time !== memoryAge) {
    memory = JSON.parse(InterShardMemory.getLocal()) || {};
    memoryAge = Game.time;
  }

  return memory;
}

/**
 * Writes the memory object for the current shard.
 *
 * This should only be called at the end of the current tick when no more
 * changes are expected.
 */
export function writeLocalMemory(): void {
  // @todo Only serialize memory once per tick.
  if (!memory) return;
  if (typeof InterShardMemory === "undefined") return;

  InterShardMemory.setLocal(JSON.stringify(memory));
}

/**
 * Gets the memory object for another shard.
 *
 * @param {String} shardName
 *   The name of the shard for which memory is requested.
 *
 * @return {object}
 *   The shard's inter-shard memory.
 */
export function getRemoteMemory(shardName: string): Partial<ShardMemory> {
  if (typeof InterShardMemory === "undefined") return {};

  const blob = InterShardMemory.getRemote(shardName) || "";

  return (JSON.parse(blob) as ShardMemory) || {};
}

/**
 * Registers a portal in intershard memory.
 *
 * @param {StructurePortal} portal
 *   The portal to register.
 */
export function registerPortal(portal: StructurePortal): void {
  const localMemory = getLocalMemory();
  const destination = portal.destination as { shard: string; room: string };
  const targetShard = destination.shard;

  if (!localMemory.portals) localMemory.portals = {};
  if (!localMemory.portals[targetShard]) localMemory.portals[targetShard] = {};
  const pos = utilities.encodePosition(portal.pos);
  if (!localMemory.portals[targetShard][pos]) {
    localMemory.portals[targetShard][pos] = {
      dest: destination.room
    };
  } else {
    localMemory.portals[targetShard][pos].dest = destination.room;
  }

  writeLocalMemory();
}

export default {
  getLocalMemory,
  writeLocalMemory,
  getRemoteMemory,
  registerPortal
};
