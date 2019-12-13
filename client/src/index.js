import Phaser from "phaser";
import backgroundImg from "./assets/images/background.png";
import platformPackTilesheet from "./assets/tilesets/platformPack_tilesheet.png";
import spikeImg from "./assets/images/spike.png"
import level1JSON from "./assets/tilemaps/level1.json";
import playerImg from "./assets/images/kenney_player.png";
import playerAtlas from "./assets/images/kenney_player_atlas";

import onlinePlayerImg from "./assets/images/char03_0000.png"
import io from "socket.io-client";
import {PORT, URL} from "./settings";


const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 800,
    heigth: 640,
    // scale: {
    //     mode: Phaser.Scale.RESIZE,
    //     autoCenter: Phaser.Scale.CENTER_BOTH
    // },
    scene: {
        preload,
        create,
        update,
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {y: 500},
        },
    }
};
new Phaser.Game(config);

/*================================================
| Array with current online players
*/
let onlinePlayers = [];

function preload() {
    // Image layers from Tiled can't be exported to Phaser 3 (as yet)
    // So we add the background image separately
    this.load.image('background', backgroundImg);

    // Load the tileset image file, needed for the map to know what
    // tiles to draw on the screen
    this.load.image('tiles', platformPackTilesheet);

    // Even though we load the tilesheet with the spike image, we need to
    // load the Spike image separately for Phaser 3 to render it
    this.load.image('spike', spikeImg);

    // Second player
    this.load.image('onlinePlayerImg', onlinePlayerImg);

    // Load the export Tiled JSON
    this.load.tilemapTiledJSON('map', level1JSON);

    // Load player animations from the player spritesheet and atlas JSON
    this.load.atlas('player', playerImg, playerAtlas);
}

function create() {
    this.container = [];

    // Create socket connection
    this.socket = io.connect(`${URL}:${PORT}`);

    this.socket.on("CURRENT_PLAYERS", players => {
        console.log('CURRENT_PLAYERS');

        Object.keys(players).forEach(playerId => {
            if (players[playerId].playerId !== this.socket.id) {
                this.onlinePlayer = this.physics.add.sprite(players[playerId].x, players[playerId].y, "onlinePlayerImg");
                this.onlinePlayer.setBounce(0.1); // our player will bounce from items
                this.onlinePlayer.setCollideWorldBounds(true); // don't go out of the map
                this.physics.add.collider(this.onlinePlayer, platforms);
                onlinePlayers[players[playerId].playerId] = this.onlinePlayer;
            }
        })
    });

    this.socket.on('NEW_PLAYER', (player) => {
        console.log('NEW_PLAYER');

        this.onlinePlayer = this.physics.add.sprite(player.x, player.y, "onlinePlayerImg");
        this.onlinePlayer.setBounce(0.1); // our player will bounce from items
        this.onlinePlayer.setCollideWorldBounds(true); // don't go out of the map
        this.physics.add.collider(this.onlinePlayer, platforms);
        onlinePlayers[player.playerId] = this.onlinePlayer;
    });

    this.socket.on("PLAYER_MOVED", playerInfo => {
        console.log('PLAYER_MOVED');
        // console.log(playerInfo)

        onlinePlayers[playerInfo.playerId].setPosition(playerInfo.x, playerInfo.y);

        // Object.keys(onlinePlayers).forEach(playerId => {
        //     console.log('ME: ' + this.socket.id)
        //     console.log(playerId)
        //     // if (onlinePlayers[playerId] === playerInfo.playerId) {
        //     //     console.log('MOVED')
        //     // }
        // })
    });

    this.socket.on('PLAYER_DISCONNECT', (player) => {
        console.log('PLAYER_DISCONNECT');
        onlinePlayers[player].destroy()
    });

    // Create a tile map, which is used to bring our level in Tiled
    // to our game world in Phaser
    const map = this.make.tilemap({key: 'map'});

    // Add the tileset to the map so the images would load correctly in Phaser
    const tileset = map.addTilesetImage('kenney_simple_platformer', 'tiles');

    // Place the background image in our game world
    const backgroundImage = this.add.image(0, 0, 'background').setOrigin(0, 0);

    // Scale the image to better match our game's resolution
    backgroundImage.setScale(2, 0.8);

    // Add the platform layer as a static group, the player would be able
    // to jump on platforms like world collisions but they shouldn't move
    const platforms = map.createStaticLayer('Platforms', tileset, 0, 200);

    // There are many ways to set collision between tiles and players
    // As we want players to collide with all of the platforms, we tell Phaser to
    // set collisions for every tile in our platform layer whose index isn't -1.
    // Tiled indices can only be >= 0, therefore we are colliding with all of
    // the platform layer
    platforms.setCollisionByExclusion(-1, true);

    // Add the player to the game world
    this.player = this.physics.add.sprite(50, 300, 'player');
    this.player.setBounce(0.1); // our player will bounce from items
    this.player.setCollideWorldBounds(true); // don't go out of the map
    this.physics.add.collider(this.player, platforms);

    // Create the walking animation using the last 2 frames of
    // the atlas' first row
    this.anims.create({
        key: 'walk',
        frames: this.anims.generateFrameNames('player', {
            prefix: 'robo_player_',
            start: 2,
            end: 3,
        }),
        frameRate: 10,
        repeat: -1
    });

    // Create an idle animation i.e the first frame
    this.anims.create({
        key: 'idle',
        frames: [{key: 'player', frame: 'robo_player_0'}],
        frameRate: 10,
    });

    // Use the second frame of the atlas for jumping
    this.anims.create({
        key: 'jump',
        frames: [{key: 'player', frame: 'robo_player_1'}],
        frameRate: 10,
    });

    // Enable user input via cursor keys
    this.cursors = this.input.keyboard.createCursorKeys();

    // Create a sprite group for all spikes, set common properties to ensure that
    // sprites in the group don't move via gravity or by player collisions
    this.spikes = this.physics.add.group({
        allowGravity: false,
        immovable: true
    });

    // Get the spikes from the object layer of our Tiled map. Phaser has a
    // createFromObjects function to do so, but it creates sprites automatically
    // for us. We want to manipulate the sprites a bit before we use them
    const spikeObjects = map.getObjectLayer('Spikes')['objects'];
    spikeObjects.forEach(spikeObject => {
        // Add new spikes to our sprite group
        const spike = this.spikes.create(spikeObject.x, spikeObject.y + 200 - spikeObject.height, 'spike').setOrigin(0, 0);

        // By default the sprite has loads of whitespace from the base image, we
        // resize the sprite to reduce the amount of whitespace used by the sprite
        // so collisions can be more precise
        spike.body.setSize(spike.width, spike.height - 20).setOffset(0, 20);
    });

    // Add collision between the player and the spikes
    this.physics.add.collider(this.player, this.spikes, playerHit, null, this);
}

