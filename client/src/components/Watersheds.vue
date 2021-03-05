<template>
  <div>
    <h1>Watersheds in this space:</h1>
    <div v-for="watershed in watersheds_list" :key="watershed.api_ref"
         @click="$emit('joined-watershed', {
           api_ref: watershed.api_ref,
           name: watershed.name,
         })"
         class="watersheds"
         :class="{ active: watershed.api_ref === watershed_ref }">
      <div class="statistics branch_size" title="Branch size"
        ><ui-icon class="icon">group_work</ui-icon>: {{ watershed.branch_size }}</div>
      <div class="statistics nr_participants" title="Number of participants"
        ><ui-icon class="icon">groups<!--contact_page--></ui-icon>: {{ watershed.nr_participants }}</div>
      <div class="name">{{ watershed.name }}</div>
      <div class="description">{{ watershed.description }}</div>
    </div>
  </div>
</template>

<script>
const request = require('superagent');

const { HOST } = require('../constants');

module.exports = {
// export default {
  name: 'Watersheds',
  props: {
    watershed_ref: String,
  },
  emits: ['joined-watershed'],
  data() {
    return {
      watersheds_list: [],
    };
  },
  created: function () {
    const component = this;
    request
      .get(`${HOST}/api/watersheds`)
      .withCredentials()
      .end(function (error, result) {
        if (error === null || error === undefined) {
          component.watersheds_list = result.body;
        }
      });
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
div.watersheds {
  text-align: left;
  border: 1px solid green;
  margin-bottom: 0.35em;
  padding: 0.5em;
}

div.watersheds .name {
  font-size: larger;
  font-weight: bold;
  margin-bottom: 0.2em;
}

div.watersheds div.statistics {
  width: 20%;
  float: right;
  clear: right;
}

div.watersheds.active {
  background-color: #bfc;
}

div.watersheds:hover {
  background-color: #bfc;
}

div.watersheds div.statistics .icon {
  vertical-align: bottom;
}

h3 {
  margin: 40px 0 0;
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
