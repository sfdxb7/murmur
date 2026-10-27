# media

## Overview

Files and widgets that agents deliver inside replies, and the files people attach. Agents refer to files on the Hermes host by path. The browser cannot read that disk, so files load through Hermes's `/api/fs` routes, reached through the Murmur proxy at `/hermes/*`.

## Interface

- `parse.ts`:
  - `splitMessage`, which splits reply text into prose and blocks (`MEDIA:/abs/path` and `::preview{file="…"}`).
  - `proseOf`, `mediaPathsOf`, `parseUserMessage`, `rememberUpload` and the type `Segment`.
- `files.ts`:
  - Paths and kinds: `fileUrl`, `mediaKind`, `isTextFile`, `extOf` and `baseName`.
  - Loading: `loadBlob`, `forgetBlob`, `useBlob`, `fileSize`, `useFileSize`, `formatSize` and `readText`.
  - Saving and sharing: `download`, `canShareFiles` and `shareFile`.
  - Types: `FileRef`, `MediaKind`, `FileError` and `TextFile`.
- `tool-media.ts`: `toolMedia(result)`, which finds the image a tool produced.
- `rich-text.tsx`: `RichText`, an assistant reply rendered as markdown with media shown in place.
- `blocks.tsx`: `MediaBlock`, `HostImage`, `RemoteImage`, `FileCard`, `TypeIcon`, `kindName` and `parseCsv`.
- `attachments.tsx`: `UserAttachments`.
- `tool-media-view.tsx`: `ToolMedia`.
- `lightbox.tsx`: `Lightbox` and `LightboxProps`, a full-screen photo viewer with zoom, pan and flick to dismiss.
- `preview-frame.tsx`: `PreviewFrame`, a sandboxed live HTML widget.
- `context.tsx`: `MediaProvider`, `useMediaContext` and the type `MediaContext`.
- `media.css`.

## Invariants

- The parsing patterns match Hermes Desktop's, so agents behave the same in both apps.
- Hermes validates paths on the server and refuses credential files. Murmur never reads the host disk directly.
- `PreviewFrame` runs in an iframe with `sandbox="allow-scripts"` and no `allow-same-origin`, so the widget has an opaque origin. It only accepts `postMessage` events from its own window that carry its per-load token. Widget prompts are cut to 500 characters, and its height is kept between 40 and 1600 px.
- `MediaProvider` is optional. Without it, files still load by path, but widgets cannot send messages back.

## Side Effects

- `files.ts` fetches `/hermes/api/fs/download` (supports Range requests) and `/hermes/api/fs/read-text` (a 512 KB preview), caches blobs, and calls `navigator.share`.
- `parse.ts` stores the original names of uploads in `localStorage` under `murmur:upload-names`, scoped per Hermes.
- `preview-frame.tsx` sends theme updates to the widget with `postMessage` and can send a hidden turn when the widget asks.
- `lightbox.tsx` adds a `keydown` listener while it is open.

## Verification

- Run: `npm test` (tests in this directory: `parse.test.ts`)
