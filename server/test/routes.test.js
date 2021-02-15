const request = require('supertest');
const app = require('../app');
const { then_F } = require('./util/supertest');

// local utilities
const util = require('./db/util');

const db = app.get('db');

// afterAll(util.drop_all_tables_factory(db));

afterEach(util.delete_from_each_table_factory(db));

describe('Accessing data-modifying routes (at /api)', function () {
  it('requires authorization by default', function (done) {
    request(app)
      .get('/api')
      .expect(401)
      .end(then_F({ done }));
  });

  it('supports anonymous identification', function (done) {
    const agent = request.agent(app);

    function reregister() {
      // If you have already set up an anonymous session, you can't do it again
      // without forgetting the old one first.
      agent
        .post('/auth/anonymous')
        .expect(422)
        .end(then_F({ done, sendStatus: true }));
    }

    function access() {
      agent
        .get('/api')
        .expect(200)
        .end(then_F({ done, next: reregister, sendStatus: true }));
    }

    function register() {
      agent
        .post('/auth/anonymous')
        .expect(200)
        .end(then_F({ done, next: access }));
    }

    agent
      .get('/auth/anonymous/foo')
      .expect(400)  // This might be better as 422...
      .end(then_F({ done, next: register, sendStatus: true }));
  });

  it('supports logging out', function (done) {
    const agent = request.agent(app);

    function access() {
      agent
        .get('/api')
        .expect(401)
        .end(then_F({ done, sendStatus: true }));
    }

    function forget() {
      agent
        .post('/auth/forget')
        .expect(200)
        .end(then_F({ done, next: access, sendStatus: true }));
    }

    agent
      .post('/auth/anonymous')
      .expect(200)
      .end(then_F({ done, next: forget }));
  });

  it('can retrieve previous anonymous identification', function (done) {
    const agent = request.agent(app);
    let anonymous_token;

    function access() {
      agent
        .get('/api')
        .expect(200)
        .end(then_F({ done }));
    }

    function identify() {
      agent
        .get(`/auth/anonymous/${anonymous_token}`)
        .expect(200)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            expect(response.body).toEqual({ anonymous_token });
            access();
          }
        });
    }

    function forget() {
      agent
        .post('/auth/forget')
        .expect(200)
        .end(then_F({ done, next: identify, sendStatus: true }));
    }

    agent
      .post('/auth/anonymous')
      .expect(200)
      .end(function (error, response) {
        if (error) {
          done(error);
        } else {
          expect(response.body).toEqual({
            anonymous_token: expect.anything(),
          });
          anonymous_token = response.body.anonymous_token;
          forget();
        }
      });
  });
});

const watershed_details = {
  branch_size: 3,
  name: 'test watershed',
  description: 'about the test watershed',
};

describe('At /api/watersheds, a user', function () {
  let agent;

  beforeEach(function (done) {
    agent = request.agent(app);
    agent
      .post('/auth/anonymous')
      .end(then_F({ done }));
  });

  it('can create a new watershed', function (done) {
    agent
      .post('/api/watersheds')
      .send(watershed_details)
      .expect(201)
      .end(function (error, response) {
        if (error) {
          done(error);
        } else {
          expect(response.body).toEqual({
            ...watershed_details,
            nr_participants: 0,
            updated: expect.anything(),
            api_ref: expect.stringContaining('/api/watersheds/'),
          });
          done();
        }
      });
  });

  it('can get the list of watersheds', function (done) {
    function get_list(new_watershed_info) {
      agent
        .get('/api/watersheds')
        .expect(200)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            expect(response.body.length).toBe(1);
            expect(response.body[0]).toEqual(new_watershed_info);
            done();
          }
        });
    }

    agent
      .post('/api/watersheds')
      .send(watershed_details)
      .end(function (error, response) {
        if (error) {
          done(error);
        } else {
          get_list(response.body);
        }
      });
  });

  it('can join watersheds', function (done) {
    function join(watershed_url) {
      agent
        .post(watershed_url)
        .expect(200)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            expect(response.body).toEqual({
              branch_members: expect.anything(),
              watershed_participants_nr: 1,
              message_nr: 0,
              messages_page: [],
              progression: 0,
              messages_api_ref: expect.stringContaining(watershed_url),
            });
            done();
          }
        });
    }

    agent
      .post('/api/watersheds')
      .send(watershed_details)
      .end(function (error, response) {
        if (error) {
          done(error);
        } else {
          join(response.body.api_ref);
        }
      });
  });

  describe('can join a watershed and then', function () {
    let watershed_url;
    let messages_url;
    beforeEach(function (done) {
      function join(watershed_url) {
        agent
          .post(watershed_url)
          .expect(200)
          .end(function (error, response) {
            if (error) {
              done(error);
            } else {
              messages_url = response.body.messages_api_ref;
              done();
            }
          });
      }

      agent
        .post('/api/watersheds')
        .send(watershed_details)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            watershed_url = response.body.api_ref;
            join(watershed_url);
          }
        });
    });

    const message = { content: 'sample message' };

    it('can send messages', function (done) {
      agent
        .post(messages_url)
        .send(message)
        .expect(201)
        .end(then_F({ done, sendStatus: true }));
    });

    it('can list messages', function (done) {
      function list() {
        agent
          .get(messages_url)
          .expect(200)
          .end(function (error, response) {
            if (error) {
              done(error);
            } else {
              expect(response.body[0].content).toBe('sample message');
              done();
            }
          });
      }

      agent
        .post(messages_url)
        .send(message)
        .end(then_F({ done, next: list, sendStatus: true }));
    });

    /* it('can leave the watershed', function (done) {
    }); */
  });
});

