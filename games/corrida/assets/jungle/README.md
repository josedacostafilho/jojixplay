# Jungle models

Twenty-two models for the night-jungle world, each downloaded from [Poly Pizza](https://poly.pizza) on 2026-10-10 as a GLB file. Their authors and licences are below. CC0 models need no credit; CC-BY 3.0 models are used with credit to their authors, given here, and were changed as described.

**Changes made to every file:** textures were scaled down to at most 512 pixels (256 for small plants and rocks) and re-encoded as WebP, and unused data was removed, with [glTF Transform](https://gltf-transform.dev) 4 (`optimize --compress false --texture-compress webp --texture-size N --simplify false`). Seven of the heavier shapes (the three trees, the palm, the monstera, the second vines and the stump) were also welded and simplified to between a third and two thirds of their triangles (`weld`, then `simplify --ratio R --error 0.02`); the rest are unchanged in shape. In the game each is resized, turned and re-lit, and some are enlarged (animals, stumps, toadstools, rocks under a fallen tree).

| File | Model | Author | Licence | Use |
| --- | --- | --- | --- | --- |
| tree_a.glb | [Tree](https://poly.pizza/m/qZtx0AHhcy) | Quaternius | CC0 1.0 | Giant trees |
| tree_b.glb | [Tree](https://poly.pizza/m/aVOxaHRPWe) | Quaternius | CC0 1.0 | Giant trees |
| tree_c.glb | [Tree](https://poly.pizza/m/t9KbsfYdXz) | Quaternius | CC0 1.0 | Giant trees, near and far |
| palm.glb | [Palm Tree](https://poly.pizza/m/DsrrAYmucG) | Quaternius | CC0 1.0 | Middle-height palms |
| banana.glb | [Banana Tree](https://poly.pizza/m/d0WJSiuOz6o) | Poly by Google | CC-BY 3.0 | Banana plants |
| fern.glb | [Fern](https://poly.pizza/m/jqcanvH7D6) | Quaternius | CC0 1.0 | Undergrowth; leaves on boughs |
| plant.glb | [Plant](https://poly.pizza/m/NrJN7UcglF) | Quaternius | CC0 1.0 | Undergrowth |
| plant_big.glb | [Plant Big](https://poly.pizza/m/MbhbP7JrTI) | Quaternius | CC0 1.0 | Undergrowth |
| monstera.glb | [Monstera Plant](https://poly.pizza/m/s9Nocqk1Ge) | Isa Lousberg | CC0 1.0 | Undergrowth |
| bromeliad.glb | [Bromeliad](https://poly.pizza/m/5FZIGjZBWTB) | Poly by Google | CC-BY 3.0 | Undergrowth |
| bush.glb | [Bush](https://poly.pizza/m/ooG6CkLyE8) | Quaternius | CC0 1.0 | Undergrowth; canopy overhead |
| vines_a.glb | [Vines](https://poly.pizza/m/2jffIS8PMjZ) | Poly by Google | CC-BY 3.0 | Vines over the path |
| vines_b.glb | [Vines](https://poly.pizza/m/EVS4viM9BL) | Quaternius | CC0 1.0 | Vines over the path and the river bank |
| rock_a.glb | [Rock Medium](https://poly.pizza/m/KZdEP3uUpa) | Quaternius | CC0 1.0 | Boulders to step round |
| rock_b.glb | [Rock Medium](https://poly.pizza/m/JQxF95498B) | Quaternius | CC0 1.0 | Boulders to step round |
| stump.glb | [Tree stump](https://poly.pizza/m/7etYPFVlpgm) | Poly by Google | CC-BY 3.0 | Giant stumps to step round |
| mushrooms.glb | [Mushrooms](https://poly.pizza/m/alUv2htodmq) | Jarlan Perez | CC-BY 3.0 | Glowing toadstools, small and giant |
| jaguar.glb | [Jaguar](https://poly.pizza/m/4fb-oMr2uUF) | Poly by Google | CC-BY 3.0 | Monster |
| anaconda.glb | [Anaconda](https://poly.pizza/m/1pi9DfAbsz0) | Poly by Google | CC-BY 3.0 | Monster |
| peccary.glb | [Collared peccary](https://poly.pizza/m/3eoOcw_d00X) | Poly by Google | CC-BY 3.0 | Monster |
| caiman.glb | [Black caiman](https://poly.pizza/m/5etIv4omd7Z) | Poly by Google | CC-BY 3.0 | In the river |
| piranha.glb | [Piranha](https://poly.pizza/m/c307K4BlGr2) | Poly by Google | CC-BY 3.0 | In the river |

Licences: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).

Combined size: 2.2 MB. The game finds each file by a written-out address so Vite gives it a fingerprinted name; they are requested when the game opens, never from the menu, and served from our own deployment.
