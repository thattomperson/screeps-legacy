function getNewDestId(room) {
  const structuresNeedingEnergy = room.room.find(FIND_STRUCTURES, {
    filter: i => i.my && i.energyCapacity && i.energy < i.energyCapacity && i.structureType !== STRUCTURE_CONTAINER
  });

  const dests = structuresNeedingEnergy.sort(
    (a: StructureTower | StructureSpawn, b: StructureTower | StructureSpawn) => {
      if (a instanceof StructureTower && b instanceof StructureTower) {
        return b.energyCapacity - b.energy - (a.energyCapacity - a.energy);
      }
      if (a instanceof StructureTower) {
        return 1;
      }
      if (b instanceof StructureTower) {
        return -1;
      }

      return b.energyCapacity - b.energy - (a.energyCapacity - a.energy);
    }
  );

  if (dests.length === 0 || (isTower(dests[0]) && towerAlmostFull(dests[0]))) {
    console.log("Going to the controller");

    return room.room.controller.id;
  }

  return dests[0].id;
}

function isTower(structure: Structure) {
  return structure instanceof StructureTower;
}

function towerAlmostFull(tower: StructureTower) {
  const leftToFill = tower.energyCapacity - tower.energy;
  return leftToFill < 50;
}

function getNewSourceId(room) {
  const containersWithEnergy: StructureContainer[] = room.room.find(FIND_STRUCTURES, {
    filter: i => i.structureType === STRUCTURE_CONTAINER && i.store[RESOURCE_ENERGY] > 0
  });

  const sorted = containersWithEnergy.sort((a, b) => b.store.energy - a.store.energy);

  // console.log('energy sources', sorted.map((a) => a.energy));

  return sorted[0].id;
}

export default function run(creep, room) {
  const mem = creep.memory;
  if (mem.transfer) {
    if (!mem.destId) {
      mem.destId = getNewDestId(room);
    }
    const dest: Structure | null = Game.getObjectById(mem.destId);
    if (!dest) {
      return;
    }

    let transfer = null;
    if (dest instanceof StructureController) {
      creep.upgradeController(dest);
    } else {
      transfer = creep.transfer(dest, RESOURCE_ENERGY);
    }

    if (transfer === ERR_FULL) {
      mem.destId = getNewDestId(room);
    } else if (transfer === ERR_NOT_IN_RANGE) {
      creep.moveTo(dest);
    }

    if (creep.carry.energy === 0) {
      mem.transfer = false;
      mem.sourceId = getNewSourceId(room);
    }
  } else {
    if (!mem.sourceId) {
      mem.sourceId = getNewSourceId(room);
    }
    const source: Source | null = Game.getObjectById(mem.sourceId);

    if (!source) {
      return;
    }

    if (creep.withdraw(source, RESOURCE_ENERGY) !== OK) {
      creep.moveTo(source);
    }

    if (source.energy === 0) {
      mem.sourceId = getNewSourceId(room);
    }

    if (creep.carry.energy === creep.carryCapacity) {
      mem.transfer = true;
      mem.destId = getNewDestId(room);
    }
  }
}

// WEBPACK FOOTER //
// ./~/source-map-loader!./src/jobs/filler.ts
