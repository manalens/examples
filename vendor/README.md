# vendor

Built copies of the SDK packages, until they are on npm.

| File | Package | Source |
| --- | --- | --- |
| `manalens-web-0.1.0.tgz` | `@manalens/web` 0.1.0 | [manalens/manalens-js](https://github.com/manalens/manalens-js) at `c395b37` (main, 2026-11-26) |
| `manalens-node-0.1.0.tgz` | `@manalens/node` 0.1.0 | [manalens/manalens](https://github.com/manalens/manalens) `sdks/node` at `b6914a64` (main, 2026-11-26) |
| `dev.manalens.sdk-0.1.2.tgz` | `dev.manalens.sdk` 0.1.2 (Unity) | [manalens/manalens](https://github.com/manalens/manalens) `sdks/unity` at `fdf43b82` (main, 2026-11-26) |

The Godot addon is in `with-godot/addons/manalens`, copied from
`sdks/godot/addons/manalens` at `fdf43b82`.

Each npm tarball is the output of `pnpm build && pnpm pack` in the package
folder. The Unity tarball is the `sdks/unity` folder under `package/`, as
Unity Package Manager expects. The examples install them with `file:`
dependencies.

## Update

```bash
bash vendor/build-sdks.sh [web-sdk-ref] [monorepo-ref]   # default: main
```

Then:

1. Run `pnpm install` (without `--frozen-lockfile`) in each npm example, so
   that each lockfile gets the new tarball hash.
2. In `with-html`, run `pnpm check`. If the snippet changed, put the new
   `integrity` value in `index.html` and `pricing.html`. In `with-astro`, run
   `pnpm check` and put the new value in `src/config.ts`.
3. Update the commits in this file. `with-unity` needs no change while the
   Unity package version stays the same.

TODO: when the packages are on npm, change each `file:` dependency to
a version range and delete this folder.
