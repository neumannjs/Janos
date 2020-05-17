<template>
  <CreateDialog
    :repo-name="reponame"
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
    createRepo: function(value) {
      if (this.$refs.form.validate()) {
        Cookies.set(
          'accessTokenEndpoint',
          'http://localhost:7071/api/handler/?reponame=' + value,
          { expires: 1 }
        )
        this.$router.push('login')
      }
    }
  }
}
</script>
