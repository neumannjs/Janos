<template>
  <v-flex xs6 :class="`text-xs-${placement}`">
    <v-btn
      v-for="item in statusItems"
      :key="item"
      :disabled="!item.button"
      flat
      small
      :style="{color: 'white !important', textTransform: 'none'}"
      @click="item.click"
    >
      <v-icon
        v-show="item.icon"
        class="mx-2"
        small
        :style="{color: 'white !important'}"
      >{{ item.icon }}</v-icon>
      <v-progress-circular
        v-show="item.progress"
        :indeterminate="item.progress ? item.progress.indeterminate : 'false'"
        :value="item.progress ? item.progress.value : 0"
        size="16"
        class="mr-2"
        width="2"
      />
      {{ item.text }}
    </v-btn>
  </v-flex>
</template>

<script>
export default {
  name: 'FooterButtons',
  props: {
    placement: { type: String, default: 'left' },
    statusItems: {
      type: Array,
      default: function() {
        return []
      }
    }
  }
}
</script>
