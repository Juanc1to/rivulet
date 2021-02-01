const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const { configure: configureDatabase } = require('./db');

const indexRouter = require('./routes/index');
// const usersRouter = require('./routes/users');

const app = express();

app.set('db', configureDatabase(app));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../client')));

app.use('/', indexRouter);
// app.use('/users', usersRouter);

module.exports = app;
