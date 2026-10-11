/* EXT_mesh_gpu_instancing → plain nodes (Godot's glTF importer cannot read it): node uninstance.mjs in.glb out.glb.
   Run with NODE_PATH pointing at a @gltf-transform install (finish_day.sh finds the one npx left behind). */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { uninstance } from '@gltf-transform/functions';
const [,, IN, OUT] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(IN);
await doc.transform(uninstance());
await io.write(OUT, doc);
