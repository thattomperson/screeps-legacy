'use strict';

// Resources Module handles determining what sort of mode we should be operating in.
//
// CRITICAL, LOW, NORMAL
//
// The mode is based upon a combination of factors, including:
//   Room Controller Level
//   Room Structures - Storage, Container
//   Room Sources (probably a linear relationship to other things like minimum stored energy)

// Things which are expected to vary based upon the resource mode, room level, and sources:
//   Creep behavior (e.g., no upgrading room controller at CRITICAL)
//   Number of creeps of each type
//   Body size/configuration of creeps
//   Minimum level of repair for decayable things (storage, roads, ramparts)
//   Minimum level of repair of walls

// Resource budget is complex.
// 1. Income averages to 10 energy per tick per source
// 2. A creep lasts 1500 ticks,
//    a. takes 3 ticks per body part to build (CREEP_SPAWN_TIME)
//    b. takes a variable energy cost per body part (BODYPART_COST)
// 3. Number of structures differs at controller level (CONTROLLER_STRUCTURES, no arrays)
//

// Determines the number of containers that are adjacent to sources.
// NOTE: THIS MUST MATCH CALCULATIONS IN role.harvester2.determine_destination()!!!
function count_source_containers(room) {
    const roomSources = room.find(FIND_SOURCES);

    // Go through all sources and all nearby containers, and pick one that is not
    // claimed by another harvester2 for now.
    // TODO: Prefer to pick one at a source that isn't already claimed.
    let retval = 0;

    // sourceContainerSearch:
    for (const source of roomSources) {
        let nearbyContainers =
            source.pos.findInRange(FIND_STRUCTURES, 2, { filter: (s) => s.structureType === STRUCTURE_CONTAINER });
        // console.log(room.name + ', source: ' + source.id + ', nearby containers: ' + nearbyContainers.length);
        for (const nc of nearbyContainers) {
            if (nc.pos.getRangeTo(source) >= 2.0) {
                // We can't say 1.999 above I don't think, in the findInRange, so double check.
                continue;
            }
            retval++;
        } // nearbyContainers
    } // roomSources

    return retval;
} // numSourceContainers

