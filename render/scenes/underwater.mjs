// Scene: underwater. Open water column, light from above, weeds, rocks,
// bubbles. Subject swims mid-frame (above the caption zone).
import { waterLayers, isoBox, isoSky } from "./water.mjs";

export const name = "underwater";

export function build({ style, R, prefix }) {
  if (style === "isometric") {
    const box = isoBox(R, prefix, 330);
    return {
      far: box.far + isoSky(R, prefix),
      mid: box.mid,
      near: box.near,
      loops: [...box.loops],
      anchors: { subject: { x: 455, y: 900, w: 780 }, prop: { x: 680, y: 610, w: 330 }, lineTop: -500 },
    };
  }
  const L = waterLayers(style, R, prefix, -600, 1560);
  return {
    far: L.far,
    mid: L.mid,
    near: L.near,
    loops: L.loops,
    anchors: { subject: { x: 540, y: 880, w: 840 }, prop: { x: 770, y: 600, w: 360 }, lineTop: -600 },
  };
}
