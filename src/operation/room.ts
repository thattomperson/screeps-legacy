import Operation from "./operation";

export default class RoomOperation extends Operation {
  public constructor(name: string) {
    super(name);
    this.memory.type = "room";
  }
}
