<template>
  <div />
</template>

<script>
export default {
  layout: 'centered',
  auth: 'guest',
  mounted() {
    let subfolder = '/' + window.location.pathname.split('/')[1]
    subfolder += subfolder.length > 1 ? '/' : ''
    this.$auth.loginWith('githubProxy', {
      // TODO: This state should include a random nonce of sorts
      state:
        window.location.protocol +
        '//' +
        window.location.host +
        subfolder +
        'callback'
    })
  }
}
</script>
