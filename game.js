// =================================================================
//  SETUP & CONFIG
// =================================================================
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1b1464',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false // Set to true to see physics boxes
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const TILE_SIZE = 32;
let hotelData = [];
const NUM_FLOORS = 5;
const MAP_WIDTH_TILES = 50;
const MAP_HEIGHT_TILES = 50;
let currentFloor = 0;
let money = 50000;
let buildMode = null;

let easystar;
let rooms = [];

// Game Objects
let roomGraphics, selectorGraphics, furnitureGroup, characterGroup;
let moneyText, buildStatusText, floorText;
let cursorPreview;

const game = new Phaser.Game(config);

function preload() {
    this.load.image('door_img', 'https://labs.phaser.io/assets/sprites/door.png');
    this.load.image('bed_img', 'https://labs.phaser.io/assets/sprites/bed.png');
    this.load.spritesheet('character_img', 'https://labs.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
}

function create() {
    // --- Data Init ---
    for (let f = 0; f < NUM_FLOORS; f++) {
        hotelData.push(Array(MAP_HEIGHT_TILES).fill(null).map(() => Array(MAP_WIDTH_TILES).fill(null)));
        rooms.push([]);
    }
    
    // --- Pathfinding Init ---
    easystar = new EasyStar.js();
    
    // --- Graphics & Groups ---
    this.graphics = this.add.graphics({ lineStyle: { width: 1, color: 0x444444 } });
    roomGraphics = this.add.graphics();
    selectorGraphics = this.add.graphics();
    furnitureGroup = this.add.group();
    characterGroup = this.physics.add.group();
    
    // --- Initial Draw ---
    drawGrid(this.graphics);
    findRooms(); // Includes initial drawFloor() and setupPathfinding()

    // --- Cursor Preview ---
    cursorPreview = this.add.image(0, 0, '').setAlpha(0.5).setVisible(false).setDepth(100);

    // --- UI ---
    setupUI(this);

    // --- Camera & Input ---
    setupCameraAndInput(this);

    // --- Guest Spawner ---
    this.time.addEvent({
        delay: 5000,
        callback: spawnGuest,
        callbackScope: this,
        loop: true
    });
}

function update(time, delta) {
    if (easystar) {
        easystar.calculate();
    }
    characterGroup.getChildren().forEach(character => character.update(time, delta));
    updateCursorPreview(this);
}

// =================================================================
//  CHARACTER CLASSES
// =================================================================

class Character extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture) {
        super(scene, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, texture);
        this.path = [];
        this.speed = 100;
        scene.physics.add.existing(this);
        characterGroup.add(this);
    }

    moveTo(targetTile) {
        if (!easystar) return;
        easystar.findPath(
            Math.floor(this.x / TILE_SIZE), Math.floor(this.y / TILE_SIZE),
            targetTile.x, targetTile.y,
            (path) => {
                if (path) {
                    this.path = path;
                }
            }
        );
    }

    update() {
        if (this.path && this.path.length > 0) {
            const targetNode = this.path[0];
            const targetX = targetNode.x * TILE_SIZE + TILE_SIZE / 2;
            const targetY = targetNode.y * TILE_SIZE + TILE_SIZE / 2;
            const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);

            if (distance < 4) {
                this.path.shift();
                if(this.path.length === 0) {
                    this.body.reset(targetX, targetY);
                }
            } else {
                const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
                this.scene.physics.velocityFromRotation(angle, this.speed, this.body.velocity);
            }
        } else {
            if (this.body) {
                this.body.reset(this.x, this.y);
            }
        }
    }
}

class Guest extends Character {
    constructor(scene, x, y, texture) {
        super(scene, x, y, texture);
        this.moveTo({x: 10, y: 10}); // Give a default destination
    }
}

// =================================================================
//  CORE LOGIC
// =================================================================

function spawnGuest() {
    // FIX: Using 'this' which is the correct scene context
    const availableRoom = rooms[currentFloor].find(r => r.status === 'available');
    if (availableRoom) {
        new Guest(this, 0, 5, 'character_img');
    }
}

