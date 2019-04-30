import { ErrorMapper } from "utils/ErrorMapper";

import profiler from "screeps-profiler";

profiler.enable();

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  profiler.wrap(() => {
    console.log(`Current game tick is ${Game.time}`);

    if (Game.time % 20 == 0) {
      // Automatically delete memory of missing creeps every 20 ticks
      for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
          delete Memory.creeps[name];
        }
      }
    }
  });
});
