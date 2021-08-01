"use strict";

export default class Process {
  protected data: any;
  protected id: string;

  /**
   * Processes are run and managed by the hivemind kernel.
   * @constructor
   *
   * @param {object} params
   *   Options on how to run this process.
   * @param {object} data
   *   Memory object allocated for this process' stats.
   */
  public constructor(params: any, data: any) {
    this.id = "unknown";
    this.data = data;
  }
  /**
   * Determines whether this process should run this tick.
   *
   * @return {boolean}
   *   Whether this process is allowed to run.
   */
  public shouldRun(): boolean {
    return true;
  }

  /**
   * Runs the given process.
   */
  public run(): void {
    console.error("Trying to run a process `" + this.id + "` without implemented functionality.");
  }
}
