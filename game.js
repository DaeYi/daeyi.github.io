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
let buildMode = null;
let money = 50000;

const NUM_FLOORS = 5;
const TILE_SIZE = 32;
const MAP_WIDTH_TILES = 50;
const MAP_HEIGHT_TILES = 50;

// --- Costs ---
const ROOM_COST_PER_TILE = 100;
const DOOR_COST = 150;
const BED_COST = 400;

// --- Game Objects ---
let roomGraphics, selectorGraphics, furnitureGroup;
let moneyText, buildStatusText;
let cursorPreview;

const game = new Phaser.Game(config);

function preload() {
    // We are now loading image assets! These are hosted by Phaser for examples.
    this.load.image('door_img', 'https://labs.phaser.io/assets/sprites/door.png');
    this.load.image('bed_img', 'https://labs.phaser.io/assets/sprites/bed.png');
}

function create() {
    // --- Data Model v2 ---
    // Each tile is now an object, not just a number. This is much more flexible.
    for (let f = 0; f < NUM_FLOORS; f++) {
        hotelData.push(Array(MAP_HEIGHT_TILES).fill(null).map(() => Array(MAP_WIDTH_TILES).fill(null)));
    }

    // --- Graphics & Groups ---
    this.graphics = this.add.graphics({ lineStyle: { width: 1, color: 0x444444 } });
    roomGraphics = this.add.graphics();
    selectorGraphics = this.add.graphics();
    furnitureGroup = this.add.group(); // A group to hold all our furniture sprites
    drawGrid(this.graphics);
    drawFloor();

    // --- Cursor Preview ---
    cursorPreview = this.add.image(0, 0, '').setAlpha(0.5).setVisible(false);

    // --- Camera & Input ---
    setupCameraAndInput(this);

    // --- UI ---
    setupUI(this);
}

function update() {
    // --- Update Cursor Preview ---
    if (buildMode && buildMode.startsWith('place_')) {
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / TILE_SIZE);
        const tileY = Math.floor(worldPoint.y / TILE_SIZE);
        
        cursorPreview.setPosition(tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2);
        cursorPreview.setVisible(true);
    } else {
        cursorPreview.setVisible(false);
    }

    // --- Live Drawing of Selection Rectangle (for zoning) ---
    if (buildMode === 'standard_room' && this.input.activePointer.isDown) {
        // This logic is now handled in setupCameraAndInput to avoid complexity here.
    }
}

// --- Helper Functions ---

function setupCameraAndInput(scene) {
    scene.cameras.main.setBounds(0, 0, MAP_WIDTH_TILES * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    let dragStart = null;
    let selectionStartTile = null;

    scene.input.on('pointerdown', (pointer) => {
        const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / TILE_SIZE);
        const tileY = Math.floor(worldPoint.y / TILE_SIZE);

        if (buildMode === 'standard_room') {
            selectionStartTile = { x: tileX, y: tileY };
        } else if (buildMode === 'place_door' || buildMode === 'place_bed') {
            placeFurniture(tileX, tileY);
        }
    });
    
    scene.input.on('pointermove', (pointer) => {
        if (!pointer.isDown) return;
        if (buildMode === 'standard_room' && selectionStartTile) {
            const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
            drawSelectionBox(selectionStartTile.x, selectionStartTile.y, Math.floor(worldPoint.x / TILE_SIZE), Math.floor(worldPoint.y / TILE_SIZE));
        } else if (!buildMode) {
             // Simple pan
            scene.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / scene.cameras.main.zoom;
            scene.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / scene.cameras.main.zoom;
        }
    });

    scene.input.on('pointerup', (pointer) => {
        if (buildMode === 'standard_room' && selectionStartTile) {
            const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
            const endTile = { x: Math.floor(worldPoint.x / TILE_SIZE), y: Math.floor(worldPoint.y / TILE_SIZE) };
            zoneRoom(selectionStartTile, endTile);
            selectionStartTile = null;
            selectorGraphics.clear();
        }
    });
}

