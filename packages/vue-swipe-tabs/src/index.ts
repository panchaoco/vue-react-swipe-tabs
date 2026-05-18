import type { App, Plugin } from 'vue'
import SwipeTabs from './components/SwipeTabs'

const install: Exclude<Plugin['install'], undefined> = (app: App, options?: { name?: string }) => {
  const name = options?.name ?? 'SwipeTabs'
  app.component(name, SwipeTabs)
}

const plugin = { install, SwipeTabs } as { install: typeof install } & { SwipeTabs: typeof SwipeTabs }

export { SwipeTabs, install }
export default plugin
