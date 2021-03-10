// external utilities
const request = require('supertest');
const { Repeat, Map, Set } = require('immutable');

// model modules
const app = require('../app');

// local utilities
const { then_F } = require('./util/supertest');
const util = require('./db/util');

const db = app.get('db');

// afterAll(util.drop_all_tables_factory(db));

afterEach(util.delete_from_each_table_factory(db));

describe('Accessing data-modifying routes (at /api)', function () {
  it('requires authorization by default', function (done) {
    function try_create() {
      request(app)
        .post('/api/watersheds')
        .expect(401)
        .end(then_F({ done }));
    }

    request(app)
      .get('/api')
      .expect(401)
      .end(then_F({ done, next: try_create }));
  });

  it('supports anonymous identification', function (done) {
    const agent = request.agent(app).accept('json');

    function reregister() {
      // If you have already set up an anonymous session, you can't do it again
      // without forgetting the old one first.
      agent
        .post('/account/anonymous')
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
        .post('/account/anonymous')
        .expect(200)
        .end(then_F({ done, next: access }));
    }

    agent
      .get('/account/anonymous/foo')
      .expect(400)  // This might be better as 422...
      .end(then_F({ done, next: register, sendStatus: true }));
  });

  it('supports updating user details', function (done) {
    const agent = request.agent(app).accept('json');

    function update() {
      agent
        .post('/account')
        .send({ name: 'test name', email: 'test@email.ext' })
        .expect(200)
        .end(then_F({ done }));
    }

    agent
      .post('/account/anonymous')
      .end(then_F({ done, next: update }));
  });

  it('supports logging out', function (done) {
    const agent = request.agent(app).accept('json');

    function access() {
      agent
        .get('/api')
        .expect(401)
        .end(then_F({ done, sendStatus: true }));
    }

    function forget() {
      agent
        .post('/account/forget')
        .expect(200)
        .end(then_F({ done, next: access, sendStatus: true }));
    }

    agent
      .post('/account/anonymous')
      .expect(200)
      .end(then_F({ done, next: forget }));
  });

  it('can retrieve previous anonymous identification', function (done) {
    const agent = request.agent(app).accept('json');
    let anonymous_token;

    function access() {
      agent
        .get('/api')
        .expect(200)
        .end(then_F({ done }));
    }

    function identify() {
      agent
        .get(`/account/anonymous/${anonymous_token}`)
        .expect(200)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            expect(response.body).toEqual({
              anonymous_token,
              user_id: expect.anything(),
              email: null,
              name: null
            });
            access();
          }
        });
    }

    function forget() {
      agent
        .post('/account/forget')
        .expect(200)
        .end(then_F({ done, next: identify, sendStatus: true }));
    }

    agent
      .post('/account/anonymous')
      .expect(200)
      .end(function (error, response) {
        if (error) {
          done(error);
        } else {
          expect(response.body).toEqual({
            anonymous_token: expect.anything(),
            user_id: expect.anything()
          });
          anonymous_token = response.body.anonymous_token;
          forget();
        }
      });
  });
});

const watershed_details = {
  branch_size: 2,
  name: 'test watershed',
  description: 'about the test watershed',
};

describe('At /api/watersheds, a user', function () {
  let agent;

  beforeEach(function (done) {
    agent = request.agent(app).accept('json');
    agent
      .post('/account/anonymous')
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
        .send({ action: 'join' })
        .expect(200)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            expect(response.body).toEqual({
              branch_members: expect.anything(),
              watershed_details: {
                ...watershed_details,
                id: expect.anything(),
                updated: expect.anything()
              },
              nr_watershed_participants: 1,
              nr_messages: 0,
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
          .send({ action: 'join' })
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
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            expect(response.body).toEqual({
              reactions_api_ref: expect.stringContaining(messages_url)
            });
            done();
          }
        });
    });

    it('can leave the current branch and arrive on a different branch',
       function (done) {
      function abandon_branch() {
        agent
          .post(watershed_url)
          .send({ action: 'different branch' })
          .expect(200)
          .end(function (error, response) {
            if (error) {
              done(error);
            } else {
              expect(response.body.nr_messages).toBe(0);
              done();
            }
          });
      }

      agent
        .post(messages_url)
        .send(message)
        .expect(201)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            abandon_branch();
          }
        });
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
        .end(then_F({ done, next: list }));
    });

    it('can react to messages', function (done) {
      const reaction = { intent: "+1" };
      function react(reactions_url) {
        agent
          .post(reactions_url)
          .send(reaction)
          .expect(201)
          .end(then_F({ done, sendStatus: true }));
      }

      agent
        .post(messages_url)
        .send(message)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            react(response.body.reactions_api_ref);
          }
        });
    });

    it('can list reactions to a message', function (done) {
      let reactions_url;
      function list() {
        agent
          .get(reactions_url)
          .expect(200)
          .end(function (error, response) {
            if (error) {
              done(error);
            } else {
              expect(response.body[0].intent).toBe('+1');
              done();
            }
          });
      }

      const reaction = { intent: "+1" };
      function react() {
        agent
          .post(reactions_url)
          .send(reaction)
          .expect(201)
          .end(then_F({ next: list, sendStatus: true }));
      }

      agent
        .post(messages_url)
        .send(message)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            reactions_url = response.body.reactions_api_ref;
            react();
          }
        });
    });

    /* it('can leave the watershed', function (done) {
    }); */
  });
});

