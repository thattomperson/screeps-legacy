declare global {
  interface OperationMemory {
    type: string;
    lastActive: number;
    roomName: string;
    stats: Record<string, number>;
    shouldTerminate: boolean;
    currentTick: number;
    statTicks: number;
  }

  interface Memory {
    operations: Record<string, Partial<OperationMemory>>;
  }
}

export default abstract class Operation {
  protected name: string;
  protected memory: Partial<OperationMemory>;
  protected roomName?: string;

  public static type = "normal";

  public constructor(name: string) {
    if (!Memory.operations) Memory.operations = {};
    if (!Memory.operations[name]) Memory.operations[name] = {};

    this.name = name;
    this.memory = Memory.operations[name];
    this.memory.type = "default";
    this.memory.lastActive = Game.time;

    if (this.memory.roomName) {
      this.roomName = this.memory.roomName;
    }

    if (!this.memory.stats) this.memory.stats = {};
  }

  public getType(): string {
    return this.memory.type || "default";
  }

  public setRoom(roomName: string): void {
    this.memory.roomName = roomName;
    this.roomName = roomName;
  }

  public getRoom(): string | undefined {
    return this.roomName;
  }

  public terminate(): void {
    this.memory.shouldTerminate = true;
    this.onTerminate();
  }

  public onTerminate(): void {
    // This space intentionally left blank.
  }

  public addCpuCost(amount: number): void {
    this.recordStatChange(amount, "cpu");
  }

  public addResourceCost(amount: number, resourceType: string): void {
    this.recordStatChange(-amount, resourceType);
  }

  public addResourceGain(amount: number, resourceType: string): void {
    this.recordStatChange(amount, resourceType);
  }

  public recordStatChange(amount: number, resourceType: string): void {
    if (this.memory.currentTick !== Game.time) {
      this.memory.currentTick = Game.time;
      this.memory.statTicks = (this.memory.statTicks || 0) + 1;

      // @todo reset stats every n ticks.
    }

    if (!this.memory.stats) this.memory.stats = {};
    this.memory.stats[resourceType] = (this.memory.stats[resourceType] || 0) + amount;
  }
}
