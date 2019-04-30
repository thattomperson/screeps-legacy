export default function(creep, room) {
  const mem = creep.memory;
  if (!mem) {
    return;
  }
  if (!mem.setUp) {
    findSource(creep, room);
    findContainer(creep);
    if (moveToPos(creep) || constructSite(creep, room)) {
      return;
    }
    harvest(creep, room);
  }
}

function moveToPos(creep) {
  const mem = creep.memory;
  if (!mem.inPos) {
    creep.moveTo(mem.containerPos.x, mem.containerPos.y)

    if (creep.pos.x === mem.containerPos.x && creep.pos.y === mem.containerPos.y) {
      mem.inPos = true;
      return false;
    }
    return true;
  }
}

function findSource(creep, room) {
  const mem = creep.memory;
  if (!mem.sourceId) {
    const taken = new Set();
    // eslint-disable-next-line no-cond-assign
    for (let i = 0, c; c = room.jobs.harvester[i]; i++) {
      const sourceId = c.memory.sourceId;
      if (sourceId) {
        taken.add(sourceId);
      }
    }

    // eslint-disable-next-line no-cond-assign
    for (let i = 0, source; source = room.sources[i]; i++) {
      if (!taken.has(source.id)) {
        mem.sourceId = source.id;
        break;
      }
    }
  }
}

function findContainer(creep) {
  const mem = creep.memory;
  if (!mem.containerPos) {
    const source: Source = Game.getObjectById(creep.memory.sourceId);
    const area = source.room.lookAtArea(source.pos.y - 1, source.pos.x - 1, source.pos.y + 1, source.pos.x + 1, true);
    const terrain = [];
    // eslint-disable-next-line no-cond-assign
    for (let i = 0, spot; spot = area[i]; i++) {
      if (spot.type === LOOK_STRUCTURES && spot[LOOK_STRUCTURES].structureType === STRUCTURE_CONTAINER) {
        mem.containerPos = { x: spot.x, y: spot.y };
      }

      if (spot.type === LOOK_CONSTRUCTION_SITES && spot[LOOK_CONSTRUCTION_SITES] === STRUCTURE_CONTAINER) {
        mem.containerPos = { x: spot.x, y: spot.y };
      }

      if (spot.type === LOOK_TERRAIN && spot[LOOK_TERRAIN] !== 'wall') {
        terrain.push({ x: spot.x, y: spot.y });
      }
    }
    source.room.createConstructionSite(terrain[0].x, terrain[0].y, STRUCTURE_CONTAINER);

    mem.containerPos = terrain[0];
  }
}

function harvest(creep: Creep, room) {
  if (containerConstructionAtCreep(creep, room) || containerAtCreepNotFull(creep, room)) {
    creep.harvest(Game.getObjectById(creep.memory.sourceId));
  }
}

function containerConstructionAtCreep(creep: Creep, room) {
  let results = room.room.lookAt(creep.pos);
  results = results.filter((r: LookAtResult) => r.type === LOOK_CONSTRUCTION_SITES);
  return results.length > 0;
}

function containerAtCreepNotFull(creep, room) {
  let results = room.room.lookAt(creep.pos);
  results = results.filter((r: LookAtResult) => {
    if (r.type !== LOOK_STRUCTURES) {
      return false;
    }

    return r.structure.structureType === STRUCTURE_CONTAINER;
  });

  if (results.length === 0) {
    return false;
  }

  const container: StructureContainer = results[0].structure;
  return _.sum(container.store) < container.storeCapacity;
}

function constructSite(creep, room) {
  const mem = creep.memory;
  let constructionSite = null;
  if (!mem.constructionId && !mem.setUp) {
    constructionSite = room.room.lookForAt(LOOK_CONSTRUCTION_SITES, creep)[0];
    if (constructionSite)  {
      mem.constructionId = constructionSite.id;
    }
  }

  if (constructionSite || mem.constructionId) {
    if (mem.building) {
      constructionSite = constructionSite || Game.getObjectById(mem.constructionId);

      if (!constructionSite) {
        delete mem.constructionId;
        return;
      }

      creep.build(constructionSite);

      if (creep.carry.energy === 0) {
        mem.building = false;
      }
    } else {
      creep.harvest(Game.getObjectById(mem.sourceId));
      if (creep.carry.energy === creep.carryCapacity) {
        mem.building = true;
      }
    }
    return true;
  }
  return false;
}



// WEBPACK FOOTER //
// ./~/source-map-loader!./src/jobs/harvester.ts