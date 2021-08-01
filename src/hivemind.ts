import Process from "./process/process";
import Relations from "./relations";
import RoomIntel from "./room-intel";
import SegmentedMemory from "./segmented-memory";
import SettingsManager, { Settings } from "./settings-manager";
import { getStat } from "./stats";
import Logger, { ChannelName } from "./debug";
import * as utilities from "./utils";

declare global {
  interface ProcessMemory {
    lastRun: number;
    parentId?: string;
    cpu: number;
    lastCpu: number;
  }

  interface HivemindMemory {
    process: Record<string, ProcessMemory>;
    canExpand: boolean;
    maxScoutDistance: number;
    showProcessDebug: number;
    intelMigrated: boolean;
    roomPlannerMigrated: boolean;
    remoteMinersMigrated: boolean;
  }
}

enum PROCESS_PRIORITY {
  LOW = 1,
  DEFAULT = 2,
  HIGH = 3,
  ALWAYS = 10
}

const PROCESS_PRIORITY_LOW = PROCESS_PRIORITY.LOW;
const PROCESS_PRIORITY_DEFAULT = PROCESS_PRIORITY.DEFAULT;
const PROCESS_PRIORITY_HIGH = PROCESS_PRIORITY.HIGH;
const PROCESS_PRIORITY_ALWAYS = PROCESS_PRIORITY.ALWAYS;

global.PROCESS_PRIORITY_LOW = PROCESS_PRIORITY_LOW;
global.PROCESS_PRIORITY_DEFAULT = PROCESS_PRIORITY_DEFAULT;
global.PROCESS_PRIORITY_HIGH = PROCESS_PRIORITY_HIGH;
global.PROCESS_PRIORITY_ALWAYS = PROCESS_PRIORITY_ALWAYS;

interface ProcessOptions {
  interval?: number;
  priority?: number;
  stopAt?: number;
  throttleAt?: number;
  requireSegments?: boolean;
}

/* Default options for the various process priorities. */
const priorityEffects: Record<PROCESS_PRIORITY, ProcessOptions> = {
  [PROCESS_PRIORITY_LOW]: {
    throttleAt: 9500,
    stopAt: 5000
  },
  [PROCESS_PRIORITY_DEFAULT]: {
    throttleAt: 8000,
    stopAt: 3000
  },
  [PROCESS_PRIORITY_HIGH]: {
    throttleAt: 5000,
    stopAt: 500
  },
  [PROCESS_PRIORITY_ALWAYS]: {
    throttleAt: 0,
    stopAt: 0
  }
};

export default class Hivemind {
  protected memory: HivemindMemory;
  protected relations: any;
  protected settings: SettingsManager;
  protected segmentMemory: SegmentedMemory;
  protected loggers: Record<string, Record<string, Logger>>;
  protected intel: Record<string, RoomIntel>;
  protected bucket = 0;
  protected cpuUsage = 0;
  protected parentProcessId = "";
  protected currentProcess: Process | null = null;
  protected emergencyBrakeProcessId: string | null = null;
  /**
   * Kernel that can be used to run various processes.
   * @constructor
   */
  public constructor() {
    if (!Memory.hivemind) {
      Memory.hivemind = {
        process: {},
        canExpand: false,
        maxScoutDistance: 0,
        showProcessDebug: 0,
        intelMigrated: false,
        roomPlannerMigrated: false,
        remoteMinersMigrated: false
      };
    }

    if (!Memory.rooms) {
      Memory.rooms = {};
    }

    this.memory = Memory.hivemind;
    this.relations = new Relations();
    this.settings = new SettingsManager();
    this.segmentMemory = new SegmentedMemory();
    this.loggers = {};
    this.intel = {};
  }

  public getSegmentMemory(): SegmentedMemory {
    return this.segmentMemory;
  }

  public getSettings(): SettingsManager {
    return this.settings;
  }

  public getSetting(key: keyof Settings): any {
    return this.settings.get(key);
  }

