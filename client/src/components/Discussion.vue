<template>
  <div>
    <h1>Your branch discussion in {{ watershed_name }}</h1>

    <!--ui-button class="discussion_option"
      ><ui-icon size="18">switch_right</ui-icon></ui-button>
    <ui-button class="discussion_option"
      ><ui-icon size="18">transfer_within_a_station</ui-icon></ui-button-->
    <ui-button v-if="branch_members_L !== undefined
                     && branch_members_L.size > 1"
               @click="change_participation('different branch')"
               title="Move to a different branch" class="discussion_option"
      ><ui-icon size="18">swap_horiz</ui-icon></ui-button>
    <ui-button @click="change_participation('leave')"
               title="Leave this watershed" class="discussion_option"
      ><ui-icon size="18">exit_to_app</ui-icon></ui-button>

    <p>With:
      <span v-for="(member, index) in branch_members_L"
            :key="index">
        <span v-if="member.get('end_status') === null">
          <span :class="{
            anonymous: member.get('name') === null,
            self_name: member.get('user_id') === user_id
          }">{{ member.get('name') === null
                ? 'Anon' : member.get('name') }}</span>
          <span v-if="member.get('user_id') === user_id"
            class="self_pronoun"> (you)</span>
          <span v-if="index < branch_members_L.size - 1">, </span>
        </span>
      </span>
    </p>

    <div id="messages">
      <div v-for="(message, index) in messages_page" :key="message.id"
           class="message"
           :id="index === messages_page.length - 1
                ? 'last_message' : undefined">
        <!--ui-icon-button icon="plus_one" class="reaction" /-->
        <div v-if="message.proposal_type !== null" class="proposal_info"
          >Proposal: {{ message.proposal_type }}</div>
        <ui-button class="reaction" @click="react(message.id, '+1')"
          ><ui-icon size="18">plus_one</ui-icon></ui-button>
        <div class="message_info">
          <span class="author">{{
            branch_members[message.author_id] === undefined
            || branch_members[message.author_id].name === null
            ? message.author_id
            : branch_members[message.author_id].name }}</span>
          <span class="date">{{ message.submitted.replace('T', ' ') }}</span>
        </div>
        <div class="content">{{ message.content }}</div>
        <div v-if="reactions_by_message !== undefined
                   && reactions_by_message[message.id]">
          <ui-button icon="plus_one" title="@@display names here@@"
              class="reactions"
            >: {{ reactions_by_message[message.id].length }}</ui-button>
        </div>
      </div>
    </div>
    <!-- https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API -->

    <form @submit.prevent="send">
      <table style="width: 100%">
      <tr><td width="65%">
        <ui-textfield outlined input-type="textarea" v-model="new_message"
          rows="3"
          id="new_message" />
      </td>
      <td>
        <ui-button icon="send" raised @click="send">Send</ui-button>
        <ui-menu-anchor id="send_options_anchor">
          <ui-button id="send_options" raised
            @click="display_message_options = true"
            ><ui-icon size="18">more_vert</ui-icon></ui-button>

          <ui-menu v-model="display_message_options"
              @selected="handle_message_options">
            <ui-menuitem value="proposal">
              <ui-menuitem-text
                >Make a proposal with this message</ui-menuitem-text>
            </ui-menuitem>
          </ui-menu>
        </ui-menu-anchor>
        <div v-if="submitting_proposal">
          <ui-select v-model="proposal_type" :options="proposal_types"
              defaultLabel="(None selected)"
            >Type of proposal</ui-select>
        </div>
      </td></tr>
      </table>
    </form>
  </div>
</template>

<script>
const request = require('superagent');
const { fromJS } = require('immutable');

const { HOST } = require('../constants');


