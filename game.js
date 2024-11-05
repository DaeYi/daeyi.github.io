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
