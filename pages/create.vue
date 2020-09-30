<template>
  <CreateDialog
    :personal-repo="reponame"
    :persistent="true"
    :value="true"
    @create="createRepo($event)"
  />
</template>

<script>
import Cookies from 'js-cookie'
import CreateDialog from '../components/createDialog'

export default {
  components: {
    CreateDialog
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