function setupUI(scene) {
    // --- Text Displays ---
    moneyText = scene.add.text(10, 10, `Money: $${money}`, { fontSize: '20px', fill: '#ffff00' }).setScrollFactor(0);
    buildStatusText = scene.add.text(10, 40, 'Mode: Pan & View', { fontSize: '16px', fill: '#ffffff' }).setScrollFactor(0);
    scene.floorText = scene.add.text(10, 70, `Floor: ${currentFloor + 1}`, { fontSize: '20px', fill: '#ffffff' }).setScrollFactor(0);

    // --- Floor Buttons ---
    const floorUp = scene.add.text(120, 70, '▲', { fontSize: '20px', fill: '#00ff00', backgroundColor: '#333' }).setScrollFactor(0).setInteractive().setPadding(4);
    const floorDown = scene.add.text(150, 70, '▼', { fontSize: '20px', fill: '#ff0000', backgroundColor: '#333' }).setScrollFactor(0).setInteractive().setPadding(4);

    floorUp.on('pointerdown', () => { if (currentFloor < NUM_FLOORS - 1) { currentFloor++; scene.floorText.setText(`Floor: ${currentFloor + 1}`); drawFloor(); }});
    floorDown.on('pointerdown', () => { if (currentFloor > 0) { currentFloor--; scene.floorText.setText(`Floor: ${currentFloor + 1}`); drawFloor(); }});

    // --- Build Buttons ---
    let yPos = 110;
    createBuildButton(scene, yPos, 'Pan & View', null, '#00ff00');
    createBuildButton(scene, yPos += 35, 'Build Room', 'standard_room', '#ffffff');
    createBuildButton(scene, yPos += 35, 'Place Door', 'place_door', '#ffffff');
    createBuildButton(scene, yPos += 35, 'Place Bed', 'place_bed', '#ffffff');
}

function createBuildButton(scene, y, text, mode, color) {
    const button = scene.add.text(10, y, text, { fontSize: '18px', fill: color, backgroundColor: '#555555', padding: { x: 5, y: 5 } })
        .setScrollFactor(0).setInteractive();
    button.on('pointerdown', () => {
        buildMode = mode;
        updateBuildStatusText();
        // Update cursor preview image
        if (buildMode && buildMode.startsWith('place_')) {
            cursorPreview.setTexture(buildMode.split('_')[1] + '_img');
        }
    });
}

function zoneRoom(start, end) {
    const startX = Math.min(start.x, end.x);
    const startY = Math.min(start.y, end.y);
    const endX = Math.max(start.x, end.x);
    const endY = Math.max(start.y, end.y);
    
    const roomCost = (endX - startX + 1) * (endY - startY + 1) * ROOM_COST_PER_TILE;
    if (money < roomCost) return;

    money -= roomCost;
    updateMoneyText();

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            // Only build on empty tiles
            if (hotelData[currentFloor][y][x] === null) {
                hotelData[currentFloor][y][x] = { type: 'standard_room', furniture: [] };
            }
        }
    }
    drawFloor();
}

function placeFurniture(tileX, tileY) {
    const tile = hotelData[currentFloor][tileY]?.[tileX];
    if (!tile) return; // Can't place furniture outside a room

    const cost = (buildMode === 'place_door') ? DOOR_COST : BED_COST;
    if (money < cost) return;

    money -= cost;
    updateMoneyText();

    const furnitureType = buildMode.split('_')[1]; // 'door' or 'bed'
    tile.furniture.push({ type: furnitureType, x: tileX, y: tileY });
    
    drawFloor();
}

function drawFloor() {
    // This function now redraws both rooms and furniture for the current floor
    roomGraphics.clear();
    furnitureGroup.clear(true, true); // Remove all furniture sprites

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tile = hotelData[currentFloor][y][x];
            if (tile) {
                // Draw room tile
                roomGraphics.fillStyle(0xff0000, 0.5); // Red for 'zoned'
                roomGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                
                // Draw furniture in the tile
                tile.furniture.forEach(item => {
                    const furnitureSprite = furnitureGroup.create(item.x * TILE_SIZE + TILE_SIZE/2, item.y * TILE_SIZE + TILE_SIZE/2, item.type + '_img');
                });
            }
        }
    }
}

function drawGrid(graphics) {
    graphics.clear();
    for (let i = 0; i < MAP_WIDTH_TILES + 1; i++) graphics.lineBetween(i * TILE_SIZE, 0, i * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    for (let j = 0; j < MAP_HEIGHT_TILES + 1; j++) graphics.lineBetween(0, j * TILE_SIZE, MAP_WIDTH_TILES * TILE_SIZE, j * TILE_SIZE);
}

function drawSelectionBox(startX, startY, endX, endY) {
    selectorGraphics.clear();
    selectorGraphics.fillStyle(0x00ff00, 0.25);
    const x = Math.min(startX, endX) * TILE_SIZE;
    const y = Math.min(startY, endY) * TILE_SIZE;
    const w = (Math.abs(startX - endX) + 1) * TILE_SIZE;
    const h = (Math.abs(startY - endY) + 1) * TILE_SIZE;
    selectorGraphics.fillRect(x, y, w, h);
}

function updateMoneyText() { moneyText.setText(`Money: $${money}`); }
function updateBuildStatusText() { buildStatusText.setText(`Mode: ${buildMode || 'Pan & View'}`); }
