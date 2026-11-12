# Art in bertie.glb

The pictures were generated with Gemini through the image wrapper (`harness images`, batch `arcade-bertie-1`).
The originals stay on the Mac, on the image wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-bertie-1

`blender/bertie_textures.py` makes Bertie's own textures. `blender/bertie.py` packs everything into `assets/bertie.glb`.

| Derived file | Size | From generated image | What it is |
| --- | --- | --- | --- |
| `blender/tex_bertie/parts.jpg` | 1024 px, 95 KB | `20261112-210109-394992` (bertie lamp glass), `20261112-210020-825a61` (bertie key cap) | One atlas: the frosted pane with a dark bulb behind each square, plain frosted glass for the X and O lamps, the key cap, and the label plates |
| `blender/tex_bertie/marquee.jpg` | 1024 x 176 px, 32 KB | `20261112-210031-ae204a` (bertie marquee face) | The name board: the band with the lettering, contrast raised |
| `reference/bertie_target_seat.jpg` | 1024 px, 68 KB | `20261112-205926-76ce92` (bertie seat B) | The target picture the model was matched to. Not shipped |
| `reference/bertie_target_hero.jpg` | 764 x 1024 px, 79 KB | `20261112-205920-e1fe51` (bertie hero A) | The target for the marquee, lower body and trim. Not shipped |

The label plates in the atlas ("NEW GAME", "DIFFICULTY", the numbers 1 to 5, the maker's plate) are drawn by `bertie_textures.py` with DIN Condensed Bold on the room's steel, not generated, so their words are exact.

Shared with the first cabinet, copied from the look branch (`blender/tex/`, see its `assets/ART.md`, batch `arcade-look-2`) until that branch lands here. `bertie.py` reads `blender/tex/` first when it exists:

| Copy | Size | From generated image |
| --- | --- | --- |
| `blender/tex_bertie/walnut.jpg`, `walnut_orm.jpg`, `walnut_n.jpg` | 126 KB, 40 KB, 49 KB | `20261112-203448-771c38` (tex-walnut) |
| `blender/tex_bertie/steel.jpg`, `steel_orm.jpg` | 16 KB, 24 KB | `20261112-203506-96d1d3` (tex-steel) |

Other pictures in the batch, used as targets only: `20261112-205921-826d92` (hero B), `20261112-205922-750eb7` (seat A).
