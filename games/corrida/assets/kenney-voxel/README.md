# Kenney Voxel Pack — Corrida selection

Author: Kenney Vleugels / Kenney. License: CC0; original terms in [License.txt](License.txt).

Source: https://kenney.nl/assets/voxel-pack (version 1.0, retrieved 2026-09-25).
Original archive: https://kenney.nl/media/pages/assets/voxel-pack/a3a73d0ff7-1677662501/kenney_voxel-pack.zip
Archive SHA-256: `667c05e3f6d95718aaef888c7fc06f7137ba5dede95f4574deb17d4436257958`.

These seven 128×128 PNGs are copied unchanged from the archive's `PNG/Tiles/` directory. Combined size: 23,183 bytes. No archive, unused tiles, sample scenes or vector editing sources are shipped.

| File | Use |
| --- | --- |
| trunk_side.png | Tree bark |
| wood.png | Wooden obstacles and finish posts |
| leaves.png | Tree canopies |
| grass_top.png | Ground and bank tops |
| dirt_grass.png | Bank sides |
| brick_grey.png | Pose walls, tinted yellow or green by the game |
| sand.png | Moving path |

The scene imports explicit `?no-inline` URLs so Vite emits fingerprinted files for both the application and independent studio. Requests start on game mount, never at menu import. Assets are served from our deployment, not Kenney's website. GPU textures and decoded images belong to the scene and are released on exit; HTTP caching remains browser-owned.
