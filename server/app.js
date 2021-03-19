const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const logger = require('morgan');
const crypto = require('crypto');
const http = require('http');
const ioServer = require('socket.io');
const { fromJS, Map } = require('immutable');

const cors = require('cors');

const { normalizePort } = require('./util/express');
const { configure: configureDatabase, dbstore } = require('./db');
const time = require('./util/time');

const indexRouter = require('./routes/index');
const watershedsApiRouter = require('./routes/watersheds');
const accountRouter = require('./routes/auth');

const app = express();

// Set up the view engine:
app.set('views', path.join(__dirname, '../client/templates'));
app.engine('html', require('hjs').__express);
app.set('view engine', 'html');

// For some reason, the method for including partials on every page described
// in the hjs documentation didn't work, but the following middleware function,
// which just adds a partials mapping object to the `locals` object, does work.
// TODO: At some point I want to go back and figure out (again) why these
// things are true, and maybe make some updates to the (very small, focused)
// hjs library.
app.use(function (req, res, next) {
  res.locals.partials = {
    head_title: 'head_title',
    body_title: 'body_title',
    identify: 'identify',
    identified: 'identified',
    watershed_summary: 'watershed_summary',
    introduction: 'introduction'
  };
  next();
});

// Configure the database connection:
app.set('db', configureDatabase(app));

// We only use CORS for the hot-reloading development client.  TODO: set this
// up so that we only use it when NODE_ENV===development.
const cors_config = {
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST'],
  credentials: true
}
app.use(cors(cors_config));

// Set up the logger.  TODO: Figure out how to use this.
app.use(logger('dev'));
// Install the JSON body parser:
app.use(express.json());
// Install the form-urlencoded body parser:
app.use(express.urlencoded({ extended: false }));

// Set up our session middleware, which keeps session information in a local
// store and sets up a cookie with a key into that store:
const sessionSecret = (process.env.SESSION_SECRET !== undefined ?
                       process.env.SESSION_SECRET :
                       crypto.randomBytes(64).toString());
const session_middleware = session({
  store: dbstore(session),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: time.week_ms }
});
app.use(session_middleware);

function immutable_sessions(req, res, next) {
  if (req.session === undefined) {
    req.session = { i7e: Map() };
    return next();
  }
  if (req.session.i7e === undefined) {
    req.session.i7e = Map();
  } else {
    req.session.i7e = fromJS(req.session.i7e);
  }
  next();
}
app.use(immutable_sessions);

function load_socket_F(options) {
  options = options === undefined ? Map() : fromJS(options);

  return function load_socket(req, res, next) {
    if (req.session.i7e.has('socket_id')) {
      const namespace = options.get('namespace', '/');
      const socket = req.app.get('io').of(namespace).sockets.get(
        req.session.i7e.get('socket_id'));
      if (socket !== undefined) {
        res.locals.socket = socket;
      }
    }
    next();
  };
}
app.use(load_socket_F());

// Set up our routes:
app.use('/api', watershedsApiRouter);
app.use('/account', accountRouter);
app.use('/', indexRouter);
app.get('/client/', function (req, res) {
  res.render(path.join(__dirname, '../client/dist/index.html'));
});
// This static route serves the client files, which is a Vue single-page app
// (SPA) for sending messages and navigating watersheds:
app.use('/client', express.static(path.join(__dirname, '../client/dist/')));

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

// Set up socket.io message passing:
const io = ioServer(server, {
  cors: cors_config
});
app.set('io', io);

function io_middleware_wrap(express_middleware) {
  return function io_middleware(socket, next) {
    return express_middleware(socket.request, {}, next);
  };
}

io.use(io_middleware_wrap(session_middleware));
io.use(io_middleware_wrap(immutable_sessions));

io.on('connection', function (socket) {
  const session = socket.request.session;
  console.log('connection:', session.i7e.toJS(), socket.request.sessionID);
  if (session.i7e.hasIn(['last_watershed', 'branch_id'])) {
    socket.join(session.i7e.getIn(['last_watershed', 'branch_id']));
  }
  session.i7e = session.i7e.set('socket_id', socket.id);
  session.save();
});

module.exports = { app, server, port };