  /**
   * Check CPU stats for throttling processes this turn.
   */
  public onTickStart(): void {
    this.bucket = Game.cpu.bucket;
    this.cpuUsage = (getStat("cpu_total", 10) ?? 0) / Game.cpu.limit;
    this.parentProcessId = "root";
    this.currentProcess = null;
    this.emergencyBrakeProcessId = null;

    // Clear possibly outdated intel objects from last tick.
    this.intel = {};

    // Refresh reference to memory object.
    this.memory = Memory.hivemind;

    this.gatherCpuStats();
  }

  /**
   * Gather CPU stats for periodic reports.
   */
  public gatherCpuStats(): void {
    if (!Memory.strategy) return;
    if (!Memory.strategy.reports) return;
    if (!Memory.strategy.reports.data) return;
    if (!Memory.strategy.reports.data.cpu) Memory.strategy.reports.data.cpu = {};

    const memory = Memory.strategy.reports.data.cpu;
    memory.totalTicks = (memory.totalTicks || 0) + 1;
    memory.bucket = (memory.bucket || 0) + Game.cpu.bucket;
    memory.cpu = (memory.cpu || 0) + (getStat("cpu_total", 1) || 0);
    memory.cpuTotal = (memory.cpuTotal || 0) + Game.cpu.limit;

    if (global._wasReset) {
      memory.globalResets = (memory.globalResets || 0) + 1;
      global._wasReset = false;
    }
  }
  /**
   * Runs a given process.
   *
   * @param {string} id
   *   The id of the process in memory.
   * @param {function} ProcessConstructor
   *   Constructor function of the process to be run.
   * @param {object} options
   *   Options on how to run this process. These will also be passed to the
   *   process itself.
   *   The following keys are always available:
   *   - interval: Set the minimum amount of ticks that should pass between runs
   *     of this process. Use 0 for processes that run multiple times in a single
   *     tick. (Default: 1)
   *   - priotiry: Use one of the PROCESS_PRIORITY_* constants to determine how
   *     this process should be throttled when cpu resources run low.
   *     (Default: PROCESS_PRIORITY_DEFAULT)
   *   - throttleAt: Override at what amount of free bucket this process should
   *     start to run less often.
   *   - stopAt: Override at what amount of free bucket this process should no
   *     no longer run.
   *   - requireSegments: If true, the process may only run after segment memory
   *     has been fully loaded.
   */
  public runProcess(id: string, ProcessConstructor: typeof Process, options: ProcessOptions): void {
    if (this.pullEmergengyBrake(id)) return;
    if (options && options.requireSegments && !this.segmentMemory.isReady()) return;

    // @todo Add CPU usage histogram data for some processes.
    const stats = this.initializeProcessStats(id);

    // @todo Think about reusing process objects between ticks.
    const process = new ProcessConstructor(options, stats);

    if (this.isProcessAllowedToRun(stats, options) && process.shouldRun()) {
      const previousProcess = this.currentProcess;
      this.currentProcess = process;
      this.timeProcess(id, stats, () => process.run());
      this.currentProcess = previousProcess;
    }
  }

  /**
   * Runs and times a function as part of the currently running process.
   *
   * @param {string} id
   *   The id of the process in memory.
   * @param {Function} callback
   *   Function to run as the sub process. Will be called with the current
   *   process as this-argument.
   */
  public runSubProcess(id: string, callback: (this: Process) => void): void {
    if (this.pullEmergengyBrake(id)) return;
    if (!this.currentProcess) return;

    const stats = this.initializeProcessStats(id);
    this.timeProcess(id, stats, () => callback.call(this.currentProcess as Process));
  }

  /**
   * Decides whether current CPU usage is too high to run any more processes.
   *
   * @param {string} id
   *   The id of the process in memory.
   *
   * @return {boolean}
   *   True if running processes is forbidden.
   */
  public pullEmergengyBrake(id: string): boolean {
    if (Game.cpu.getUsed() > Game.cpu.tickLimit * 0.85) {
      if (!this.emergencyBrakeProcessId) {
        this.emergencyBrakeProcessId = id;
        this.log("cpu").error(
          "Shutting down all other processes before running",
          id,
          "-",
          Game.cpu.getUsed(),
          "/",
          Game.cpu.tickLimit,
          "cpu used!"
        );
      }

      return true;
    }

    return false;
  }

