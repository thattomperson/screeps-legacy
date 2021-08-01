import defaultSettings from "./settings.default";
import localSettings from "./settings.local";

export interface Settings {
  visualizeNavMesh: boolean;
  maxRemoteMineRoomDistance: number;
  maxRemoteMinePathLength: number;
  enablePowerMining: boolean;
  powerMineRoomFilter: null;
  powerMineHealers: boolean;
  scoutProcessInterval: number;
  maxRoomPrioritizationCpuPerTick: number;
  expansionScoreCacheDuration: number;
  maxExpansionCpuPerTick: number;
  enableMinCutRamparts: boolean;
  minCutRampartDistance: number;
  minWallIntegrity: number;
}

export default class SettingsManager {
  protected values: Settings;
  /**
   * Creates a new SettingsManager instance.
   *
   * Settings values will be loaded from files an memory at this point.
   */
  public constructor() {
    // Load base settings.
    this.values = {
      ...defaultSettings,
      ...localSettings
    };
  }

  /**
   * Gets the value for a setting.
   *
   * @param {string} key
   *   The key for the setting to get.
   *
   * @return {mixed}
   *   The value for this setting.
   */
  public get<T extends keyof Settings>(key: T): Pick<Settings, T> {
    // @todo Periodically check if a setting was changed in memory.
    return this.values[key];
  }

  /**
   * Overrides the value for a setting in persistent memory.
   *
   * @param {string} key
   *   The key for the setting to set.
   * @param {string} value
   *   The value for the setting to set.
   */
  public set(key: keyof Settings, value: any) {
    if (typeof this.values[key] === "undefined") return;
    if (typeof value === "undefined") return;

    this.values[key] = value;
  }
}
