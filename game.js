// This is the main configuration object for our game
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1b1464',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// --- Game Variables ---
let currentFloor = 0;
let hotelData = [];
const NUM_FLOORS = 5;
const TILE_SIZE = 32; // The size of each grid tile in pixels
const MAP_WIDTH_TILES = 50; // Map width in tiles
const MAP_HEIGHT_TILES = 50; // Map height in tiles

// --- Phaser Game Instance ---
const game = new Phaser.Game(config);

function preload() {
    // Nothing to load yet
}

function create() {
    console.log("Step 2: Creating the world!");

    // --- Initialize Hotel Data Structure ---
    // We create a 3D structure: an array of floors, where each floor is a 2D grid.
    for (let f = 0; f < NUM_FLOORS; f++) {
        let floorGrid = Array(MAP_HEIGHT_TILES).fill(0).map(() => Array(MAP_WIDTH_TILES).fill(0));
        hotelData.push(floorGrid);
    }

    // --- Graphics & Grid ---
    // The graphics object is used for drawing shapes like our grid.
    this.graphics = this.add.graphics({ lineStyle: { width: 1, color: 0x444444 } });
    drawGrid(this.graphics);

    // --- Camera Controls (Panning) ---
    // We set the world bounds to be the size of our tile map.
    this.cameras.main.setBounds(0, 0, MAP_WIDTH_TILES * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    this.input.on('pointermove', function (pointer) {
        if (!pointer.isDown) return;
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
    }, this);
    
    // --- UI Elements ---
    // We use 'setScrollFactor(0)' to make UI elements "stick" to the screen and not move with the camera.
    this.floorText = this.add.text(10, 10, `Floor: ${currentFloor + 1}`, { fontSize: '24px', fill: '#ffffff' }).setScrollFactor(0);

    const floorUp = this.add.text(150, 10, '▲ Up', { fontSize: '24px', fill: '#00ff00' }).setScrollFactor(0).setInteractive();
    const floorDown = this.add.text(250, 10, '▼ Down', { fontSize: '24px', fill: '#ff0000' }).setScrollFactor(0).setInteractive();

    floorUp.on('pointerdown', () => {
        if (currentFloor < NUM_FLOORS - 1) {
            currentFloor++;
            this.floorText.setText(`Floor: ${currentFloor + 1}`);
        }
    });

    floorDown.on('pointerdown', () => {
        if (currentFloor > 0) {
            currentFloor--;
            this.floorText.setText(`Floor: ${currentFloor + 1}`);
        }
    });
}

function update() {
    // The update loop is still empty
}

/**
 * Draws the grid lines on the screen based on the map and tile size.
 * @param {Phaser.GameObjects.Graphics} graphics - The graphics object to draw on.
 */
function drawGrid(graphics) {
    graphics.clear(); // Clear the old grid before drawing a new one
    // Vertical lines
    for (let i = 0; i < MAP_WIDTH_TILES + 1; i++) {
        graphics.lineBetween(i * TILE_SIZE, 0, i * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    }
    // Horizontal lines
    for (let j = 0; j < MAP_HEIGHT_TILES + 1; j++) {
        graphics.lineBetween(0, j * TILE_SIZE, MAP_WIDTH_TILES * TILE_SIZE, j * TILE_SIZE);
    }
}
