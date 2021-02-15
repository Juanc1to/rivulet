const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const logger = require('morgan');
const crypto = require('crypto');

const { configure: configureDatabase } = require('./db');
const time = require('./util/time');

const indexRouter = require('./routes/index');
const watershedsApiRouter = require('./routes/watersheds');
const authRouter = require('./routes/auth');
// const usersRouter = require('./routes/users');

const app = express();

app.set('db', configureDatabase(app));

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
}));
app.use(express.static(path.join(__dirname, '../client')));

app.use('/api', watershedsApiRouter);
app.use('/auth', authRouter);
app.use('/', indexRouter);
// app.use('/users', usersRouter);

module.exports = app;
