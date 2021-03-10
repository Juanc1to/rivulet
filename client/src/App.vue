<template>
  <div id="content">
    <!--ui-button raised @click="prompt_account_update = true"
      class="tools">Update account details</ui-button-->
    <ui-icon-button @click="prompt_account_update = true"
      icon="account_circle" class="tools" title="Update account details"/>

    <h1>Welcome to Rivulet</h1>

    <!--ui-top-app-bar content-selector="#content">Rivulet</ui-top-app-bar-->
    <!--div>
      <p>user_id: {{ user_id }}</p>
      <p>anonymous_token: {{ anonymous_token }}</p>
    </div-->

    <ui-grid>
      <ui-grid-cell columns="8">
        <Discussion :watershed_ref="focused_watershed_ref"
                    :watershed_name="focused_watershed_name"
                    :user_id="user_id"
                    @changed-watershed="note_changed_watershed($event)" />
      </ui-grid-cell>
      <ui-grid-cell>
        <Watersheds v-if="user_id !== undefined"
                    :watershed_ref="focused_watershed_ref"
                    @changed-watershed="note_changed_watershed($event)" />
      </ui-grid-cell>
    </ui-grid>

    <ui-dialog v-model="prompt_account_update" @confirm="update_account">
      <ui-dialog-title>Update your account information</ui-dialog-title>
      <ui-dialog-content>
        <p>Your account token is: <a
            :href="'/account/anonymous/' + anonymous_token"
          >{{ anonymous_token }}</a>.  You can use that link to reconnect to
          your account.</p>
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

const { HOST } = require('./constants');

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
      focused_watershed_ref: undefined,
      focused_watershed_name: undefined,

      prompt_account_update: false,
      account_name: undefined,
      account_email: undefined
    };
  },
  methods: {
    update_account(do_update) {
      const component = this;
      if (do_update === false) {
        component.account_name = '';
        component.account_email = '';
        return;
      }

      request
        .post(`${HOST}/account/`)
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
    },
    note_changed_watershed(details) {
      this.focused_watershed_ref = details.api_ref;
      this.focused_watershed_name = details.name;
    }
  },
  created: function () {
    const component = this;
    request
      .get(`${HOST}/account/anonymous`)
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
          if (result.body.last_watershed !== undefined) {
            component.note_changed_watershed(result.body.last_watershed);
          }
          /* component.focused_watershed_ref = "/api/watersheds/1";
          component.focused_watershed_name = "@@Placeholder@@"; */
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
  /* margin-top: 60px; */
}

.tools {
  float: right;
}
</style>
