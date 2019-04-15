<template>
  <div />
</template>

<script>
export default {
  created() {
    this.$auth.loginWith('githubProxy')
  }
}
</script>
