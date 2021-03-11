const request = require('supertest');
const { app } = require('../app');

describe('Express application', function () {
  it('has a basic running configuration', function (done) {
    request(app)
      .get('/')
      .expect(200)
      .end(function (error, response) {
        if (error) {
          done(error);
        } else {
          expect(response.text).toEqual(
            expect.stringContaining('Welcome to Rivulet'));
          done();
        }
      });
  });
});
