// Scene library registry.
import * as dock from "./dock.mjs";
import * as boat from "./boat.mjs";
import * as underwater from "./underwater.mjs";
import * as cutaway from "./cutaway.mjs";
import * as studio from "./studio.mjs";

export const SCENES = { dock, boat, underwater, cutaway, studio };
export { STYLES, SPECIES, PALETTES, cssVars, globalDefs } from "./palettes.mjs";
export { bassSVG, BASS_VIEWBOX, BASS_ORIGINS } from "./bass.mjs";
export { lureSVG, LURES, LURE_VIEWBOX, minnowSVG, MINNOW_VIEWBOX, anglerSVG, ANGLER_VIEWBOX, boatSVG, BOAT_VIEWBOX, bluegillSVG, BLUEGILL_VIEWBOX, nestSVG, NEST_VIEWBOX } from "./props.mjs";
