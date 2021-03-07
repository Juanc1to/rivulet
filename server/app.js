const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const logger = require('morgan');
const crypto = require('crypto');
const cors = require('cors');

const { configure: configureDatabase, dbstore } = require('./db');
const time = require('./util/time');

const indexRouter = require('./routes/index');
const watershedsApiRouter = require('./routes/watersheds');
const accountRouter = require('./routes/auth');

const app = express();

// Set up the view engine:
app.set('views', path.join(__dirname, '../client/templates'));
app.set('view engine', 'hjs');
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
app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST'],
  credentials: true
}));

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
app.use(session({
  store: dbstore(session),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: time.week_ms }
}));

// Set up our routes:
app.use('/api', watershedsApiRouter);
app.use('/account', accountRouter);
app.use('/', indexRouter);
// This static route serves the client files, which is a Vue single-page app
// (SPA) for sending messages and navigating watersheds:
app.use('/client', express.static(path.join(__dirname, '../client/dist/')));

module.exports = app;
