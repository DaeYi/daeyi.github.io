#include objects.js;

// game.js
var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

// Class definitions for Hotel, Room, Guest, and Staff
class Hotel {
    constructor(name) {
        this.name = name;
        this.rooms = [];
        this.staff = [];
        this.budget = 10000;
        this.reputation = 5;
    }

    cleanRoom(room) {
        room.status = 'clean';
        room.guest = null;
    }
}

class Room {
    constructor(number, type) {
        this.number = number;
        this.type = type;
        this.status = 'clean';
        this.guest = null;
    }
}

class Guest {
    constructor(name, arrivalTime, departureTime, preferences) {
        this.name = name;
        this.arrivalTime = arrivalTime;
        this.departureTime = departureTime;
        this.preferences = preferences;
    }
}

class Staff {
    constructor(name, role, salary) {
        this.name = name;
        this.role = role;
        this.salary = salary;
    }
}

// Game scenes
var MainScene = new Phaser.Scene('MainScene');

MainScene.preload = function () {
    // Load assets
};

MainScene.create = function () {
    // Create game objects and initialize the game
};

MainScene.update = function () {
    // Update game logic
     // Guest arrival
    if (Math.random() < 0.2) { // Adjust probability as needed
        let guest = new Guest('Guest ' + (guestCount++), Date.now(), Date.now() + 3600000, ['cleanliness']); // 1 hour stay
        this.hotel.guests.push(guest);
    }

    // Room assignment
    this.hotel.guests.forEach(guest => {
        if (!guest.room) {
            let availableRoom = this.hotel.rooms.find(room => room.status === 'clean');
            if (availableRoom) {
                availableRoom.status = 'occupied';
                availableRoom.guest = guest;
                guest.room = availableRoom;
            }
        }
    });

    // Room cleaning
    this.hotel.staff.forEach(staff => {
        if (staff.role === 'housekeeping') {
            let dirtyRoom = this.hotel.rooms.find(room => room.status === 'dirty');
            if (dirtyRoom) {
                this.hotel.cleanRoom(dirtyRoom);
            }
        }
    });
};

// Add the scene to the game
game.scene.add('MainScene', MainScene);
game.scene.start('MainScene');

function preload ()
{
    // Load assets here, e.g., images, sounds
}

function create ()
{
    // Create game objects here, e.g., sprites, text
}

function update ()
{
    // Update game logic here

   
}


