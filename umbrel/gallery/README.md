# umbrel/gallery

## Overview

App Store artwork for Murmur on umbrelOS and the tooling that produces raw
screenshots for it. `murmur/` is this repo's copy of the store images, laid
out the way [getumbrel/umbrel-apps-gallery](https://github.com/getumbrel/umbrel-apps-gallery)
keeps them: `icon.svg` (256x256, square; umbrelOS applies its own mask) and
`1.webp`-`8.webp` (2160x1350). The filenames must match the `gallery:` list in
[`../murmur/umbrel-app.yml`](../murmur/umbrel-app.yml). The store serves the
images from umbrel-apps-gallery, so a change here must also be made there.
`murmur/` holds only images and has no contract.

## Subdirectories & Boundaries

- tools: [./tools/README.md](./tools/README.md) - `retake.sh` pipeline that boots a throwaway Hermes with a scripted model (`model.mjs`), seeds invented demo agents, chats and a group (`seed.mjs`), and captures 1440x900 JPEG shots with Playwright (`capture.mjs`) into `murmur/`. Refuses to run against a Hermes on port 18789; needs Docker and Playwright's Chromium.
