const { Map } = require('immutable');

const watersheds = require('../watersheds');

const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  let params = req.session.i7e;
  const watershed_list = watersheds.browse(req.app.get('db'));
  if (watershed_list.size > 0) {
    params = params.setIn(['watersheds?', 'watersheds'], watershed_list);
  }
  res.render('index', params.toJS());
});

module.exports = router;
