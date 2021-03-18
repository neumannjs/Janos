<template>
  <InputDialog
    v-model="createDialog"
    :text="
      repoName
        ? 'The repository ' +
          repoName +
          ' for your personal page is still available. Alternatively you can provide a different name for your website.'
        : ''
    "
    :input="repoName"
    :persistent="true"
    title="Create new website"
    label="Name"
    button="Create"
    :value="true"
    @submit="createRepo($event)"
  />
</template>

<script>
import Cookies from 'js-cookie'
import InputDialog from '../components/inputDialog'

export default {
  components: {
    InputDialog
  },
  data() {
    return {
      reponame: this.$route.query.reponame
    }
  },
  layout: 'centered',
  auth: 'guest',
  methods: {
    createRepo(value) {
      if (this.$refs.form.validate()) {
        Cookies.set(
          'accessTokenEndpoint',
          process.env.APP_AZURE_FUNCTIONS_URL +
            '/api/handler/?reponame=' +
            value,
          { expires: 1 }
        )
        this.$router.push('login')
      }
    }
  }
}
</script>