function findRooms() {
    rooms[currentFloor] = [];
    let visited = Array(MAP_HEIGHT_TILES).fill(false).map(() => Array(MAP_WIDTH_TILES).fill(false));

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            if (hotelData[currentFloor][y][x] && hotelData[currentFloor][y][x].type === 'standard_room' && !visited[y][x]) {
                let roomTiles = [], toVisit = [{x, y}], hasBed = false, hasDoor = false;
                visited[y][x] = true;
                
                while(toVisit.length > 0) {
                    let current = toVisit.pop();
                    roomTiles.push(current);
                    
                    hotelData[currentFloor][current.y][current.x].furniture.forEach(item => {
                        if(item.type === 'bed') hasBed = true;
                        if(item.type === 'door') hasDoor = true;
                    });

                    [[0,-1], [0,1], [-1,0], [1,0]].forEach(dir => {
                        let nx = current.x + dir[0], ny = current.y + dir[1];
                        if(hotelData[currentFloor][ny]?.[nx]?.type === 'standard_room' && !visited[ny][nx]) {
                            visited[ny][nx] = true;
                            toVisit.push({x: nx, y: ny});
                        }
                    });
                }
                rooms[currentFloor].push({ tiles: roomTiles, status: (hasBed && hasDoor) ? 'available' : 'incomplete' });
            }
        }
    }
    drawFloor();
    setupPathfinding();
}

function setupPathfinding() {
    if (!easystar) return;
    let grid = hotelData[currentFloor].map(row => row.map(tile => (tile ? 1 : 0)));
    easystar.setGrid(grid);
    easystar.setAcceptableTiles([0]);
}

// =================================================================
//  INPUT HANDLING
// =================================================================

function setupCameraAndInput(scene) {
    scene.cameras.main.setBounds(0, 0, MAP_WIDTH_TILES * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    let selectionStartTile = null;

    scene.input.on('pointerdown', (pointer) => {
        const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / TILE_SIZE);
        const tileY = Math.floor(worldPoint.y / TILE_SIZE);

        if (buildMode === 'standard_room') {
            selectionStartTile = { x: tileX, y: tileY };
        } else if (buildMode && buildMode.startsWith('place_')) {
            placeFurniture(tileX, tileY);
        }
    });
    
    scene.input.on('pointermove', (pointer) => {
        if (!pointer.isDown) return;
        if (buildMode === 'standard_room' && selectionStartTile) {
            const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
            drawSelectionBox(selectionStartTile, { x: Math.floor(worldPoint.x / TILE_SIZE), y: Math.floor(worldPoint.y / TILE_SIZE) });
        } else if (!buildMode) {
            scene.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / scene.cameras.main.zoom;
            scene.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / scene.cameras.main.zoom;
        }
    });

    scene.input.on('pointerup', (pointer) => {
        if (buildMode === 'standard_room' && selectionStartTile) {
            const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
            zoneRoom(selectionStartTile, { x: Math.floor(worldPoint.x / TILE_SIZE), y: Math.floor(worldPoint.y / TILE_SIZE) });
            selectionStartTile = null;
            selectorGraphics.clear();
        }
    });
}

// =================================================================
//  BUILDING & ZONING
// =================================================================

function zoneRoom(start, end) {
    const startX = Math.min(start.x, end.x), startY = Math.min(start.y, end.y);
    const endX = Math.max(start.x, end.x), endY = Math.max(start.y, end.y);
    const roomCost = (endX - startX + 1) * (endY - startY + 1) * 100;
    if (money < roomCost) return;
    
    money -= roomCost; updateMoneyText();
    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            if (hotelData[currentFloor][y]?.[x] === null) {
                hotelData[currentFloor][y][x] = { type: 'standard_room', furniture: [] };
            }
        }
    }
    findRooms();
}

function placeFurniture(tileX, tileY) {
    const tile = hotelData[currentFloor][tileY]?.[tileX];
    if (!tile) return;
    const cost = (buildMode === 'place_door') ? 150 : 400;
    if (money < cost) return;

    money -= cost; updateMoneyText();
    const furnitureType = buildMode.split('_')[1];
    tile.furniture.push({ type: furnitureType, x: tileX, y: tileY });
    findRooms();
}

// =================================================================
//  UI & DRAWING
// =================================================================

