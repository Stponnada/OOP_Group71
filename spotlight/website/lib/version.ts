// The app's version, from website/package.json (next.config.ts bakes it in at build time).
// People see MAJOR.MINOR ("v1.0").

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'

/** "1.0.0" → "1.0", the version people see. */
export const releaseOf = (version: string) => version.split('.').slice(0, 2).join('.')

export const DISPLAY_VERSION = releaseOf(APP_VERSION)
