import jobs from './jobs/index';

export default class RoomController {

  public room: Room = null;
  public creeps: Creep[] = [];

  public spawners: StructureSpawn[] = [];
  public sources: Source[] = [];

  public jobs: {
    builder: Creep[],
    efiller: Creep[],
    filler: Creep[],
    harvester: Creep[],
    unassigned: Creep[],
    upgrader: Creep[],
  } = {
    builder: [],
    efiller: [],
    filler: [],
    harvester: [],
    unassigned: [],
    upgrader: [],
  };

  constructor(room, creeps) {
    this.room = room;
    this.creeps = creeps;
    this.spawners = [Game.spawns.Spawn1];

    creeps.forEach((creep) => {
      if (!creep.job) {
        this.jobs.unassigned.push(creep);
      } else {
        this.jobs[creep.job].push(creep);
      }
    });

    this.jobs.unassigned.forEach((creep) => {
      if (this.jobs.harvester.length < 2) {
        creep.job = 'harvester';
        this.jobs[creep.job].push(creep);
      } else if (creep.name !== 'tom') {
        creep.job = 'filler';
        this.jobs[creep.job].push(creep);
      }
    });

    this.sources = room.find(FIND_SOURCES);
  }

  public run() {
    this.populateCreeps();
    this.runCreeps();
  }

  private populateCreeps() {
    if (this.jobs.harvester.length < 2) {
      this.spawn('harvester');
    }
    if (this.jobs.filler.length < 2) {
      this.spawn('filler');
    }
    if (this.jobs.upgrader.length < 1) {
      this.spawn('upgrader');
    }
    if (this.jobs.builder.length < 1 && this.room.find(FIND_MY_CONSTRUCTION_SITES).length > 0) {
      this.spawn('builder');
    }
  }

  private runCreeps() {
    for (const job in this.jobs) {
      const creeps = this.jobs[job];
      if (creeps.spawning) {
        continue;
      }
      // tslint-disable-next-line no-cond-assign
      for (let i = 0, creep; creep = creeps[i]; i++) {
        if (jobs[job]) {
          jobs[job](creep, this);
        }
      }
    }
  }

  private getBodyFor(job) {
    switch (job) {
      case 'harvester':
        return [WORK, WORK, WORK, WORK, MOVE];
      case 'filler':
        return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
      default:
        return [WORK, MOVE, CARRY];
    }
  }

  private spawn(jobName) {

    const body = this.getBodyFor(jobName);

    if (this.spawners[0].canCreateCreep(body) !== OK) {
      return;
    }
    const creep = this.spawners[0].createCreep(body, null, { job: jobName });
    this.jobs[jobName].push(creep);
  }
}



// WEBPACK FOOTER //
// ./~/source-map-loader!./src/RoomController.ts