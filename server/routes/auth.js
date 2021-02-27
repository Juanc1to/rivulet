const express = require('express');

const users = require('../users');
const time = require('../util/time');

const router = express.Router();

router.get('/', function (req, res) {
  if (req.accepts('html')) {
    res.render('authform', req.session);
  } else {
    res.send({
      user_id: req.session.user_id,
      anonymous_token: req.session.anonymous_token
    });
  }
});

router.post('/', function (req, res) {
  users.update(req.app.get('db'), {
    id: req.session.user_id,
    ...req.body
  });
  res.sendStatus(200);
});

/* Retrieve the user's session information, if the user has established a
 * connection to the space.
 */
/*router.get('/anonymous', function (req, res) {
  if (req.session.user_id === undefined) {
    res.redirect(303, '/');
  } else {
    res.send({
      user_id: req.session.user_id,
      anonymous_token: req.session.anonymous_token
    });
  }
});*/

router.post('/anonymous', function (req, res) {
  if (req.session.user_id !== undefined) {
    res.sendStatus(422);
  }
  const db = req.app.get('db');
  const { user_id, anonymous_token } = users.anonymous(db);
  req.session.user_id = user_id;
  req.session.anonymous_token = anonymous_token;
  if (req.accepts('html')) {
    res.redirect(303, '/');
  } else {
    res.send({ anonymous_token, user_id });
  }
});

router.get('/anonymous/:token', function (req, res) {
  const db = req.app.get('db');
  const user_details = users.from_anonymous_token(db, req.params.token);

  if (user_details === undefined) {
    res.sendStatus(400);
  }
  req.session.user_id = user_details.id;
  req.session.anonymous_token = req.params.token;
  //console.log(req.session);
  if (req.accepts('html')) {
    res.redirect(303, '/');
  } else {
    res.send({
      user_id: req.session.user_id,
      anonymous_token: req.params.token,
      name: user_details.name,
      email: user_details.email
    });
  }
});

router.get('/forget', function (req, res) {
  req.session.user_id = undefined;
  req.session.anonymous_token = undefined;

  if (req.accepts('html')) {
    res.redirect(303, '/');
  } else {
    req.sendStatus(200);
  }
});

router.post('/forget', function (req, res) {
  req.session.user_id = undefined;
  req.session.anonymous_token = undefined;

  if (req.accepts('html')) {
    res.redirect(303, '/');
  } else {
    res.sendStatus(200);
  }
});

module.exports = router;
