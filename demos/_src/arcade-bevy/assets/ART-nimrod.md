# Art in nimrod.glb

The pictures were generated with Gemini through the image wrapper (`harness images`, batch `arcade-nimrod-1`, 7 calls, 7 images).
The originals stay on the Mac, on the image wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-nimrod-1

`blender/nimrod_textures.py` makes Nimrod's own textures. `blender/nimrod.py` packs everything into `assets/nimrod.glb`.

| Derived file | Size | From generated image | What it is |
| --- | --- | --- | --- |
| `blender/tex_nimrod/parts.jpg` | 1024 px, 125 KB | `20261112-225022-1ebf87` (nimrod tex lamp lens), `20261112-225025-bbc46c` (nimrod tex button cap) | One atlas (`blender/nimrod_atlas.py`): the lamp glass, the button cap, and the legends and plates, which are drawn |
| `blender/tex_nimrod/enamel.jpg`, `enamel_orm.jpg` | 320 px, 32 KB and 15 KB | `20261112-225003-1271d7` (nimrod tex enamel) | Grey hammered enamel for the three face panels, flattened and wrapped; roughness from its tones |
| `blender/tex_nimrod/marquee.jpg` | 1024 x 140 px, 22 KB | `20261112-225026-76919a` (nimrod marquee face) | The name board: the band with the lettering, contrast raised |
| `reference/nimrod_target_seat.jpg` | 1024 x 572 px, 86 KB | `20261112-225006-2c90d7` (nimrod seat A) | The target picture the model was matched to. Not shipped |
| `reference/nimrod_target_hero.jpg` | 765 x 1024 px, 101 KB | `20261112-225007-753d6f` (nimrod hero A) | The target for the lower body and its valve window. Not shipped |

The legends ("OPPONENT'S MOVE", "COMPUTER'S MOVE", "OPPONENT WINS", "COMPUTER WINS", the real machine's words), the instruction lines, the register headings, the desk plates and the plate on the lower body are drawn by `nimrod_textures.py` with DIN Condensed Bold, not generated, so their words are exact.

Shared with the other machines: walnut and steel from `blender/tex/` (see `assets/ART.md`, batch `arcade-look-2`).

Other picture in the batch, not used: `20261112-225008-b3a082` (seat B) drew a three-quarter view instead of the seat and changed the layout.
