import Router from 'vue-router'

export function createRouter(ssrContext, createDefaultRouter, routerOptions) {
  const options = routerOptions
    ? routerOptions
    : createDefaultRouter(ssrContext).options

  return new Router({
    ...options,
    routes: fixRoutes(options.routes)
  })
}

function fixRoutes(defaultRoutes) {
  // default routes that come from `pages/`
  console.log(defaultRoutes)
  return defaultRoutes.map(route => {
    return { ...route, alias: '/*' + route.path }
  })
}
