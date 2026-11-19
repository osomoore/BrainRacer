/** Debug CLI: `npx tsx src/world/gen/dump.ts [seed]` prints the ASCII map and stats. */
import { largestScc, toAscii } from './analysis';
import { cityGen } from './index';

const seed = Number(process.argv[2] ?? 1);
const t0 = performance.now();
const world = cityGen(seed);
const ms = performance.now() - t0;
console.log(toAscii(world));
console.log(
  `seed=${seed} time=${ms.toFixed(1)}ms buildings=${world.buildings.length} places=${world.places.length} ` +
  `ramps=${world.ramps.length} props=${world.props.length} laneNodes=${world.laneGraph.nodes.length} ` +
  `scc=${largestScc(world.laneGraph)}`,
);