// Summarizes the situation in a room in a single object.
// Room can be a string room name or an actual room object.
function summarize_room_internal(room) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    if (room == null) {
        return null;
    }
    if (room.controller == null || !room.controller.my) {
        // Can null even happen?
        return null;
    }
    const controllerLevel = room.controller.level;
    const controllerProgress = room.controller.progress;
    const controllerNeeded = room.controller.progressTotal;
    const controllerDowngrade = room.controller.ticksToDowngrade;
    const controllerBlocked = room.controller.upgradeBlocked;
    const controllerSafemode = room.controller.safeMode ? room.controller.safeMode : 0;
    const controllerSafemodeAvail = room.controller.safeModeAvailable;
    const controllerSafemodeCooldown = room.controller.safeModeCooldown;
    const hasStorage = room.storage != null;
    const storageEnergy = room.storage ? room.storage.store[RESOURCE_ENERGY] : 0;
    const storageMinerals = room.storage ? _.sum(room.storage.store) - storageEnergy : 0;
    const energyAvail = room.energyAvailable;
    const energyCap = room.energyCapacityAvailable;
    const containers: StructureContainer[] = room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType == STRUCTURE_CONTAINER
    });
    const numContainers = containers == null ? 0 : containers.length;
    const containerEnergy = _.sum(containers, (c) => c.store.energy);
    const sources: Source[] = room.find(FIND_SOURCES);
    const numSources = sources == null ? 0 : sources.length;
    const sourceEnergy = _.sum(sources, (s) => s.energy);
    const links: StructureLink[] = room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_LINK && s.my
    });
    const numLinks = links == null ? 0 : links.length;
    const linkEnergy = _.sum(links, (l) => l.energy);
    const minerals = room.find(FIND_MINERALS);
    const mineral = minerals && minerals.length > 0 ? minerals[0] : null;
    const mineralType = mineral ? mineral.mineralType : "";
    const mineralAmount = mineral ? mineral.mineralAmount : 0;
    const extractors = room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_EXTRACTOR });
    const numExtractors = extractors.length;
    const creeps = _.filter(Game.creeps, (c) => c.pos.roomName == room.name && c.my);
    const numCreeps = creeps ? creeps.length : 0;
    const enemyCreeps = room.find(FIND_HOSTILE_CREEPS);
    const creepEnergy = _.sum(Game.creeps, (c) => c.pos.roomName === room.name ? c.carry.energy : 0);
    const numEnemies = enemyCreeps ? enemyCreeps.length : 0;
    const spawns: StructureSpawn[] = room.find(FIND_MY_SPAWNS);
    const numSpawns = spawns ? spawns.length : 0;
    const spawnsSpawning =  _.sum(spawns, (s) => s.spawning ? 1 : 0);
    const towers: Tower[] = room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_TOWER && s.my });
    const numTowers = towers ? towers.length : 0;
    const towerEnergy = _.sum(towers, (t) => t.energy);
    const constSites = room.find(FIND_CONSTRUCTION_SITES);
    const myConstSites = room.find(FIND_CONSTRUCTION_SITES, { filter: (cs) => cs.my });
    const numConstructionSites = constSites.length;
    const numMyConstructionSites = myConstSites.length;
    const numSourceContainers = count_source_containers(room);
    const hasTerminal = room.terminal != null;
    const terminalEnergy = room.terminal ? room.terminal.store[RESOURCE_ENERGY] : 0;
    const terminalMinerals = room.terminal ? _.sum(room.terminal.store) - terminalEnergy : 0;

    // Get info on all our structures
    // TODO: Split roads to those on swamps vs those on dirt
    const structureTypes: Set<string> = new Set(room.find(FIND_STRUCTURES).map((s) => s.structureType));
    const structureInfo = {};
    for (const s of structureTypes) {
        const ss: Structure[] = room.find(FIND_STRUCTURES, {filter: (str) => str.structureType === s});
        structureInfo[s] = {
            count: ss.length,
            maxHits: _.max(ss, 'hits').hits,
            minHits: _.min(ss, 'hits').hits,
        };
    }
    // console.log(JSON.stringify(structureInfo));

    const groundResources: Resource[] = room.find(FIND_DROPPED_RESOURCES);
    // const groundResources_short = groundResources.map(r => ({ amount: r.amount, resourceType: r.resourceType }));
    const reducedResources = _.reduce(groundResources, (acc, res) => {
        acc[res.resourceType] = _.get(acc, [res.resourceType], 0) + res.amount; return acc;
    }, {});

    // _.reduce([{resourceType: 'energy', amount: 200},{resourceType: 'energy', amount:20}], (acc, res) => { acc[res.resourceType] = _.get(acc, [res.resourceType], 0) + res.amount; return acc; }, {});

    // console.log(JSON.stringify(reducedResources));

    // Number of each kind of creeps
    // const creep_types = new Set(creeps.map(c => c.memory.role));
    const creepCounts = _.countBy(creeps, (c) => c.job);

    // Other things we can count:
    // Tower count, energy
    // Minimum health of ramparts, walls
    // Minimum health of roads
    // Number of roads?
    // Resources (energy/minerals) on the ground?

    // Other things we can't count but we _can_ track manually:
    // Energy spent on repairs
    // Energy spent on making creeps
    // Energy lost to links
    //
    // Energy in a source when it resets (wasted/lost energy)

    const retval = {
        roomName: room.name, // In case this gets taken out of context
        controllerLevel,
        controllerProgress,
        controllerNeeded,
        controllerDowngrade,
        controllerBlocked,
        controllerSafemode,
        controllerSafemodeAvail,
        controllerSafemodeCooldown,
        energyAvail,
        energyCap,
        numSources,
        sourceEnergy,
        mineralType,
        mineralAmount,
        numExtractors,
        hasStorage,
        storageEnergy,
        storageMinerals,
        hasTerminal,
        terminalEnergy,
        terminalMinerals,
        numContainers,
        containerEnergy,
        numLinks,
        linkEnergy,
        numCreeps,
        creepCounts,
        creepEnergy,
        numEnemies,
        numSpawns,
        spawnsSpawning,
        numTowers,
        towerEnergy,
        structureInfo,
        numConstructionSites,
        numMyConstructionSites,
        groundResources: reducedResources,
        numSourceContainers,
    };

    // console.log('Room ' + room.name + ': ' + JSON.stringify(retval));
    return retval;
} // summarize_room

function summarize_rooms() {
    const now = Game.time;

    // First check if we cached it
    if (global.summarizedRoomTimestamp === now) {
        return global.summarizedRooms;
    }

    const retval = {};

    for (const r in Game.rooms) {
        const summary = summarize_room_internal(Game.rooms[r]);
        retval[r] = summary;
    }

    global.summarizedRoomTimestamp = now;
    global.summarizedRooms = retval;

    // console.log('All rooms: ' + JSON.stringify(retval));
    return retval;
} // summarize_rooms

function summarize_room(room) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    if (room == null) {
        return null;
    }

    const sr = summarize_rooms();

    return sr[room.name];
}

export default {
    summarize_room,
    summarize_rooms,
};



// WEBPACK FOOTER //
// ./~/source-map-loader!./src/resources.ts