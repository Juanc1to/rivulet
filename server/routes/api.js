const express = require('express');
const { Map } = require('immutable');

const watersheds = require('../watersheds');

const router = express.Router();

/* GET home page. */
router.use(function (req, res, next) {
  // console.log('session:', req.session);
  if (!req.session.i7e.has('user_id')) {
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

  req.session.i7e = req.session.i7e.set('last_watershed', {
    api_ref,
    name: details.get('name')
  });

  if (req.accepts('html')) {
    let redirect_url = req.get('Referer');
    if (redirect_url === undefined) {
      redirect_url = '/';
    }
    res.redirect(303, redirect_url);
  } else {
    // Maybe this should actually respond with a 200 or 204 code?
    res.status(201).send(details.toJS());
  }
});

/*
 * Within the context of a user session, POSTing to a watershed's URL requests
 * a change of that user's participation in the watershed.  What sort of
 * participation change is indicated by the body of the request.
 */
router.post('/watersheds/:id', function (req, res) {
  console.log('session.i7e:', req.session.i7e.toJS(), req.sessionID);
  const user_id = req.session.i7e.get('user_id');
  const socket = res.locals.socket;
  const last_branch_id = req.session.i7e.getIn(
    ['last_watershed', 'branch_id']);
  if (req.body.action === 'leave' || req.body.action === 'different branch') {
    watersheds.leave(req.app.get('db'), user_id, req.params.id);

    if (socket !== undefined && last_branch_id !== undefined) {
      socket.to(last_branch_id).emit('member left', user_id);
      socket.leave(last_branch_id);
    }

    if (req.body.action === 'leave') {
      req.session.i7e = req.session.i7e.delete('last_watershed');
      return res.sendStatus(200);
    }
  }
  if (req.body.action === 'join' || req.body.action === 'different branch') {
    let summary = watersheds.branch_info(req.app.get('db'), user_id,
      req.params.id).set('messages_api_ref', `${req.originalUrl}/messages`);

    // TODO: distinguish between a "re-join" (maybe just call it a "return")
    // and a new join of a watershed.  We only really want to announce joining
    // when we're newly joining a watershed.
    if (socket !== undefined) {
      const next_branch_id = summary.get('branch_id');
      socket.join(next_branch_id);
      if (next_branch_id !== last_branch_id) {
        socket.to(next_branch_id).emit('member joined', user_id);
      } else {
        socket.to(next_branch_id).emit('member returned', user_id);
      }
    }

    /*summary = summary.filterNot(function (value, key) {
      return key === 'id';
    }).set('messages_api_ref', `${req.originalUrl}/messages`);*/

    req.session.i7e = req.session.i7e.set('last_watershed', {
      branch_id: summary.get('branch_id'),
      api_ref: req.originalUrl,
      name: summary.getIn(['watershed_details', 'name'])
    });

    return res.send(summary.toJS());
  }
  res.sendStatus(422);
});

/*
 * Within the context of a user session, GETing a watershed's URL requests
 * that a user join that watershed and redirects to an interface for
 * interacting with that watershed.
 */
router.get('/watersheds/:id', function (req, res) {
  console.log('session.i7e:', req.session.i7e.toJS(), req.sessionID);
  const user_id = req.session.i7e.get('user_id');
  const socket = res.locals.socket;
  const last_branch_id = req.session.i7e.getIn(
    ['last_watershed', 'branch_id']);

  let summary = watersheds.branch_info(req.app.get('db'), user_id,
    req.params.id).set('messages_api_ref', `${req.originalUrl}/messages`);

  // TODO: distinguish between a "re-join" (maybe just call it a "return")
  // and a new join of a watershed.  We only really want to announce joining
  // when we're newly joining a watershed.
  if (socket !== undefined) {
    const next_branch_id = summary.get('branch_id');
    socket.join(next_branch_id);
    if (next_branch_id !== last_branch_id) {
      socket.to(next_branch_id).emit('member joined', user_id);
    } else {
      socket.to(next_branch_id).emit('member returned', user_id);
    }
  }

  /*summary = summary.filterNot(function (value, key) {
    return key === 'id';
  }).set('messages_api_ref', `${req.originalUrl}/messages`);*/

  req.session.i7e = req.session.i7e.set('last_watershed', {
    branch_id: summary.get('branch_id'),
    api_ref: req.originalUrl,
    name: summary.getIn(['watershed_details', 'name'])
  });

  return res.redirect(303, '/client'); // Would it be "better" to return a
                                       // representation directly?
});

router.post('/watersheds/:id/messages', function (req, res) {
  const socket = res.locals.socket;
  const branch_id = req.session.i7e.getIn(['last_watershed', 'branch_id']);

  const details = {
    author_id: req.session.i7e.get('user_id'),
    watershed_id: req.params.id,
    ...req.body
  };
  const message_id = watersheds.message(req.app.get('db'), details);
  if (socket !== undefined && branch_id !== undefined) {
    socket.to(branch_id).emit('new message', details);
  }
  res.status(201).send({
    reactions_api_ref: `${req.originalUrl}/${message_id}/reactions`
  });
});

router.get('/watersheds/:id/messages', function (req, res) {
  let messages_page = watersheds.branch_info(req.app.get('db'),
    req.session.i7e.get('user_id'), req.params.id).get('messages_page');
  messages_page = messages_page.map(function (entry) {
    return entry.set('reactions_api_ref',
                     `${req.originalUrl}/${entry.get('id')}/reactions`);
  });
  res.send(messages_page.toJS());
});

router.get('/watersheds/:id/members', function (req, res) {
  const branch_members = watersheds.branch_info(req.app.get('db'),
    req.session.i7e.get('user_id'), req.params.id).get('branch_members');
  res.send(branch_members.toJS());
});

router.post('/watersheds/:id/messages/:message_id/reactions',
            function (req, res) {
  const socket = res.locals.socket;
  const branch_id = req.session.i7e.getIn(['last_watershed', 'branch_id']);
  if (req.body.add_reaction !== undefined) {
    const details = {
      user_id: req.session.i7e.get('user_id'),
      message_id: req.params.message_id,
      intent: req.body.add_reaction
    }
    const reaction_id = watersheds.reaction(req.app.get('db'), details);
    if (socket !== undefined && branch_id !== undefined) {
      socket.to(branch_id).emit('reaction added', details);
    }
  }
  if (req.body.remove_reaction !== undefined) {
    const details = {
      user_id: req.session.i7e.get('user_id'),
      message_id: req.params.message_id,
      intent: req.body.remove_reaction
    }
    const result = watersheds.remove_reaction(req.app.get('db'), details);
    if (socket !== undefined && branch_id !== undefined) {
      socket.to(branch_id).emit('reaction removed', details);
    }
  }
  res.sendStatus(201);
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
    req.session.i7e.get('user_id'), req.params.id);
  res.send(reactions_list.toJS());
});

module.exports = router;
