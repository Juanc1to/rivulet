const express = require('express');

const users = require('../users');
const time = require('../util/time');

const router = express.Router();

router.get('/', function (req, res) {
  if (req.accepts('html')) {
    res.render('authform', req.session.i7e.toJS());
  } else {
    res.send({
      user_id: req.session.i7e.get('user_id'),
      anonymous_token: req.session.i7e.get('anonymous_token')
    });
  }
});

router.post('/', function (req, res) {
  users.update(req.app.get('db'), {
    id: req.session.i7e.get('user_id'),
    ...req.body
  });
  res.sendStatus(200);
});

/* Retrieve the user's session information, if the user has established a
 * connection to the space.
 */
router.get('/anonymous', function (req, res) {
  if (!req.session.i7e.has('user_id')) {
    res.redirect(303, '/');
  } else {
    res.send({
      user_id: req.session.i7e.get('user_id'),
      anonymous_token: req.session.i7e.get('anonymous_token'),
      last_watershed: req.session.i7e.get('last_watershed')
    });
  }
});

router.post('/anonymous', function (req, res) {
  if (req.session.i7e.has('user_id')) {
    return res.sendStatus(422);
  }
  const db = req.app.get('db');
  const { user_id, anonymous_token } = users.anonymous(db);
  req.session.i7e = req.session.i7e.set('user_id', user_id)
                                   .set('anonymous_token', anonymous_token);
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
    return res.sendStatus(400);
  }
  req.session.i7e = req.session.i7e.set('user_id', user_details.id)
                                   .set('anonymous_token', req.params.token);
  //console.log(req.session);
  if (req.accepts('html')) {
    res.redirect(303, '/client/');
  } else {
    res.send({
      user_id: req.session.i7e.get('user_id'),
      anonymous_token: req.params.token,
      name: user_details.name,
      email: user_details.email,
      last_watershed: req.session.i7e.get('last_watershed')
    });
  }
});

function forget(req, res) {
  req.session.regenerate(function (err) {
    if (err === undefined || err === null) {
      if (req.accepts('html')) {
        res.redirect(303, '/');
      } else {
        res.sendStatus(200);
      }
    }
    // Do something if there is an error?
  });
}

router.route('/forget')
  .get(forget)
  .post(forget);

module.exports = router;
