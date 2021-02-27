// import { createApp } from 'vue'
const { createApp } = require('vue');
const component = require('./App.vue').default;

const BalmUI = require('balm-ui');

createApp(component).use(BalmUI).mount('#app');
