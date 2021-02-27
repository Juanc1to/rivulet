const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const logger = require('morgan');
const crypto = require('crypto');
const cors = require('cors');

const { configure: configureDatabase } = require('./db');
const time = require('./util/time');

const indexRouter = require('./routes/index');
const watershedsApiRouter = require('./routes/watersheds');
const accountRouter = require('./routes/auth');
// const usersRouter = require('./routes/users');

const app = express();

app.set('views', path.join(__dirname, '../client/templates'));
app.set('view engine', 'hjs');
app.use(function (req, res, next) {
  res.locals.partials = {
    head_title: 'head_title',
    body_title: 'body_title',
    identify: 'identify',
    identified: 'identified',
    watershed_summary: 'watershed_summary'
  };
  next();
});

app.set('db', configureDatabase(app));

app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const sessionSecret = (process.env.SESSION_SECRET !== undefined ?
                       process.env.SESSION_SECRET :
                       crypto.randomBytes(64).toString());
// TODO: Set up (various) db-backed session stores...
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: time.week_ms }
}));
//app.use(express.static(path.join(__dirname, '../client')));

app.use('/api', watershedsApiRouter);
app.use('/account', accountRouter);
app.use('/', indexRouter);
// app.use('/users', usersRouter);

module.exports = app;
