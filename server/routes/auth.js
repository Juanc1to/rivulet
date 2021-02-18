const express = require('express');

const users = require('../users');
const time = require('../util/time');

const router = express.Router();

router.post('/anonymous', function (req, res) {
  if (req.session.user_id !== undefined) {
    res.sendStatus(422);
  }
  const db = req.app.get('db');
  const { user_id, anonymous_token } = users.anonymous(db);
  req.session.user_id = user_id;
  res.send({ anonymous_token, user_id });
});

router.get('/anonymous/:token', function (req, res) {
  const db = req.app.get('db');
  const user_id = users.from_anonymous_token(db, req.params.token);

  if (user_id === undefined) {
    res.sendStatus(400);
  }
  req.session.user_id = user_id;
  res.send({ anonymous_token: req.params.token, user_id });
});

router.post('/forget', function (req, res) {
  req.session.user_id = undefined;

  res.sendStatus(200);
});

module.exports = router;