  /**
   * Runs a callback and records cpu usage in memory.
   *
   * @param {string} id
   *   The id of the process in memory.
   * @param {object} stats
   *   Memory object to record cpu stats in.
   * @param {Function} callback
   *   Function to run while timing.
   */
  public timeProcess(id: string, stats: ProcessMemory, callback: () => void): void {
    const prevRunTime = stats.lastRun;
    stats.lastRun = Game.time;
    const cpuBefore = Game.cpu.getUsed();
    stats.parentId = this.parentProcessId;
    this.parentProcessId = id;
    callback();
    this.parentProcessId = stats.parentId;
    const cpuUsage = Game.cpu.getUsed() - cpuBefore;

    this.memory.process[id].cpu = (this.memory.process[id].cpu || cpuUsage) * 0.99 + cpuUsage * 0.01;
    if (prevRunTime === Game.time) {
      this.memory.process[id].lastCpu += cpuUsage;
    } else {
      this.memory.process[id].lastCpu = cpuUsage;
    }
  }

  /**
   * Makes sure some process stats are taken care of in persistent memory.
   *
   * @param {string} id
   *   The id of the process in memory.
   *
   * @return {object}
   *   Memory object allocated for this process' stats.
   */
  public initializeProcessStats(id: string): ProcessMemory {
    if (!this.memory.process[id]) {
      this.memory.process[id] = {
        lastRun: 0,
        cpu: 0,
        lastCpu: 0
      };
    }

    return this.memory.process[id];
  }

  /**
   * Decides whether a process is allowed to run based on current CPU usage.
   *
   * @param {object} stats
   *   Memory object allocated for this process' stats.
   * @param {object} options
   *   Options on how to run this process.
   *   @see public runProcess()
   *
   * @return {boolean}
   *   Returns true if the process may run this tick.
   */
  public isProcessAllowedToRun(stats: ProcessMemory, options: ProcessOptions): boolean {
    // Initialize process timing parameters.
    const interval: number = options.interval || 1;
    const priority: PROCESS_PRIORITY = options.priority || PROCESS_PRIORITY_DEFAULT;
    const stopAt: number = options.stopAt || priorityEffects[priority].stopAt || 0;
    const throttleAt: number = options.throttleAt || priorityEffects[priority].throttleAt || 0;

    // Don't run process if bucket is too low.
    if (this.bucket <= stopAt) return false;

    // No need to throttle if no interval is set.
    if (interval === 0 || priority === PROCESS_PRIORITY_ALWAYS) return true;

    // Run process if interval has elapsed.
    return this.hasIntervalPassed(interval, stats.lastRun, stopAt, throttleAt);
  }

  /**
   * Checks if a given interval has passed, throttled by CPU usage.
   *
   * @param {number} interval
   *   Minimum tick interval to wait.
   * @param {number} startTime
   *   Game tick on which the interval started.
   * @param {number} stopAt
   *   Minimum amount of bucket needed for this operation to run.
   * @param {number} throttleAt
   *   Amount of bucket at which this operation should always run.
   *
   * @return {boolean}
   *   True if the interval has passed and we have sufficient cpu resources.
   */
  public hasIntervalPassed(interval: number, startTime: number, stopAt = 0, throttleAt = 5000): boolean {
    // An interval of 0 always means caching for the current tick only.
    if (interval === 0) return Game.time !== startTime;

    // We check if the interval has actually been passed before adjusting
    // based on throttling to save Game.cpu.getUsed() calls.
    if (Game.time - startTime < interval) return false;
    if (Game.time - startTime < interval * this.getThrottleMultiplier(stopAt, throttleAt)) return false;

    return true;
  }

  /**
   * Returns a multiplier for intervals based on current cpu usage.
   *
   * @param {number} stopAt
   *   Minimum amount of bucket needed for this operation to run.
   * @param {number} throttleAt
   *   Amount of bucket at which this operation should always run.
   *
   * @return {number}
   *   Multiplier of at least 1.
   */
  public getThrottleMultiplier(stopAt = 0, throttleAt = 5000): number {
    // Throttle process based on previous ticks' total cpu usage
    let throttling = Math.max(this.cpuUsage, 1);

    // Throttle process based on current cpu usage.
    const minThrottle = Game.cpu.limit / 2;
    const maxThrottle = Game.cpu.tickLimit;
    if (Game.cpu.getUsed() > minThrottle) {
      throttling /= 1 - (Game.cpu.getUsed() - minThrottle) / (maxThrottle - minThrottle);
    }

    // Throttle process based on remaining bucket.
    if (this.bucket <= stopAt) return 99999;
    if (this.bucket < throttleAt) {
      throttling *= (throttleAt - stopAt) / (this.bucket - stopAt);
    }

    return throttling;
  }

