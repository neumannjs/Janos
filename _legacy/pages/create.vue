<template>
  <InputDialog
    :message="
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
    agree="Create"
    cancel=""
    :dialog="true"
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
      repoName: this.$route.query.reponame
    }
  },
  layout: 'centered',
  auth: 'guest',
  methods: {
    createRepo(value) {
      let azureFuncUrl = process.env.APP_AZURE_FUNCTIONS_URL
      if (process.env.APP_ENV === 'development') {
        azureFuncUrl = process.env.APP_AZURE_FUNCTIONS_URL_DEV
      }
      console.log(azureFuncUrl)
      Cookies.set(
        'accessTokenEndpoint',
        azureFuncUrl + '/api/handler/?reponame=' + value,
        { expires: 1 }
      )
      this.$router.push('login')
    }
  }
}
</script>
