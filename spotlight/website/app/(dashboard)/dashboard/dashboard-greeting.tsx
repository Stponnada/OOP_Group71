'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'

/** The employee's first name, for the greetings that use it. Provided by the home page. */
export const GreetingNameContext = createContext<string | null>(null)

/** The home page greeting, chosen by the employee's local time of day. */
export default function DashboardGreeting() {
  // The server renders in its own time zone, not the employee's, so it can't know whether it's
  // dawn or dusk for them. Render an invisible placeholder on the server and during hydration
  // (it keeps the line's height so nothing jumps), then the browser's local phrase.
  const name = useContext(GreetingNameContext)
  const watch = useSyncExternalStore(subscribe, getWatch, () => null)
  return watch === null ? <span className="invisible">Spotlight</span> : PHRASES[watch](name)
}

// The phrase doesn't need to change while the page is open.
function subscribe() {
  return () => {}
}

// Six even watches of four hours, by the employee's local clock. A few call the person by name.
const PHRASES: ((name: string | null) => string)[] = [
  () => 'Starry thoughts', // 00:00–04:00
  () => 'Sunrise by the sea', // 04:00–08:00
  (name) => (name ? `Aye Aye Captain ${name}!` : 'Aye Aye Captain'), // 08:00–12:00
  () => 'All hands on deck', // 12:00–16:00
  () => 'Sunset hour', // 16:00–20:00
  (name) => (name ? `Keeping the light on, ${name}?` : 'Keeping the light on'), // 20:00–24:00
]

function getWatch() {
  return Math.floor(new Date().getHours() / 4)
}
