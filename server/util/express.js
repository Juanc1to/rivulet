const debug = require('debug')('rivulet:server');

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener factory for HTTP server "error" event
 */
function onError_F(port) {
  return function onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    var bind = (typeof port === 'string'
                ? 'Pipe ' + port
                : 'Port ' + port);

    // Handle specific listen errors with friendly messages.
    if (error.code === 'EACCES') {
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
    } else if (error.code === 'EADDRINUSE') {
      console.error(bind + ' is already in use');
      process.exit(1);
    } else {
      throw error;
    }
  };
}

/**
 * Event listener factory for HTTP server "listening" event
 */
function onListening_F(server) {
  return function () {
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    debug('Listening on ' + bind);
  };
}

module.exports = Object.freeze({
  normalizePort, onListening_F, onError_F
});
