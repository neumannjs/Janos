<template>
  <v-app dark>
    <v-content>
      <v-container class="fill-height" fluid>
        <v-layout align-center justify-center row fill-height>
          <nuxt />
        </v-layout>
      </v-container>
    </v-content>
    <v-footer :fixed="fixed" app>
      <span>&copy; 2020</span>
    </v-footer>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      fixed: false
    }
  }
}
</script>
