import clear from "rollup-plugin-clear";
import commonjs from "@rollup/plugin-commonjs";
import fs from "fs";
import resolve from "@rollup/plugin-node-resolve";
import screeps from "rollup-plugin-screeps";
import typescript from "rollup-plugin-typescript2";
import yaml from "yaml";

const configFile = fs.readFileSync(".screeps.yaml");
const parsedConfig = yaml.parse(configFile.toString());

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = parsedConfig.servers[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default {
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    format: "cjs",
    sourcemap: true
  },

  plugins: [
    clear({ targets: ["dist"] }),
    resolve({ rootDir: "src" }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    screeps({ config: cfg, dryRun: cfg == null })
  ]
};
