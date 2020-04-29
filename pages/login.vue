<template>
  <div />
</template>

<script>
export default {
  created() {
    // console.log(this.$auth.strategies.githubProxy.options.access_token_endpoint)
    // http://localhost:7071/api/handler/?reponame=test
    this.$auth.loginWith('githubProxy')
  }
}
</script>
