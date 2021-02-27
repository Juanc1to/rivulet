<template>
  <div>
    <h1>Your branch discussion in {{ watershed_name }}</h1>
    <div id="messages">
      <div v-for="(message, index) in messages_page" :key="message.id"
           class="message"
           :id="index === messages_page.length - 1
                ? 'last_message' : undefined">
        <div class="author">Author: {{
          branch_members[message.author_id].name === null
          ? message.author_id
          : branch_members[message.author_id].name }}</div>
        <div class="date">Date: {{ message.submitted }}</div>
        <div class="content">{{ message.content }}</div>
      </div>
    </div>

    <form @submit.prevent="send">
      <textarea v-model="new_message"/>
      <ui-button icon="send" raised @click="send">Send</ui-button>
    </form>
  </div>
</template>

<script>
const request = require('superagent');

module.exports = {
  name: 'Discussion',
  props: {
    watershed_id: String,
    watershed_name: String
  },
  data() {
    return {
      new_message: '',
      reply_target_id: undefined,
      branch_members: undefined,
      messages_page: undefined,
      nr_messages: undefined,
      progression: undefined,
    };
  },
  methods: {
    send(message) {
      const component = this;

      function refresh_messages() {
        request
          .get(`http://localhost:3000/api/watersheds/${
            component.watershed_id}/messages`)
          .withCredentials()
          .accept('json')
          .end(function (error, response) {
            if (error === null || error === undefined) {
              component.messages_page = response.body;
              component.new_message = '';
              component.$nextTick(function () {
                document.getElementById('last_message').scrollIntoView();
              })
            }
          });
      }

      request
        .post(`http://localhost:3000/api/watersheds/${
          component.watershed_id}/messages`)
        .withCredentials()
        .accept('json')
        .send({ content: component.new_message })
        .end(function (error, response) {
          if (error === null || error === undefined) {
            // May want to "conditionally" append the new message to the
            // messages list with some different styling to indicate the
            // message is sending, like Discord does.
            refresh_messages();
          }
        });
    }
  },
  watch: {
    'watershed_id': {
      handler(next_id, previous_id) {
        const component = this;
        request
          .post(`http://localhost:3000/api/watersheds/${next_id}`)
          .withCredentials()
          .accept('json')
          .end(function (error, response) {
            if (error === null || error === undefined) {
              console.log('watching:', response);
              component.branch_members = response.body.branch_members.reduce(
                function (dict, member_details) {
                  dict[member_details.user_id] = member_details;
                  return dict;
                }, {});
              component.messages_page = response.body.messages_page;
              component.nr_messages = response.body.nr_messages;
              component.progression = response.body.progression;
              component.$nextTick(function () {
                document.getElementById('last_message').scrollIntoView();
              })
            }
          });

        // I think we'll also want to emit a notice about the previous watershed
        // id with an outstanding message, if there is one, so we can stash it to
        // be recalled later, to allow users to switch between watersheds easily.
      }
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}

div#messages {
  height: 355px;
  overflow-y: scroll;
}

ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
