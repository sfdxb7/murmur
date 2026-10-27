# docs

## Overview

Project documentation for Murmur, the web, desktop and umbrelOS client for
Hermes Agent. This folder holds prose guides and Hermes integration
specifications; it has no runtime code.

Guides in this folder:

- [DEVELOPMENT.md](./DEVELOPMENT.md): running Murmur locally, how it is built, and how it ships.
- [STANDALONE.md](./STANDALONE.md): running Murmur outside umbrelOS with Node 22 or Docker, with its own Hermes or an existing one.
- [DESKTOP.md](./DESKTOP.md): the Electron desktop app for macOS, Windows and Linux.
- [DESIGN.md](./DESIGN.md): design brief.
- [MOTION.md](./MOTION.md): motion principles.
- [BRAND.md](./BRAND.md): brand story and voice.

`readme/` holds images used by the repository README and has no contract.

## Subdirectories & Boundaries

- hermes: [./hermes/README.md](./hermes/README.md) - Hermes gateway integration specs (chat protocol, agents and rooms, models and onboarding, apps and messaging) and the live probe scripts in `hermes/scripts/` that produced their `[LIVE]` evidence.
