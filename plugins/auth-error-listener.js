export default function({ $axios, $auth, $router }) {
  $axios.onError(error => {
    console.log('error listener')
    console.log(error)
    console.log(error.response)
    const sites = JSON.parse(error.response.data.info)
    console.log(sites)
    if (error.response.status === 401) {
      if (sites.length === 1) {
        if (sites[0].create) {
          console.log('/create?reponame=' + sites[0].create)
          window.location = '/create?reponame=' + sites[0].create
        } else {
          window.location = sites[0].url
        }
      }
    }
  })
}
