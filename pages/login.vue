<template>
  <div />
</template>

<script>
export default {
  data() {
    return {
      reponame: this.$route.query.reponame
    }
  },
  layout: 'centered',
  created() {
    if (this.$route.query.reponame && this.$route.query.reponame.length > 0) {
      this.$auth.strategies.githubProxy.options.access_token_endpoint +=
        '?reponame=' + this.$route.query.reponame
    }
    this.$auth.loginWith('githubProxy', {
      // TODO: This state should include a random nonce of sorts
      state: 'http://localhost:3000/callback/'
    })
  }
}
</script>

<script>
export default {
  data() {
    return {
      reponame: this.$route.query.reponame
    }
  },
  layout: 'centered',
  auth: false
}
</script>
