export default function(creep: Creep, room: Room) {
  if (creep.carry.energy === 0) {
    creep.memory.filling = true;
  }

  if (creep.memory.filling && creep.carry.energy < creep.carryCapacity) {
    const sources = room.room.find(FIND_SOURCES);
    if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
      creep.moveTo(sources[0]);
    }
  } else {
    creep.memory.filling = false;

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

    const site = dests[0];

    if (creep.transfer(site, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(site);
    }
  }
}

// WEBPACK FOOTER //
// ./~/source-map-loader!./src/jobs/efiller.ts
