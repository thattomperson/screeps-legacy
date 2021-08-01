declare global {
  interface Memory {
    history: Record<string, Stats>;
  }

  type Stats = Record<number, Stat>;

  interface Stat {
    currentValues: number[];
    previousValues: number[];
  }
}

/**
 * Saves a new stat value for long term history tracking.
 *
 * @param {string} key
 *   Identifier this information should be stored under.
 * @param {number} value
 *   Most current value to save.
 */
export function recordStat(key: string, value: number) {
  if (!Memory.history) {
    Memory.history = {};
  }

  if (!Memory.history[key]) {
    Memory.history[key] = {};
  }

  saveStatValue(Memory.history[key], 1, value);
}

/**
 * Recursively saves new data in long term history.
 *
 * @param {object} memory
 *   The object to store history data.
 * @param {number} multiplier
 *   Interval we are currently concerned with.
 * @param {number} value
 *   Value to save.
 */
export function saveStatValue(memory: Stats, multiplier: number, value: number): void {
  const increment = 10;

  if (typeof memory[multiplier] === "undefined") {
    memory[multiplier] = {
      currentValues: [],
      previousValues: []
    };
  }

  if (memory[multiplier].currentValues.length >= increment) {
    let avg = _.sum(memory[multiplier].currentValues);
    avg /= memory[multiplier].currentValues.length;

    saveStatValue(memory, multiplier * increment, avg);

    memory[multiplier].previousValues = memory[multiplier].currentValues;
    memory[multiplier].currentValues = [];
  }

  memory[multiplier].currentValues.push(value);
}

/**
 * Retrieves long term history data.
 *
 * @param {string} key
 *   Identifier of the information to retreive.
 * @param {number} interval
 *   Interval for which to retreive the data. Needs to be a power of 10.
 *
 * @return {number}
 *   Average value of the given stat during the requested interval.
 */
export function getStat(key: string, interval: number): number | null {
  // @todo Allow intervals that are not directly stored, like 300.
  if (!Memory.history || !Memory.history[key] || !Memory.history[key][interval]) {
    return null;
  }

  return _.last(Memory.history[key][interval].currentValues);
}

export default {
  recordStat,
  saveStatValue,
  getStat
};
