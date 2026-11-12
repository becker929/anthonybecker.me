# Art in prinz.glb

The pictures were generated with Gemini through the image wrapper (`harness images`, batch `arcade-prinz-1`).
The originals stay on the Mac, on the image wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-prinz-1

`blender/prinz_textures.py` makes the desk's own textures. `blender/prinz.py` packs them, with the room's shared walnut and steel from `blender/tex/`, into `assets/prinz.glb`.

| Derived file | Size | From generated image | What it is |
| --- | --- | --- | --- |
| `blender/tex_prinz/maple.jpg`, `maple_orm.jpg` | 512 px, 34 KB, 23 KB | `20261112-224937-183a62` (prinz tex maple) | The board's light squares, flattened and wrapped to tile. One repeat in 0.30 m |
| `blender/tex_prinz/enamel.jpg`, `enamel_orm.jpg` | 512 px, 23 KB, 35 KB | `20261112-224938-ff95c5` (prinz tex enamel) | The back panel's pale grey crackle enamel. One repeat in 0.40 m |
| `blender/tex_prinz/felt.jpg`, `felt_orm.jpg` | 256 px, 12 KB, 3 KB | `20261112-225012-e354df` (prinz tex baize B) | The tray's green baize |
| `blender/tex_prinz/parts.jpg` | 1024 px, 48 KB | none: drawn by `prinz_textures.py` on the room's steel | Engraved plates: WHITE TO PLAY, THINKING, MATE, REFUTED, NEXT PROBLEM, PROBLEMS SOLVED, the file letters a to h, and the name plate (ROBOT CHESS, MATE IN TWO, D. G. PRINZ, MANCHESTER 1951) |
| `reference/prinz_target_seat.jpg` | 1024 px, 95 KB | `20261112-224922-365557` (prinz seat A) | The target picture the model was matched to. Not shipped |
| `reference/prinz_target_hero.jpg` | 768 x 1024 px, 70 KB | `20261112-224918-11bf6f` (prinz hero A) | The three-quarter target. Not shipped |

The dark squares are the room's walnut (`blender/tex/walnut.jpg`, image `20261112-203448-771c38`) at twice the scale of the desk's.
Other pictures in the batch, used as targets only: `20261112-224920-9fb58e` (seat B), `20261112-224919-f1785a` (hero B).
