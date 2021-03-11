const { server, port } = require('./app');
const { onListening_F, onError_F } = require('./util/express');

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError_F(port));
server.on('listening', onListening_F(server));
