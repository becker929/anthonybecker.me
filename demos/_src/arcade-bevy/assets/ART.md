# Art in this model

The textures in `arcade.glb` are made from pictures generated with Gemini through the image
wrapper (`harness images`, batch `arcade-look-2`). The originals stay on the Mac, on the image
wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-look-2

`blender/textures.py` makes the derived files in `blender/tex/` (flatten, wrap the edges, resize,
derive roughness and relief). `blender/build.py` packs them into `arcade.glb`.

| Derived file | Size | From generated image | What it is |
| --- | --- | --- | --- |
| `blender/tex/walnut.jpg` | 1024 px, 126 KB | `20261112-203448-771c38` (tex-walnut) | Walnut veneer colour |
| `blender/tex/walnut_orm.jpg` | 512 px, 40 KB | same | Roughness from its tones |
| `blender/tex/walnut_n.jpg` | 1024 px, 86 KB | same | Grain relief (normal map) from its tones |
| `blender/tex/steel.jpg` | 512 px, 16 KB | `20261112-203506-96d1d3` (tex-steel) | Brushed steel colour |
| `blender/tex/steel_orm.jpg` | 512 px, 24 KB | same | Roughness along the brushing; metal |
| `blender/tex/concrete.jpg` | 1024 px, 191 KB | `20261112-203507-922bea` (tex-concrete) | Polished concrete colour, contrast doubled |
| `blender/tex/concrete_orm.jpg` | 512 px, 41 KB | same | Roughness from its tones |
| `blender/tex/navy.jpg` | 512 px, 4 KB | `20261112-203509-870603` (tex-navy) | Navy lacquer colour |
| `blender/tex/navy_orm.jpg` | 512 px, 28 KB | same | Roughness from its tones |

Not from generated pictures, but baked from the model by `blender/build.py --bake`:

| File | Size | What it is |
| --- | --- | --- |
| `blender/bake/lm_Cabinet.jpg`, `lm_Room.jpg` | 1024 px, about 150 KB each | Lightmaps (Cycles) |
| `blender/bake/ao_Cabinet.jpg`, `ao_Room.jpg` | 1024 px, about 110 to 190 KB each | Occlusion maps (Cycles) |
| `assets/env.bin` | 526 KB | The room as a cube for reflections, built into the program |

Concept pictures from the same batch, used as targets only and not shipped:
`20261112-203450-72b142` (concept-hero), `20261112-203449-0d3c6a` (concept-controls),
`20261112-203450-bbdce1` (concept-wide).