  /**
   * Creates or reuses an appropriate logger instance.
   *
   * @param {string} channel
   *   The name of the channel to get a logger for.
   * @param {string|null} roomName
   *   The name of the room to log this message for, or null if logging globally.
   *
   * @return {Logger}
   *   The requested logger instance.
   */
  public log(channel: ChannelName, category = "global") {
    if (!this.loggers[category]) this.loggers[category] = {};
    if (!this.loggers[category][channel]) this.loggers[category][channel] = new Logger(channel, category);

    return this.loggers[category][channel];
  }

  /**
   * Factory method for room intel objects.
   *
   * @param {string} roomName
   *   The room for which to get intel.
   *
   * @return {RoomIntel}
   *   The requested RoomIntel object.
   */
  public roomIntel(roomName: string): RoomIntel {
    if (!this.segmentMemory.isReady())
      throw new Error("Memory is not ready to generate room intel for room " + roomName + ".");

    if (!this.intel[roomName]) {
      this.intel[roomName] = new RoomIntel(roomName);
    }

    return this.intel[roomName];
  }

  /**
   * Migrates data from an older hivemind version to this one.
   *
   * @return {boolean}
   *   True if a migration is in progress, to prevent execution of other code.
   */
  public migrateData() {
    // Move room intel into segment memory.
    if (!this.memory.intelMigrated) {
      if (!this.segmentMemory.isReady()) return true;

      _.each(Memory.rooms, (memory, roomName) => {
        if (!memory.intel) return;

        const key = "intel:" + roomName;
        this.segmentMemory.set(key, memory.intel);
        delete memory.intel;
      });

      this.segmentMemory.forceSave();
      this.memory.intelMigrated = true;
    }

    if (!this.memory.roomPlannerMigrated) {
      if (!this.segmentMemory.isReady()) return true;

      _.each(Memory.rooms, (memory, roomName) => {
        if (!memory.roomPlanner) return;

        const key = "planner:" + roomName;
        this.segmentMemory.set(key, memory.roomPlanner);
        delete memory.roomPlanner;
      });

      this.segmentMemory.forceSave();
      this.memory.roomPlannerMigrated = true;
    }

    if (!this.memory.remoteMinersMigrated) {
      _.each(Memory.creeps, memory => {
        if (["harvester.remote", "hauler", "claimer"].indexOf(memory.role) === -1) return;
        if (!memory.source) return;

        const pos = utilities.decodePosition(memory.source as string);
        memory.operation = "mine:" + pos.roomName;
      });

      this.memory.remoteMinersMigrated = true;
    }

    return false;
  }

  /**
   * Shows a list of processes run in a tick, sorted by CPU usage.
   */
  public drawProcessDebug() {
    const processes = _.map(this.memory.process, (data, id) => {
      return {
        id,
        lastRun: data.lastRun,
        lastCpu: data.lastCpu,
        parentId: data.parentId
      };
    });
    const filtered = _.filter(processes, data => data.lastCpu > 0.5);
    const processData = _.groupBy(_.sortByOrder(filtered, ["lastRun", "lastCpu"], ["desc", "desc"]), "parentId");

    const visual = new RoomVisual();
    let lineNum = 0;

    const drawProcesses = (parentId: string, indent: number) => {
      _.each(processData[parentId], data => {
        visual.text(_.round(data.lastCpu, 2).toString(), 5, lineNum, { align: "right" });
        visual.text(`${data.id || "unknown"}`, 6 + indent, lineNum, { align: "left" });

        if (data.lastRun !== Game.time) {
          visual.text(`${Game.time - data.lastRun} ago`, 2, lineNum, { align: "right", color: "#808080" });
        }

        lineNum++;

        drawProcesses(`${data.id || "unknown"}`, indent + 1);
      });
    };

    drawProcesses("root", 0);
  }
}
