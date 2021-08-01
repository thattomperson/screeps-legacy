const maxActiveSegments = 10;
const maxSegmentLength = 100 * 1000;

export default class SegmentedMemory {
  protected _isReady: boolean;
  protected data: Record<string, any>;
  public constructor() {
    this._isReady = false;
    this.data = {};
  }

  public manage(): void {
    if (!Memory.segmented) {
      Memory.segmented = {
        // Force saving data immediately so we don't have wrongly formatted
        // old data in segment 0.
        lastFullSave: Game.time - 100,
        startSegment: 0,
        endSegment: 0
      };

      // Since this is the first time segmented memory is loaded, there is no
      // data to load.
      this._isReady = true;
    }

    this.memory = Memory.segmented;

    if (!this.isReady()) {
      this.reloadData();
      return;
    }

    if (Game.time - this.memory.lastFullSave > 100) {
      this.saveData();
    }
  }

  public reloadData(): void {
    if (!this.loadedSegments) {
      this.loadedSegments = {};
      this.totalLength = 0;
    }

    let allLoaded = true;
    const nextActiveSegments = [];
    for (let i = this.memory.startSegment; i <= this.memory.endSegment; i++) {
      if (this.loadedSegments[i]) continue;

      if (typeof RawMemory.segments[i] === "undefined") {
        allLoaded = false;
        if (nextActiveSegments.length < maxActiveSegments) nextActiveSegments.push(i);

        continue;
      }

      try {
        this.totalLength += RawMemory.segments[i].length;
        _.each(JSON.parse("{" + RawMemory.segments[i] + "}"), (value, key) => {
          this.data[key] = value;
        });
      } catch (error) {
        hivemind.log("memory").error("Failed to load segmented memory from segment " + i);
      }

      this.loadedSegments[i] = true;
    }

    RawMemory.setActiveSegments(nextActiveSegments);

    if (allLoaded) {
      this._isReady = true;
      delete this.loadedSegments;
      hivemind
        .log("memory")
        .debug(
          "Loaded",
          (this.totalLength / 1000).toPrecision(3) + "kB of data from",
          this.memory.endSegment - this.memory.startSegment + 1,
          "segments."
        );
    }
  }

  public saveData(): void {
    if (!this.savedKeys) {
      this.savedKeys = {};
      this.currentSegment = this.memory.startSegment === 0 ? 45 : 0;
      this.startSegment = this.currentSegment;
      this.totalLength = 0;
    }

    let stringified = "";
    let allSaved = true;
    _.each(this.data, (value, key) => {
      if (typeof RawMemory.segments[this.currentSegment] === "undefined") {
        // Can't save more data this tick.
        RawMemory.setActiveSegments(_.range(this.currentSegment, this.currentSegment + maxActiveSegments - 1));
        allSaved = false;
        return false;
      }

      if (this.savedKeys[key]) return;

      const part = JSON.stringify(value);
      const partLength = part.length + key.length + 4;

      if (stringified.length + partLength > maxSegmentLength) {
        RawMemory.segments[this.currentSegment] = stringified;
        this.totalLength += stringified.length;
        this.currentSegment++;
        stringified = "";

        if (typeof RawMemory.segments[this.currentSegment] === "undefined") {
          // Can't save more data this tick.
          RawMemory.setActiveSegments(_.range(this.currentSegment, this.currentSegment + maxActiveSegments - 1));
          allSaved = false;
          return false;
        }
      }

      stringified += (stringified.length > 0 ? "," : "") + '"' + key + '":' + part;
      this.savedKeys[key] = true;
    });

    if (allSaved) {
      // Save remainder of data.
      RawMemory.segments[this.currentSegment] = stringified;
      this.totalLength += stringified.length;

      // Register complete save.
      this.memory.startSegment = this.startSegment;
      this.memory.endSegment = this.currentSegment;
      this.memory.lastFullSave = Game.time;

      // Inform the user.
      hivemind
        .log("memory")
        .debug(
          "Saved",
          (this.totalLength / 1000).toPrecision(3) + "kB of data to",
          this.currentSegment - this.startSegment + 1,
          "segments."
        );

      // Clean up.
      delete this.savedKeys;
      delete this.currentSegment;
      delete this.startSegment;
      delete this.totalLength;
    }
  }

  public isReady(): boolean {
    return this._isReady;
  }

  public set(key: string, value: any): void {
    if (!this.isReady()) throw new Error("Segmented Memory is not ready yet.");

    this.data[key] = value;
  }

  public get(key: string): any {
    if (!this.isReady()) throw new Error("Segmented Memory is not ready yet.");

    return this.data[key];
  }

  public delete(key: string): void {
    if (!this.isReady()) throw new Error("Segmented Memory is not ready yet.");

    delete this.data[key];
  }

  public has(key: string): boolean {
    if (!this.isReady()) throw new Error("Segmented Memory is not ready yet.");

    return typeof this.data[key] !== "undefined";
  }

  public forceSave(): void {
    if (!this.isReady()) throw new Error("Segmented Memory is not ready yet.");

    this.memory.lastFullSave = Game.time - 100;
  }
}
