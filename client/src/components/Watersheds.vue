<template>
  <div>
    <h1>List of watersheds in this space</h1>
    <div v-for="watershed in watersheds_list" :key="watershed.api_ref"
         class="watersheds">
      <div class="name">{{ watershed.name }}</div>
      <div class="description">{{ watershed.description }}</div>
      <div class="branch_size">Branch size: {{ watershed.branch_size }}</div>
      <div class="nr_participants">Number of participants: 
      {{ watershed.nr_participants }}</div>
    </div>
  </div>
</template>

<script>
const request = require('superagent');

module.exports = {
// export default {
  name: 'Watersheds',
  data() {
    return {
      watersheds_list: [],
    };
  },
  created: function () {
    const component = this;
    request
      .get('http://localhost:3000/api/watersheds')
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
