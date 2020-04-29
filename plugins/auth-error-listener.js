export default function(error, name, endpoint) {
  console.log('error listener')
  console.log(error.response)
  console.log(name)
  const sites = JSON.parse(error.response.data.info)
  console.log(sites)
  if (sites.length === 1) {
    if (sites[0].create) {
      console.log('/create?reponame=' + sites[0].create)
    } else {
      window.location = sites[0].url
    }
  }
}
