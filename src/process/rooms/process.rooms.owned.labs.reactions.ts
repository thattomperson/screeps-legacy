import Process from "../process";

/**
 * Manages which reactions take place in a room's labs.
 * @constructor
 *
 * @param {object} params
 *   Options on how to run this process.
 * @param {object} data
 *   Memory object allocated for this process' stats.
 */
const ReactionsProcess = function (params, data) {
  Process.call(this, params, data);
  this.room = params.room;
};

ReactionsProcess.prototype = Object.create(Process.prototype);

/**
 * Sets appropriate reactions for each room depending on available resources.
 */
ReactionsProcess.prototype.run = function () {
  const roomData = this.room.getResourceState();
  if (!roomData) return;

  const memory = this.room.memory;
  if (this.room.isEvacuating()) {
    memory.bestReaction = null;
    return;
  }

  // Try to find possible reactions where we have a good amount of resources.
  let bestReaction = null;
  let mostResources = null;
  _.each(roomData.totalResources, (amount, resourceType) => {
    if (amount <= 0 || !REACTIONS[resourceType]) return;

    _.each(REACTIONS[resourceType], (targetType, resourceType2) => {
      const amount2 = roomData.totalResources[resourceType2] || 0;
      const resultAmount = roomData.totalResources[targetType] || 0;
      if (resultAmount > 10000) return;
      if (amount2 <= 0) return;

      // Also prioritize reactions whose product we don't have much of.
      const maxProduction = Math.min(amount, amount2) - resultAmount;

      if (!mostResources || mostResources < maxProduction) {
        mostResources = maxProduction;
        bestReaction = [resourceType, resourceType2];
      }
    });
  });

  this.room.memory.currentReaction = bestReaction;
  if (bestReaction) {
    hivemind.log("labs", this.room.name).info("now producing", REACTIONS[bestReaction[0]][bestReaction[1]]);
  }
};

export default ReactionsProcess;
