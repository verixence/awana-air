// Prepares the CC0 tevy.dev "Business Jet" (v1) for the hero with gltf-transform:
// removes landing gear, airstair steps and cabin interior (never visible in flight), prunes, then
// re-encodes with meshopt (EXT_meshopt_compression) + quantization. KTX2 textures are kept as-is.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, reorder, quantize, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const DROP = /^(gear_main_[LR]|gear_nose|airstair_steps|cockpit)$/;
const DROP_MAT = /^(seat_leather|cabin_carpet|display|panel_black|cockpit_grey)$/;
fs.mkdirSync('src/models/opt', { recursive: true });
for (const lod of ['lod0', 'lod1']) {
  const doc = await io.read(`src/models/bizjet-${lod}.glb`);
  const root = doc.getRoot();
  const report = [];
  for (const n of root.listNodes()) if (DROP.test(n.getName())) { report.push(n.getName()); n.dispose(); }
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const mat = p.getMaterial(); if (mat && DROP_MAT.test(mat.getName())) { p.dispose(); } }
  await doc.transform(prune(), dedup(), weld(), reorder({ encoder: MeshoptEncoder }), quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  root.getAsset().copyright = 'CC0 1.0. "Business Jet" v1 by tevy.dev (https://tevy.dev/models/business-jet), modified (gear/interior removed, recompressed) for AWANA AIR';
  const out = `src/models/opt/bizjet-${lod}.glb`;
  await io.write(out, doc);
  console.log(lod, 'removed', report.join(','), '->', fs.statSync(out).size, 'bytes');
}
