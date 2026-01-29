<template>
  <v-app dark>
    <v-content>
      <v-container class="fill-height" fluid>
        <v-row class="fill-height" align="center" justify="center">
          <nuxt />
        </v-row>
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