function update() {
    // Control the player with left or right keys
    if (this.cursors.left.isDown) {
        this.player.setVelocityX(-200);
        if (this.player.body.onFloor()) {
            this.player.play('walk', true);
        }
    } else if (this.cursors.right.isDown) {
        this.player.setVelocityX(200);
        if (this.player.body.onFloor()) {
            this.player.play('walk', true);
        }
    } else {
        // If no keys are pressed, the player keeps still
        this.player.setVelocityX(0);
        // Only show the idle animation if the player is footed
        // If this is not included, the player would look idle while jumping
        if (this.player.body.onFloor()) {
            this.player.play('idle', true);
        }
    }

    // Player can jump while walking any direction by pressing the space bar
    // or the 'UP' arrow
    if ((this.cursors.space.isDown || this.cursors.up.isDown) && this.player.body.onFloor()) {
        this.player.setVelocityY(-350);
        this.player.play('jump', true);
    }

    // If the player is moving to the right, keep them facing forward
    if (this.player.body.velocity.x > 0) {
        this.player.setFlipX(false);
    } else if (this.player.body.velocity.x < 0) {
        // otherwise, make them face the other side
        this.player.setFlipX(true);
    }

    let x = this.player.x;
    let y = this.player.y;
    if (this.container.oldPosition && (this.container.oldPosition.x !== x || this.container.oldPosition.y !== y)) {
        this.socket.emit('PLAYER_MOVED', {x, y})
    }

    this.container.oldPosition = {
        x: this.player.x,
        y: this.player.y
    }
}

/**
 * playerHit resets the player's state when it dies from colliding with a spike
 * @param {*} player - player sprite
 * @param {*} spike - spike player collided with
 */
function playerHit(player, spike) {
    // Set velocity back to 0
    player.setVelocity(0, 0);

    // Put the player back in its original position
    player.setX(50);
    player.setY(300);

    // Use the default `idle` animation
    player.play('idle', true);

    // Set the visibility to 0 i.e. hide the player
    player.setAlpha(0);

    // Add a tween that 'blinks' until the player is gradually visible
    let tw = this.tweens.add({
        targets: player,
        alpha: 1,
        duration: 100,
        ease: 'Linear',
        repeat: 5,
    });
}
