<template>
  <div />
</template>

<script>
export default {
  layout: 'centered',
  auth: 'guest',
  mounted() {
    this.$auth.loginWith('githubProxy', {
      // TODO: This state should include a random nonce of sorts
      state: 'http://localhost:3000/callback/'
    })
  }
}
</script>
