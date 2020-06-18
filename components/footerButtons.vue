<template>
  <v-col cols="6" :class="`text-${placement} py-0`">
    <v-btn
      v-for="(item, index) in statusItems"
      :key="index"
      :disabled="!item.button"
      text
      small
      :style="{color: 'white !important', textTransform: 'none'}"
      @click="$store.dispatch(item.dispatch)"
    >
      <v-badge v-if="item.badge && item.icon" overlap :content="item.badge">
        <v-icon
          v-show="item.icon"
          class="mx-2"
          small
          :style="{color: 'white !important'}"
        >{{ item.icon }}</v-icon>
      </v-badge>
      <v-icon
        v-else-if="item.icon"
        class="mx-2"
        small
        :style="{color: 'white !important'}"
      >{{ item.icon }}</v-icon>
      <v-progress-circular
        v-show="item.progress"
        :indeterminate="item.progress ? item.progress.indeterminate : false"
        :value="item.progress ? item.progress.value : 0"
        size="16"
        class="mr-2"
        width="2"
      />
      {{ item.text }}
    </v-btn>
  </v-col>
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

<style lang="scss" scoped>
::v-deep .v-badge__badge {
  border-radius: 8px;
  font-size: 10px;
  height: 16px;
  min-width: 16px;
}
</style>
