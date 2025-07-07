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
let buildMode = null; // What are we currently building? (e.g., 'standard_room')
let money = 50000; // Player's starting money

const NUM_FLOORS = 5;
const TILE_SIZE = 32;
const MAP_WIDTH_TILES = 50;
const MAP_HEIGHT_TILES = 50;

// --- Game Objects ---
let roomGraphics; // A separate graphics object for drawing the rooms
let selectorGraphics; // A graphics object for the drag-selector
let moneyText;

const game = new Phaser.Game(config);

function preload() {}

function create() {
    // --- Initialize Data & Graphics ---
    for (let f = 0; f < NUM_FLOORS; f++) {
        hotelData.push(Array(MAP_HEIGHT_TILES).fill(0).map(() => Array(MAP_WIDTH_TILES).fill(0)));
    }
    this.graphics = this.add.graphics({ lineStyle: { width: 1, color: 0x444444 } });
    roomGraphics = this.add.graphics();
    selectorGraphics = this.add.graphics();
    drawGrid(this.graphics);
    drawRooms();

    // --- Camera Controls ---
    this.cameras.main.setBounds(0, 0, MAP_WIDTH_TILES * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    let dragStart = null;
    this.input.on('pointermove', (pointer) => {
        if (!pointer.isDown) {
            dragStart = null;
            return;
        }
        if (!dragStart) {
            dragStart = { x: pointer.x, y: pointer.y };
        }
        if (buildMode) {
             // Handle drawing the build selector in update()
        } else {
            this.cameras.main.scrollX -= (pointer.x - dragStart.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (pointer.y - dragStart.y) / this.cameras.main.zoom;
        }
    });

    // --- Zoning/Building Logic ---
    let selectionStartTile = null;
    this.input.on('pointerdown', (pointer) => {
        if (!buildMode) return;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        selectionStartTile = { x: Math.floor(worldPoint.x / TILE_SIZE), y: Math.floor(worldPoint.y / TILE_SIZE) };
    });

    this.input.on('pointerup', (pointer) => {
        if (!buildMode || !selectionStartTile) return;

        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const selectionEndTile = { x: Math.floor(worldPoint.x / TILE_SIZE), y: Math.floor(worldPoint.y / TILE_SIZE) };
        
        const startX = Math.min(selectionStartTile.x, selectionEndTile.x);
        const startY = Math.min(selectionStartTile.y, selectionEndTile.y);
        const endX = Math.max(selectionStartTile.x, selectionEndTile.x);
        const endY = Math.max(selectionStartTile.y, selectionEndTile.y);
        
        const roomCost = (endX - startX + 1) * (endY - startY + 1) * 100; // $100 per tile
        if (money >= roomCost) {
            money -= roomCost;
            updateMoneyText();
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    hotelData[currentFloor][y][x] = 1; // 1 represents a Standard Room
                }
            }
            drawRooms();
        } else {
            console.log("Not enough money!");
        }

        selectionStartTile = null;
        selectorGraphics.clear();
    });


    // --- UI ---
    this.floorText = this.add.text(10, 10, `Floor: ${currentFloor + 1}`, { fontSize: '24px', fill: '#ffffff' }).setScrollFactor(0);
    moneyText = this.add.text(10, 40, `Money: $${money}`, { fontSize: '24px', fill: '#ffff00' }).setScrollFactor(0);
    
    const floorUp = this.add.text(150, 10, '▲', { fontSize: '24px', fill: '#00ff00' }).setScrollFactor(0).setInteractive();
    const floorDown = this.add.text(200, 10, '▼', { fontSize: '24px', fill: '#ff0000' }).setScrollFactor(0).setInteractive();

    floorUp.on('pointerdown', () => {
        if (currentFloor < NUM_FLOORS - 1) {
            currentFloor++;
            this.floorText.setText(`Floor: ${currentFloor + 1}`);
            drawRooms();
        }
    });
    floorDown.on('pointerdown', () => {
        if (currentFloor > 0) {
            currentFloor--;
            this.floorText.setText(`Floor: ${currentFloor + 1}`);
            drawRooms();
        }
    });

    // Build Button
    const buildButton = this.add.text(10, 70, 'Build Standard Room', { fontSize: '18px', fill: '#ffffff', backgroundColor: '#555555', padding: {x: 5, y: 5} }).setScrollFactor(0).setInteractive();
    buildButton.on('pointerdown', () => {
        buildMode = (buildMode === 'standard_room') ? null : 'standard_room';
        buildButton.setBackgroundColor(buildMode ? '#00ff00' : '#555555');
    });
}

function update(time, delta) {
    // --- Live Drawing of Selection Rectangle ---
    if (buildMode && this.input.activePointer.isDown && this.input.activePointer.getDuration() > 100) {
        const startPoint = this.cameras.main.getWorldPoint(this.input.activePointer.downX, this.input.activePointer.downY);
        const endPoint = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
        
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(startPoint.x - endPoint.x);
        const height = Math.abs(startPoint.y - endPoint.y);

        selectorGraphics.clear();
        selectorGraphics.fillStyle(0x00ff00, 0.25);
        selectorGraphics.fillRect(x, y, width, height);
    }
}

function drawGrid(graphics) {
    graphics.clear();
    for (let i = 0; i < MAP_WIDTH_TILES + 1; i++) graphics.lineBetween(i * TILE_SIZE, 0, i * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    for (let j = 0; j < MAP_HEIGHT_TILES + 1; j++) graphics.lineBetween(0, j * TILE_SIZE, MAP_WIDTH_TILES * TILE_SIZE, j * TILE_SIZE);
}

function drawRooms() {
    roomGraphics.clear();
    roomGraphics.fillStyle(0xff0000, 0.5); // Red color for standard rooms
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            if (hotelData[currentFloor][y][x] === 1) {
                roomGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

function updateMoneyText() {
    moneyText.setText(`Money: $${money}`);
}
