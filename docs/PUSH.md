# Push notifications

Murmur's own notifications (`src/features/notifications`) come from the page, so they only work while it's open, and a phone freezes a page in the background within seconds. Push notifications come from Murmur's server instead: it watches Hermes and pushes to each device that turned notifications on, so a phone hears about a finished reply, an approval waiting or a routine that found something with Murmur closed, or after a restart.

It's standard Web Push, sent by the server with nothing but `node:crypto`. Each Murmur makes its own key pair, so anyone who runs Murmur gets push without an account, a relay or a secret in the image.

## How it fits together

| Part | What it does |
|---|---|
| `server/webpush.ts` | Encrypts a message for one device (RFC 8291, `aes128gcm`), signs the request with this server's VAPID key (RFC 8292) and POSTs it to the device's push service (RFC 8030). Checked byte for byte against RFC 8291's worked example (`webpush.test.ts`). |
| `server/push.ts` | Keeps devices and the key pair in `DATA_DIR/push.json` (mode 600), serves the routes below, and runs a watcher for each Hermes that has a device. |
| `public/sw.js` | The service worker. Shows a pushed note while no Murmur page is on screen; a click focuses Murmur on that chat (or opens it). It handles no fetches, so it caches nothing. |
| `src/features/notifications/notifications.ts` | Where the browser can push, turning notifications on also subscribes the device, and every start tells the server again. Turning them off unsubscribes. |
| `mobile/` (the Android app) | Gets a push endpoint from Google's push service with UnifiedPush's embedded FCM distributor, tied to the server's key, and hands it to Murmur like a browser would. See below. |

### Routes

All need a signed-in Murmur, like every other `/murmur/` route.

| Route | |
|---|---|
| `GET /murmur/push` | `{key}`: this server's public key, for `PushManager.subscribe` (or the Android app's registration). |
| `POST /murmur/push/subscribe` | `{endpoint, keys: {p256dh, auth}}`, as `PushSubscription.toJSON()` gives it. The device is told about the Hermes this request is for. A new device gets a "Notifications are on" note straight away; if its push service refuses, the answer is 502 and the device isn't kept. Endpoints must be `https`. |
| `POST /murmur/push/unsubscribe` | `{endpoint}`. |

### The watcher

One per Hermes with at least one device, and none otherwise, so a Murmur nobody turned notifications on for never opens it. It has its own socket to Hermes and only asks: it never sends `client.capabilities`, so Hermes doesn't route approvals or questions to it.

It does what the page does for chats running elsewhere (`src/state/status.ts`): on `sessions.changed`, and every few seconds while anything is busy, it reads `session.active_list`.

- A session that was busy and isn't has **finished**. The note is the agent's name and the first line of its last reply. A quick reply can start and finish between two looks, so an idle session also counts when its message count has grown, or when it's new to the list and moved since the last look. A chat that was only opened hasn't moved, so it doesn't count.
- A session that starts **waiting** needs the person: "Needs your OK".
- A **routine's run** that finishes is told with the routine's name and what it found. If it had nothing to report (Hermes's silence markers, `isQuiet`), there's no note, just as Hermes keeps it from Telegram.
- A session that isn't in any agent's chat list, like a group's, gets no note.

Its first look only remembers what's already busy, so a restart doesn't announce old news. `push.ts` keeps small copies of `firstLine`, `isQuiet`, `runTitle` and the agent-name rule, because the image ships only `server/`.

### Notes

A note is `{title, body, tag, href}`. The tag is the one the page gives the same note (`murmur:chat:<id>`, `murmur:run:<id>`), so when an open page tells first, the pushed one replaces it rather than doubling it. The push `Topic` comes from the tag too, so a phone that's off gets only the latest note about a chat.

Messages are encrypted end to end. The push service (Google's, Mozilla's, Apple's) sees only the size, the timing and the server's public key.

## Where it works

| Where | How |
|---|---|
| Chrome, Edge and Firefox on computers and Android | The service worker, after turning notifications on. Chrome on Android delivers with the browser closed. |
| Safari on iPhone and iPad | Once Murmur is added to the Home Screen (iOS 16.4+), the same way. |
| The desktop app | No change: Electron has no push service, and the app runs in the background anyway, so the page's own notifications keep working. |
| The Android app (`mobile/`) | UnifiedPush, below. |

## The Android app

A WebView has no Push API, so the app does in Java what the page does in JS. [UnifiedPush](https://unifiedpush.org)'s [embedded FCM distributor](https://unifiedpush.org/kdoc/embedded_fcm_distributor/) asks Google's push service on the phone for a Web Push endpoint tied to the server's VAPID key, the same way Chrome does for websites. Nothing else needs installing, and there's no Firebase project, no `google-services.json` and no relay. FCM only accepts these pushes when they carry VAPID, which Murmur's always do. If the person already uses a UnifiedPush app such as ntfy, the app uses that instead.

- **`MurmurPush.java`**: once Murmur has loaded, it fetches the key, asks for permission to notify (Android 13+) and registers. New endpoints are POSTed to `/murmur/push/subscribe` with the WebView's own Murmur cookie. Notes are shown with the tag as the notification's tag, so a newer note about a chat replaces the last one. Nothing is shown while the app is on screen.
- **`PushServiceImpl.java`**: UnifiedPush's callbacks. Messages arrive already decrypted by the connector library.
- **Tapping a note** opens that chat, without a reload if Murmur is already open.

Caveats: the embedded distributor relies on the same Play Services interface Chrome uses, which Google doesn't document. A phone without Play Services needs a UnifiedPush app instead. And an app force-stopped in Android's settings gets nothing until it's opened again, which is an Android rule.

## Trying it

1. Open Murmur over HTTPS or on localhost (push needs a secure context), sign in, and turn on Settings → Notifications. A "Notifications are on" note should arrive within seconds.
2. Close the tab or the app, then ask an agent something from another device. The note arrives when the reply finishes.
3. `DATA_DIR/push.json` lists the devices. Removing a device's entry, or turning notifications off on it, stops its notes.
