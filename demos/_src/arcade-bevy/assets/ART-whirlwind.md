# Art in whirlwind.glb

The pictures were generated with Gemini through the image wrapper (`harness images`, batch `arcade-whirlwind-1`).
The originals stay on the Mac, on the image wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-whirlwind-1

`blender/whirlwind_textures.py` makes the console's own atlas. `blender/whirlwind.py` packs everything into `assets/whirlwind.glb`.

| Derived file | Size | From generated image | What it is |
| --- | --- | --- | --- |
| `blender/tex_whirlwind/parts.jpg` | 1024 px, 80 KB | `20261112-224434-6dd00d` (whirlwind lamp lens) | One atlas: the lamp jewel (greyed, so one picture serves amber, red and green lamps), the knobs' dial plate with nine ticks, the plates BOUNCE, SPEED, RELEASE, WHIRLWIND I, and the maker's plate |
| `reference/whirlwind_target_seat.jpg` | 1024 px, 81 KB | `20261112-224442-4fa3e1` (whirlwind seat B) | The target picture the model was matched to. Not shipped |
| `reference/whirlwind_target_seat_a.jpg` | 1024 px, 82 KB | `20261112-224449-a31f19` (whirlwind seat A) | Second seat target. Not shipped |
| `reference/whirlwind_target_hero.jpg` | 768 x 1024 px, 97 KB | `20261112-224445-5c54db` (whirlwind hero A) | The three-quarter target: the box hood and plain lower body came from it. Not shipped |

The dial plate and the plates are drawn by `whirlwind_textures.py` (DIN Condensed Bold on the room's steel), not generated, so their words and ticks are exact.

Shared with the room, unchanged: `blender/tex/walnut.jpg`, `walnut_orm.jpg`, `walnut_n.jpg`, `steel.jpg` (see `assets/ART.md`, batch `arcade-look-2`).
