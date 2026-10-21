// Loaded with `node --import`: installs resolve-recorder.mjs as a loader hook.
import { register } from "node:module";

register("./resolve-recorder.mjs", import.meta.url);
