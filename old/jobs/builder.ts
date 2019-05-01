
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
    const site = room.room.find(FIND_CONSTRUCTION_SITES)[0];
    if (creep.build(site) === ERR_NOT_IN_RANGE) {
      creep.moveTo(site);
    }
  }
}



// WEBPACK FOOTER //
// ./~/source-map-loader!./src/jobs/builder.ts