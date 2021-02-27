<template>
  <div>
    <div>
      <p>user_id: {{ user_id }}</p>
      <p>anonymous_token: {{ anonymous_token }}</p>
    </div>

    <ui-grid>
      <ui-grid-cell columns="8">
        <Discussion :watershed_id="focused_watershed_id" />
      </ui-grid-cell>
      <ui-grid-cell><Watersheds v-if="user_id !== undefined" /></ui-grid-cell>
    </ui-grid>

    <ui-button raised @click="prompt_account_update = true"
      >Update account details</ui-button>

    <ui-dialog v-model="prompt_account_update" @confirm="update_account">
      <ui-dialog-title>Update your account information</ui-dialog-title>
      <ui-dialog-content>
        <ui-form>
          <ui-form-field>
            <label>Name:</label>
            <ui-textfield v-model="account_name" />
          </ui-form-field>

          <ui-form-field>
            <label>Email address:</label>
            <ui-textfield v-model="account_email" />
          </ui-form-field>
          <p>(Your email address will only be used for sending you a connection
          link.)</p>
        </ui-form>
      </ui-dialog-content>

      <ui-dialog-actions />
    </ui-dialog>
  </div>
</template>

<script>
const request = require('superagent');

const Watersheds = require('./components/Watersheds.vue').default;
const Discussion = require('./components/Discussion.vue').default;

module.exports = {
  name: 'App',
  components: {
    Watersheds,
    Discussion
  },
  data() {
    return {
      user_id: undefined,
      anonymous_token: undefined,
      focused_watershed_id: undefined,

      prompt_account_update: false,
      account_name: undefined,
      account_email: undefined
    };
  },
  methods: {
    update_account() {
      const component = this;
      request
        .post('http://localhost:3000/account/')
        .withCredentials()
        .send({
          name: component.account_name,
          email: component.account_email
        })
        .end(function (error, response) {
          if (error == null || error === undefined) {
            component.prompt_account_update = false;
          }
        });
    }
  },
  created: function () {
    const component = this;
    request
      .get('http://localhost:3000/account/anonymous/4020e36f-7246-4657-aa1b-dff24f9a0484')
      .withCredentials()
      .accept('json')
      .end(function (error, result) {
        if (error == null || error === undefined) {
          component.user_id = result.body.user_id;
          component.anonymous_token = result.body.anonymous_token;
          component.account_name = result.body.name;
          component.account_email = result.body.email;
          // This is just hardcoded for now, but eventually will open ... based
          // on a cookie, I guess (and modified by selecting a watershed from
          // the list).
          component.focused_watershed_id = "1";
        }
      });
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
