# Maya's mechanical arms (public/tsh/maya/mecharm.glb)

One arm from the Doctor Octopus Maya rig (`~/Downloads/DoctorOctopus_v3.ma`, textures from `DocOckRig.rar`),
rebuilt without Maya:

    python3 -I ma.py ...                      # (library) reads Maya ASCII: nodes, setAttr values, connections — runs nothing in the file
    python3 -I extract.py DoctorOctopus_v3.ma arm.json      # mechArm_skinCluster4 -> mesh (bind pose), UVs, 26 joints, weights
    Blender -b -P build.py -- arm.json <Textures dir> mecharm.glb   # skinned arm, 1.5x thicker, textured
    npx @gltf-transform/cli resize/webp/prune  -> public/tsh/maya/mecharm.glb (150 KB)

public/tentacles.js drives it: the 19 chain joints follow the FABRIK solve (parallel-transported, no twist), the
claw (ClawBase) sits on the end and its three fingers (Claw1/7/4) open about hinges found from their own vertices.