function setupUI(scene) {
    moneyText = scene.add.text(10, 10, `Money: $${money}`, { fontSize: '20px', fill: '#ffff00' }).setScrollFactor(0).setDepth(100);
    buildStatusText = scene.add.text(10, 40, 'Mode: Pan & View', { fontSize: '16px', fill: '#ffffff' }).setScrollFactor(0).setDepth(100);
    floorText = scene.add.text(10, 70, `Floor: ${currentFloor + 1}`, { fontSize: '20px', fill: '#ffffff' }).setScrollFactor(0).setDepth(100);

    const floorUp = scene.add.text(120, 70, '▲', { fontSize: '20px', fill: '#00ff00', backgroundColor: '#333' }).setScrollFactor(0).setInteractive().setPadding(4).setDepth(100);
    const floorDown = scene.add.text(150, 70, '▼', { fontSize: '20px', fill: '#ff0000', backgroundColor: '#333' }).setScrollFactor(0).setInteractive().setPadding(4).setDepth(100);

    floorUp.on('pointerdown', () => { if (currentFloor < NUM_FLOORS - 1) { currentFloor++; floorText.setText(`Floor: ${currentFloor + 1}`); findRooms(); }});
    floorDown.on('pointerdown', () => { if (currentFloor > 0) { currentFloor--; floorText.setText(`Floor: ${currentFloor + 1}`); findRooms(); }});

    let yPos = 110;
    createBuildButton(scene, yPos, 'Pan & View', null);
    createBuildButton(scene, yPos += 35, 'Build Room', 'standard_room');
    createBuildButton(scene, yPos += 35, 'Place Door', 'place_door');
    createBuildButton(scene, yPos += 35, 'Place Bed', 'place_bed');
}

function createBuildButton(scene, y, text, mode) {
    const button = scene.add.text(10, y, text, { fontSize: '18px', fill: '#ffffff', backgroundColor: '#555555', padding: { x: 5, y: 5 } })
        .setScrollFactor(0).setInteractive().setDepth(100);
    button.on('pointerdown', () => {
        buildMode = mode;
        updateBuildStatusText();
        if (buildMode && buildMode.startsWith('place_')) {
            cursorPreview.setTexture(buildMode.split('_')[1] + '_img');
        }
    });
}

function updateCursorPreview(scene) {
    if (buildMode && buildMode.startsWith('place_')) {
        const worldPoint = scene.cameras.main.getWorldPoint(scene.input.x, scene.input.y);
        cursorPreview.setPosition(Math.floor(worldPoint.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2, Math.floor(worldPoint.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2);
        cursorPreview.setVisible(true);
    } else {
        cursorPreview.setVisible(false);
    }
}

function drawFloor() {
    roomGraphics.clear();
    furnitureGroup.clear(true, true);
    const statusColors = { incomplete: 0xff0000, available: 0x00ff00, occupied: 0x0000ff, dirty: 0x8B4513 };

    rooms[currentFloor].forEach(room => {
        roomGraphics.fillStyle(statusColors[room.status] || 0xff0000, 0.5);
        room.tiles.forEach(tilePos => roomGraphics.fillRect(tilePos.x * TILE_SIZE, tilePos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE));
    });

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tile = hotelData[currentFloor][y][x];
            if (tile?.furniture) {
                tile.furniture.forEach(item => furnitureGroup.create(item.x * TILE_SIZE + TILE_SIZE/2, item.y * TILE_SIZE + TILE_SIZE/2, item.type + '_img'));
            }
        }
    }
}

function drawGrid(graphics) {
    graphics.clear();
    for (let i = 0; i < MAP_WIDTH_TILES + 1; i++) graphics.lineBetween(i * TILE_SIZE, 0, i * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    for (let j = 0; j < MAP_HEIGHT_TILES + 1; j++) graphics.lineBetween(0, j * TILE_SIZE, MAP_WIDTH_TILES * TILE_SIZE, j * TILE_SIZE);
}

function drawSelectionBox(start, end) {
    selectorGraphics.clear();
    selectorGraphics.fillStyle(0x00ff00, 0.25);
    const x = Math.min(start.x, end.x) * TILE_SIZE;
    const y = Math.min(start.y, end.y) * TILE_SIZE;
    const w = (Math.abs(start.x - end.x) + 1) * TILE_SIZE;
    const h = (Math.abs(start.y - end.y) + 1) * TILE_SIZE;
    selectorGraphics.fillRect(x, y, w, h);
}

function updateMoneyText() { moneyText.setText(`Money: $${money}`); }
function updateBuildStatusText() { buildStatusText.setText(`Mode: ${buildMode || 'Pan & View'}`); }
