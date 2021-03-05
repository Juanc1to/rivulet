const express = require('express');

const watersheds = require('../watersheds');

const router = express.Router();

/* GET home page. */
router.use(function (req, res, next) {
  // console.log('session:', req.session);
  if (req.session.user_id === undefined) {
    res.sendStatus(401);
  } else {
    next();
  }
});

router.get('/', function (req, res) {
  res.sendStatus(200);
});


// TODO: I'm going to want to part this out into a separate module with a
// separate router for watersheds, at which point I'll need to make sure to
// rerun the tests to make sure that how I understand router composition is
// actually how it works.
router.get('/watersheds', function (req, res) {
  let list = watersheds.browse(req.app.get('db'));
  list = list.map(function (entry) {
    return entry.filterNot(function (value, key) {
      return key === 'id';
    })
    .set('api_ref', `${req.originalUrl}/${entry.get('id')}`);
  });
  res.send(list.toJS());
});

router.post('/watersheds', function (req, res) {
  const db = req.app.get('db');
  const id = watersheds.watershed(db, req.body);
  const list = watersheds.browse(db, { id });
  if (list.size === 0) {
    return res.sendStatus(500);
  }
  let details = list.get(0);
  const api_ref = `${req.originalUrl}/${details.get('id')}`;
  details = details.filterNot(function (value, key) {
    return key === 'id';
  }).set('api_ref', api_ref);

  req.session.last_watershed = { api_ref, name: details.get('name') };

  if (req.accepts('html')) {
    let redirect_url = req.get('Referer');
    if (redirect_url === undefined) {
      redirect_url = '/';
    }
    res.redirect(303, redirect_url);
  } else {
    res.status(201).send(details.toJS());
  }
});

router.post('/watersheds/:id', function (req, res) {
  let summary = watersheds.summary(req.app.get('db'), req.session.user_id,
    req.params.id).set('messages_api_ref', `${req.originalUrl}/messages`);
  /*summary = summary.filterNot(function (value, key) {
    return key === 'id';
  }).set('messages_api_ref', `${req.originalUrl}/messages`);*/

  req.session.last_watershed = {
    api_ref: req.originalUrl,
    name: summary.getIn(['watershed_details', 'name'])
  };

  res.send(summary.toJS());
});

router.post('/watersheds/:id/messages', function (req, res) {
  const message_id = watersheds.message(req.app.get('db'), {
    author_id: req.session.user_id,
    watershed_id: req.params.id,
    ...req.body
  });
  res.status(201).send({
    reactions_api_ref: `${req.originalUrl}/${message_id}/reactions`
  });
});

router.get('/watersheds/:id/messages', function (req, res) {
  let messages_page = watersheds.summary(req.app.get('db'),
    req.session.user_id, req.params.id).get('messages_page');
  messages_page = messages_page.map(function (entry) {
    return entry.set('reactions_api_ref',
                     `${req.originalUrl}/${entry.get('id')}/reactions`);
  });
  res.send(messages_page.toJS());
});

router.post('/watersheds/:id/messages/:message_id/reactions',
            function (req, res) {
  try {
  const reaction_id = watersheds.reaction(req.app.get('db'), {
    user_id: req.session.user_id,
    message_id: req.params.message_id,
    ...req.body
  });
  res.sendStatus(201);
  } catch (exception) {
    console.log(exception);
    res.sendStatus(500);
  }
});

router.get('/watersheds/:id/messages/:message_id/reactions',
           function (req, res) {
  const reactions_list = watersheds.reactions(req.app.get('db'),
                                              req.params.message_id);
  res.send(reactions_list.toJS());
});

router.get('/watersheds/:id/reactions',
           function (req, res) {
  const reactions_list = watersheds.branch_reactions(req.app.get('db'),
    req.session.user_id, req.params.id);
  res.send(reactions_list.toJS());
});

module.exports = router;
