const http = require('http');

function error_status_F(done, sendStatus) {
  return function callback(error, response) {
    if (error) {
      done(error);
    } else if (sendStatus === true) {
      expect(response.text).toBe(http.STATUS_CODES[response.status]);
    }
  };
}

function then_F(params) {
  let { done, next, sendStatus } = params;
  if (next === undefined) {
    next = done;
  }
  return function callback(error, response) {
    if (error) {
      done(error);
    } else {
      if (sendStatus === true) {
        expect(response.text).toBe(http.STATUS_CODES[response.status]);
      }
      next();
    }
  };
}

function simple_end_F(done, sendStatus) {
  if (done === undefined) {
    done = function () {};
  }
  return function callback(error, response) {
    if (error) {
      done(error);
    } else {
      if (sendStatus === true) {
        expect(response.text).toBe(http.STATUS_CODES[response.status]);
      }
      done();
    }
  };
}

module.exports = Object.freeze({ then_F, simple_end_F });
