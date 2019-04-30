import RoomController from './RoomController';
import screepsplus from './screepsplus';

console.log('Booting: ' + __webpack_hash__);

Object.defineProperty(Creep.prototype, 'job', {
  get() {
    return this.memory.job;
  },
  set(job) {
    this.memory.job = job;
  }
});

global.run = function run(): void {
  console.log('hey');
};

global.creep = function creep(name: string): Creep {
  return Game.creeps[name];
};

export function loop() {
  console.log(`=== Running ${Game.time}`);

  const creepsByRoom = _.groupBy(Game.creeps, 'room.name');

  for (const roomName in Game.rooms) {

    const room = Game.rooms[roomName];

    const structures: Structure[] = room.find(FIND_MY_STRUCTURES);

    const towers: StructureTower[] = structures.filter((structure: Structure) => {
      return structure.structureType === STRUCTURE_TOWER;
    }).map((y: StructureTower) => y);
    const tower = towers[0];
    const attackTargets: Creep[] = tower.pos.findInRange(FIND_HOSTILE_CREEPS, 40);

    const repairTargets: Structure[] = tower.pos.findInRange(FIND_STRUCTURES, 40, {
      filter(structure) {
        return structure.hits < structure.hitsMax;
      }
    });

    let attacking = false;
    if (attackTargets.length) {
      attackTargets.sort((a: Creep, b: Creep) => a.hits - b.hits);

      tower.attack(attackTargets[0]);
      attacking = true;
    }

    if (repairTargets.length && !attacking) {
      repairTargets.sort((a: Structure, b: Structure) => {
        return a.hits - b.hits;
      });

      tower.repair(repairTargets[0]);
    }

    const controller = new RoomController(room, creepsByRoom[roomName] || []);
    controller.run();
  }

  for (const creepName in Memory.creeps) {
    if (!Game.creeps[creepName]) {
      console.log('Removing dead creep', creepName);
      delete Memory.creeps[creepName];
    }
  }

  screepsplus.collectStats();
  // Update our CPU as the absolute last thing we do.
  Memory.stats.cpu.used = Game.cpu.getUsed();
}

export default {
  loop
};



// WEBPACK FOOTER //
// ./~/source-map-loader!./src/main.ts