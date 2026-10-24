// Murmur's Android app (a fork's mobile/) runs this same web app in a WebView
// and lends it a little through a JavaScript interface (MainActivity.java):
// its own version, and checking GitHub for a newer app. Like the desktop app's
// bridge (desktop.ts), it's simply absent everywhere else.

export type MurmurAndroid = Readonly<{
  /** The Android app's version, e.g. "1.0.130". */
  version(): string
  /** Asks GitHub for a newer app now; installs it, with Android's confirmation, or says it's up to date. */
  checkForUpdates(): void
}>

declare global {
  interface Window {
    murmurAndroid?: MurmurAndroid
  }
}

/** The Android app's bridge, or undefined anywhere else. */
export const android: MurmurAndroid | undefined = typeof window === 'undefined' ? undefined : window.murmurAndroid
