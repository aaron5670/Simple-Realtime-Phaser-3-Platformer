'use strict';
const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const mongoose = require('mongoose');
const db = mongoose.connection;
const srvConfig = require('./config');

const cors = require('cors');
const server = express();

//Middleware
server.use(cors({
    origin: 'http://localhost:8080',
    credentials: true
}));
server.use(bodyParser.json());
server.use(cookieParser());

var session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
});
var sharedsession = require("express-socket.io-session");

// Use express-session middleware for express
server.use(session);

// Create HTTP server by ourselves
const httpServer = http.createServer(server);
const io = require('socket.io').listen(httpServer);

// Use shared session middleware for socket.io
// setting autoSave:true
io.use(sharedsession(session, {
    autoSave: true
}));

const players = {};
io.on('connection', function (socket) {
    console.log('a player connected: ', socket.id);

    // create a new player and add it to our players object
    players[socket.id] = {
        flipX: false,
        x: Math.floor(50),
        y: Math.floor(100),
        playerId: socket.id
    };

    // send all current players
    socket.emit('CURRENT_PLAYERS', players);

    // update all other players of the new player
    socket.broadcast.emit('NEW_PLAYER', players[socket.id]);

    socket.on('PLAYER_CONNECTED', function () {
        socket.broadcast.emit('PLAYER_CONNECTED', players[socket.id]);
        console.log('A player connected!')
    });

    socket.on('PLAYER_MOVED', function (movementData) {
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;

        socket.broadcast.emit('PLAYER_MOVED', players[socket.id]);
    });

    // when a player disconnects, remove them from our players object
    socket.on('disconnect', function () {
        console.log('user disconnected: ', socket.id);
        delete players[socket.id];

        // emit a message to all players to remove this player
        io.emit('PLAYER_DISCONNECT', socket.id);
    });
});

// Start the server.
const port = 3001;
httpServer.listen(port, () => {
    mongoose.connect(`mongodb+srv://${srvConfig.USERNAME}:${srvConfig.PASSWORD}@${srvConfig.HOST}/${srvConfig.DB}?retryWrites=true&w=majority`, {   // <- Deployment server
        useNewUrlParser: true,
        useUnifiedTopology: true
    }, () => {
        console.log(`Server started on port ${port}`);
    });
});