describe('Together in a branch, a set of users', function () {
  const branch_size = 2;
  let user_agents, watershed_url;

  beforeEach(function (done) {
    function join_each(user_agent_list, user_nr = 0) {
      if (user_nr === user_agent_list.size) {
        done();
      } else {
        user_agent_list.getIn([user_nr, 'agent'])
          .post(watershed_url)
          .send({ action: 'join' })
          .end(function (error, response) {
            if (error) {
              done(error);
            } else {
              join_each(user_agent_list, user_nr + 1)
            }
          });
      }
    }

    function create_watershed() {
      user_agents.getIn([0, 'agent'])
        .post('/api/watersheds')
        .send(watershed_details)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            watershed_url = response.body.api_ref;
            join_each(user_agents)
          }
        });
    }

    function first_register_each(user_agent_list, user_nr = 0) {
      if (user_nr === user_agent_list.size) {
        create_watershed();
      } else {
        user_agent_list.getIn([user_nr, 'agent'])
          .post('/account/anonymous')
          .end(function (error, response) {
            if (error) {
              done(error);
            } else {
              user_agents = user_agents.set(user_nr,
                user_agent_list.get(user_nr).set('user_id',
                                                 response.body.user_id));
              first_register_each(user_agent_list, user_nr + 1)
            }
          });
      }
    }

    user_agents = Repeat(undefined, branch_size * 2).map(function () {
      return Map({ agent: request.agent(app).accept('json'),
                   user_id: undefined });
    }).toList();
    first_register_each(user_agents);
  });

  it('can use proposals to select a representative', function (done) {
    let first_proposal_reactions_url, second_proposal_reactions_url;

    function last_join() {
      user_agents.last().get('agent')
        .post(watershed_url)
        .send({ action: 'join' })
        .expect(200)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            expect(response.body.progression).toBe(1);
            expect(response.body.branch_members).toStrictEqual([
            {
              name: null,
              user_id: user_agents.first().get('user_id'),
              end_status: null
            },
            {
              name: null,
              user_id: user_agents.last().get('user_id'),
              end_status: null
            }]);
            done();
          }
        });
    }

    function first_join() {
      user_agents.first().get('agent')
        .post(watershed_url)
        .send({ action: 'join' })
        .expect(200)
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            expect(response.body.progression).toBe(1);
            expect(response.body.branch_members).toStrictEqual([{
              name: null,
              user_id: user_agents.first().get('user_id'),
              end_status: null,
            }]);
            last_join();
          }
        });
    }

    function reaction_votes(user_agent_list, user_nr = 0) {
      if (user_nr === user_agent_list.size) {
        first_join();
      } else {
        const reactions_url = (user_nr < 2
                               ? first_proposal_reactions_url
                               : second_proposal_reactions_url);
        user_agent_list.getIn([user_nr, 'agent'])
          .post(reactions_url)
          .send({ intent: "+1" })
          .end(function (error, response) {
            if (error) {
              done(error);
            } else {
              reaction_votes(user_agent_list, user_nr + 1);
            }
          });
      }
    }

    const proposal_template = Map({
      content: 'proposing a representative',
      proposal_type: 'representative',
    });

    function proposal_second_branch() {
      user_agents.last().get('agent')
        .post(`${watershed_url}/messages`)
        .send(proposal_template.set('proposal_input',
          String(user_agents.last().get('user_id'))).toJS())
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            second_proposal_reactions_url = response.body.reactions_api_ref;
            reaction_votes(user_agents);
          }
        });
    }

    function proposal_first_branch() {
      user_agents.first().get('agent')
        .post(`${watershed_url}/messages`)
        .send(proposal_template.set('proposal_input',
          String(user_agents.first().get('user_id'))).toJS())
        .end(function (error, response) {
          if (error) {
            done(error);
          } else {
            first_proposal_reactions_url = response.body.reactions_api_ref;
            proposal_second_branch();
          }
        });
    }

    proposal_first_branch();
  });

  it.skip('can set a message as the branch summary', function (done) {
  });
});
