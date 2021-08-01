export function isStructureExtension(x: Structure): x is StructureExtension {
  return x.structureType === STRUCTURE_EXTENSION;
}
export function isStructureRampart(x: Structure): x is StructureRampart {
  return x.structureType === STRUCTURE_RAMPART;
}
export function isStructureRoad(x: Structure): x is StructureRoad {
  return x.structureType === STRUCTURE_ROAD;
}
export function isStructureSpawn(x: Structure): x is StructureSpawn {
  return x.structureType === STRUCTURE_SPAWN;
}
export function isStructureLink(x: Structure): x is StructureLink {
  return x.structureType === STRUCTURE_LINK;
}
export function isStructureWall(x: Structure): x is StructureWall {
  return x.structureType === STRUCTURE_WALL;
}
export function isStructureKeeperLair(x: Structure): x is StructureKeeperLair {
  return x.structureType === STRUCTURE_KEEPER_LAIR;
}
export function isStructureController(x: Structure): x is StructureController {
  return x.structureType === STRUCTURE_CONTROLLER;
}
export function isStructureStorage(x: Structure): x is StructureStorage {
  return x.structureType === STRUCTURE_STORAGE;
}
export function isStructureTower(x: Structure): x is StructureTower {
  return x.structureType === STRUCTURE_TOWER;
}
export function isStructureObserver(x: Structure): x is StructureObserver {
  return x.structureType === STRUCTURE_OBSERVER;
}
export function isStructurePowerBank(x: Structure): x is StructurePowerBank {
  return x.structureType === STRUCTURE_POWER_BANK;
}
export function isStructurePowerSpawn(x: Structure): x is StructurePowerSpawn {
  return x.structureType === STRUCTURE_POWER_SPAWN;
}
export function isStructureExtractor(x: Structure): x is StructureExtractor {
  return x.structureType === STRUCTURE_EXTRACTOR;
}
export function isStructureLab(x: Structure): x is StructureLab {
  return x.structureType === STRUCTURE_LAB;
}
export function isStructureTerminal(x: Structure): x is StructureTerminal {
  return x.structureType === STRUCTURE_TERMINAL;
}
export function isStructureContainer(x: Structure): x is StructureContainer {
  return x.structureType === STRUCTURE_CONTAINER;
}
export function isStructureNuker(x: Structure): x is StructureNuker {
  return x.structureType === STRUCTURE_NUKER;
}
export function isStructureFactory(x: Structure): x is StructureFactory {
  return x.structureType === STRUCTURE_FACTORY;
}
export function isStructureInvaderCore(x: Structure): x is StructureInvaderCore {
  return x.structureType === STRUCTURE_INVADER_CORE;
}
export function isStructurePortal(x: Structure): x is StructurePortal {
  return x.structureType === STRUCTURE_PORTAL;
}
