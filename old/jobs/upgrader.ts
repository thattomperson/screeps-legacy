
export default function (creep, room) {
  if (creep.memory.filling && creep.carry.energy < creep.carryCapacity) {
    var sources = creep.room.find(FIND_SOURCES);
    if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
      creep.moveTo(sources[0]);
    }
  } else {
    creep.memory.filling = false;
    var site = room.room.controller;
    if (creep.upgradeController(site) == ERR_NOT_IN_RANGE) {
      creep.moveTo(site);
    }
  }

  if (creep.carry.energy === 0) {
    creep.memory.filling = true;
  }
}



// WEBPACK FOOTER //
// ./~/source-map-loader!./src/jobs/upgrader.ts