module.exports = {
  name: 'Discussion',
  props: {
    watershed_ref: String,
    user_id: Number,
    socket: Object
    // watershed_name: String
  },
  emits: ['changed-watershed'],
  data() {
    return {
      watershed_name: '',

      new_message: '',
      reply_target_id: undefined,
      branch_members: undefined,
      branch_members_L: undefined,
      messages_page: undefined,
      nr_messages: undefined,
      progression: undefined,
      reactions_by_message: undefined,

      display_message_options: false,

      submitting_proposal: false,
      proposal_type: undefined,
      proposal_types: [
        {
          label: 'Representative',
          value: 'representative'
        },
        {
          label: 'Summary',
          value: 'summary'
        }
      ],
      proposal_input: ''
    };
  },
  methods: {
    send(message) {
      const component = this;
      const message_details = { content: component.new_message };
      if (component.submitting_proposal
          && component.proposal_type !== undefined) {
        message_details.proposal_type = component.proposal_type;
      }

      request
        .post(`${HOST}${component.watershed_ref}/messages`)
        .withCredentials()
        .accept('json')
        .send(message_details)
        .end(function (error, response) {
          if (error === null || error === undefined) {
            // May want to "conditionally" append the new message to the
            // messages list with some different styling to indicate the
            // message is sending, like Discord does.
            component.refresh_messages();
            document.getElementById('new_message').focus();
          }
        });
    },
    refresh_messages() {
      const component = this;
      request
        .get(`${HOST}${component.watershed_ref}/messages`)
        .withCredentials()
        .accept('json')
        .end(function (error, response) {
          if (error === null || error === undefined) {
            component.messages_page = response.body;
            component.new_message = '';
            component.submitting_proposal = false;
            component.proposal_type = undefined;
            component.fetch_reactions(true);
          }
        });
    },
    fetch_reactions(after_message_refresh = true) {
      const component = this;
      request
        .get(`${HOST}${component.watershed_ref}/reactions`)
        .withCredentials()
        .accept('json')
        .end(function (error, response) {
          if (error === null || error === undefined) {
            component.reactions_by_message = response.body.reduce(
              function (accumulator, current) {
                if (accumulator[current.message_id] === undefined) {
                  accumulator[current.message_id] = [];
                }
                accumulator[current.message_id].push(current);
                return accumulator;
              }, {});
            if (after_message_refresh) {
              component.$nextTick(function () {
                document.getElementById('last_message').scrollIntoView();
              })
            }
          }
        });
    },
    fetch_members() {
      const component = this;
      request
        .get(`${HOST}${component.watershed_ref}/members`)
        .withCredentials()
        .accept('json')
        .end(function (error, response) {
          if (error === null || error === undefined) {
            component.load_branch({ branch_members: response.body });
          }
        });
    },
    react(message_id, intent) {
      const component = this;

      request
        .post(`${HOST}${component.watershed_ref}/messages/${
          message_id}/reactions`)
        .withCredentials()
        .accept('json')
        .send({ intent })
        .end(function (error, response) {
          if (error === null || error === undefined) {
            // May want to "conditionally" append the new message to the
            // messages list with some different styling to indicate the
            // message is sending, like Discord does.
            component.fetch_reactions(false);
          }
        });
    },
    load_branch(details) {
      console.log('watching:', details);
      if (details === undefined) {
        this.branch_members_L = undefined;
        this.branch_members = undefined;
        this.messages_page = undefined;
        this.nr_messages = undefined;
        this.progression = undefined;
        this.watershed_name = undefined;
        return;
      }
      const { branch_members, messages_page, nr_messages, progression,
              watershed_details } = details;
      if (branch_members !== undefined) {
        this.branch_members_L = fromJS(branch_members);
        this.branch_members = branch_members.reduce(
          function (dict, member_details) {
            dict[member_details.user_id] = member_details;
            return dict;
          }, {});
      }
      if (progression !== undefined) {
        this.progression = progression;
      }
      if (watershed_details !== undefined) {
        this.watershed_name = watershed_details.name;
      }
      if (nr_messages !== undefined) {
        this.nr_messages = nr_messages;
      }
      if (messages_page !== undefined) {
        this.messages_page = messages_page;
        this.fetch_reactions();
      }
    },
    change_participation(action) {
      const component = this;

      request
        .post(`${HOST}${component.watershed_ref}`)
        .withCredentials()
        .accept('json')
        .send({ action })
        .end(function (error, response) {
          if (error === null || error === undefined) {
            if (action === 'leave') {
              component.$emit('changed-watershed', {
                api_ref: '',
                name: '',
              });
            } else if (action === 'different branch') {
              component.load_branch(response.body);
            }
          }
        });
    },
    handle_message_options(data) {
      if (data.value === 'proposal') {
        this.submitting_proposal = !this.submitting_proposal;
      }
    }
  },
  watch: {
    watershed_ref: {
      handler(next_ref, previous_ref) {
        const component = this;
        if (next_ref === '' || next_ref === undefined) {
          component.load_branch(undefined);
        }

        request
          .post(`${HOST}${next_ref}`)
          .withCredentials()
          .send({ action: 'join' })
          .accept('json')
          .end(function (error, response) {
            if (error === null || error === undefined) {
              component.load_branch(response.body);
            }
          });

        // I think we'll also want to emit a notice about the previous watershed
        // id with an outstanding message, if there is one, so we can stash it to
        // be recalled later, to allow users to switch between watersheds easily.
      }
    },
    socket: {
      handler(next_socket, previous_socket) {
        console.log('socket handler', next_socket, previous_socket);
        const component = this;
        if (next_socket !== undefined) {
          next_socket.on('new message', function () {
            component.refresh_messages();
          })
          .on('new reaction', function () {
            component.fetch_reactions();
          })
          .on('member joined', function () {
            component.fetch_members();
          })
          .on('member returned', function () {
            component.fetch_members();
          })
          .on('member left', function () {
            component.fetch_members();
          })
          .on('member details updated', function () {
            component.fetch_members();
          });
        }
      },
      immediate: true
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}

.discussion_option {
  float: right;
  min-width: 20px;
}

span.self_pronoun {
  font-style: italic;
}

div#messages {
  height: 355px;
  overflow-y: scroll;
  background-color: #def;
  clear: both;
}

div.message {
  text-align: left;
  margin: 0.2em;
  padding: 0.3em;
  background-color: #cdf;
}

div.message_info span.author {
  font-weight: bold;
}

div.message_info span.date {
  font-size: smaller;
  margin-left: 0.5em;
  color: #666;
}

div.message div.content {
  margin-top: 0.25em;
}

#new_message {
  width: 100%;
}

#send_options_anchor {
  display: inline-block;
}

#send_options {
  min-width: 1.5em;
  margin: 0.1em;
}

div.message .reaction {
  visibility: hidden;
}

div.message:hover .reaction {
  visibility: visible;
}

.reaction {
  float: right;
  min-width: 20px;
}

.reactions {
  background-color: #ffee92;
  height: 20px;
  min-width: 20px;
  min-height: 20px;
}

div.proposal_info {
  background-color: #ffee92;
  text-align: center;
  padding: 0.2em;
  margin-bottom: 0.5em;
}

.reactions * {
  min-width: 20px;
  min-height: 20px;
}

td {
  vertical-align: top;
  text-align: left;
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
