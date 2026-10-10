/* the body's attributes and shapes back in the types the original file used (normalized shorts and bytes), so the
   file is as small as it was; the new mouth pieces are tiny and stay floats */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
const [,, ORIG, IN, OUT] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const o = await io.read(ORIG), d = await io.read(IN);
const op = o.getRoot().listMeshes()[0].listPrimitives()[0], dp = d.getRoot().listMeshes()[0].listPrimitives()[0];
const conv = (src, ref) => {
  const T = ref.getArray().constructor, norm = ref.getNormalized(), a = src.getArray();
  if(a.constructor === T) return;
  const max = T === Int16Array ? 32767 : T === Uint16Array ? 65535 : T === Int8Array ? 127 : T === Uint8Array ? 255 : 1;
  const out = new T(a.length);
  for(let i = 0; i < a.length; i++) out[i] = norm ? Math.max(T === Int16Array || T === Int8Array ? -max : 0, Math.min(max, Math.round(a[i]*max))) : Math.round(a[i]);
  src.setArray(out).setNormalized(norm);
};
for(const s of dp.listSemantics()) if(op.getAttribute(s)) conv(dp.getAttribute(s), op.getAttribute(s));
dp.listTargets().forEach((t, i)=>{ const ot = op.listTargets()[i]; for(const s of t.listSemantics()) if(ot && ot.getAttribute(s)) conv(t.getAttribute(s), ot.getAttribute(s)); });
d.createExtension((await import('@gltf-transform/extensions')).KHRMeshQuantization).setRequired(true);
await io.write(OUT, d);
console.log('wrote', OUT, (fs.statSync(OUT).size/1e6).toFixed(1) + 'MB');
