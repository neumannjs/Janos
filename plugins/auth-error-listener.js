export default function(error) {
  console.log('error listener')
  console.log(error.response.data)
  console.log(error.response.status)
}
