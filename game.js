// =================================================================
//  SETUP & CONFIG
// =================================================================
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

// --- Game Objects ---
let roomGraphics, furnitureGroup, characterGroup;
let moneyText, buildStatusText;

const game = new Phaser.Game(config);

function preload() {
    this.load.image('door_img', 'https://daeyi.github.io/assets/door.png');
    this.load.image('bed_img', 'https://daeyi.github.io/assets/bed.png');
    this.load.spritesheet('character_img', 'https://labs.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
}

function create() {
    // --- Data Init ---
    for (let f = 0; f < NUM_FLOORS; f++) {
        hotelData.push(Array(MAP_HEIGHT_TILES).fill(null).map(() => Array(MAP_WIDTH_TILES).fill(null)));
        rooms.push([]); // Each floor has its own rooms array
    }
    
    // --- Pathfinding Init ---
    easystar = new EasyStar.js();
    setupPathfinding();

    // --- Graphics & Groups ---
    this.graphics = this.add.graphics({ lineStyle: { width: 1, color: 0x444444 } });
    roomGraphics = this.add.graphics();
    furnitureGroup = this.add.group();
    characterGroup = this.add.group();
    drawGrid(this.graphics);
    drawFloor();

    // --- Camera & Input ---
    setupCameraAndInput(this);

    // --- UI ---
    setupUI(this);

    // --- Guest Spawner ---
    this.time.addEvent({
        delay: 5000, // Check every 5 seconds
        callback: spawnGuest,
        callbackScope: this,
        loop: true
    });
}

function update(time, delta) {
    characterGroup.getChildren().forEach(character => character.update(time, delta));
    easystar.calculate();
}

// =================================================================
//  GAME LOGIC & CLASSES
// =================================================================

class Character extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture) {
        super(scene, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, texture);
        this.path = [];
        this.speed = 100; // pixels per second
        scene.add.existing(this);
        characterGroup.add(this);
    }

    moveTo(targetTile) {
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

    update(time, delta) {
        if (this.path.length > 0) {
            const targetNode = this.path[0];
            const targetX = targetNode.x * TILE_SIZE + TILE_SIZE / 2;
            const targetY = targetNode.y * TILE_SIZE + TILE_SIZE / 2;

            const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
            if (distance < 4) {
                this.path.shift();
                if(this.path.length === 0) {
                    this.body.reset(targetX, targetY); // Snap to final position
                }
            } else {
                const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
                this.scene.physics.velocityFromRotation(angle, this.speed, this.body.velocity);
            }
        } else {
            this.body.reset(this.x, this.y);
        }
    }
}

class Guest extends Character {
    // Guest-specific logic will go here
}

function spawnGuest() {
    // Simple check for any available room
    const availableRoom = rooms[currentFloor].find(r => r.status === 'available');
    if (availableRoom) {
        new Guest(game.scene.scenes[0], 0, 5, 'character_img'); // Spawn at tile (0,5)
    }
}

function findRooms() {
    rooms[currentFloor] = [];
    let visited = Array(MAP_HEIGHT_TILES).fill(false).map(() => Array(MAP_WIDTH_TILES).fill(false));

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            if (hotelData[currentFloor][y][x] && hotelData[currentFloor][y][x].type === 'standard_room' && !visited[y][x]) {
                let roomTiles = [];
                let toVisit = [{x, y}];
                visited[y][x] = true;
                
                let hasBed = false;
                let hasDoor = false;

                while(toVisit.length > 0) {
                    let current = toVisit.pop();
                    roomTiles.push(current);
                    
                    const tileData = hotelData[currentFloor][current.y][current.x];
                    if(tileData && tileData.furniture) {
                        tileData.furniture.forEach(item => {
                            if(item.type === 'bed') hasBed = true;
                            if(item.type === 'door') hasDoor = true;
                        });
                    }

                    // Check neighbors (up, down, left, right)
                    [[0,-1], [0,1], [-1,0], [1,0]].forEach(dir => {
                        let nx = current.x + dir[0];
                        let ny = current.y + dir[1];
                        if(hotelData[currentFloor][ny]?.[nx]?.type === 'standard_room' && !visited[ny][nx]) {
                            visited[ny][nx] = true;
                            toVisit.push({x: nx, y: ny});
                        }
                    });
                }
                
                let status = 'incomplete';
                if(hasBed && hasDoor) {
                    status = 'available';
                }
                rooms[currentFloor].push({ tiles: roomTiles, status: status, hasBed, hasDoor });
            }
        }
    }
    drawFloor();
    setupPathfinding(); // Update pathfinding grid
}

function setupPathfinding() {
    let grid = [];
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        let row = [];
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            row.push(hotelData[currentFloor][y][x] ? 1 : 0); // 0 is walkable, 1 is a wall/room
        }
        grid.push(row);
    }
    easystar.setGrid(grid);
    easystar.setAcceptableTiles([0]);
}

// =================================================================
//  DRAWING & UI (Mostly unchanged, but with updates for status)
// =================================================================

function drawFloor() {
    roomGraphics.clear();
    furnitureGroup.clear(true, true);

    const statusColors = {
        incomplete: 0xff0000, // Red
        available: 0x00ff00, // Green
        occupied: 0x0000ff, // Blue
        dirty: 0x8B4513 // Brown
    };

    rooms[currentFloor].forEach(room => {
        roomGraphics.fillStyle(statusColors[room.status], 0.5);
        room.tiles.forEach(tilePos => {
            roomGraphics.fillRect(tilePos.x * TILE_SIZE, tilePos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        });
    });

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tile = hotelData[currentFloor][y][x];
            if (tile && tile.furniture) {
                tile.furniture.forEach(item => {
                    furnitureGroup.create(item.x * TILE_SIZE + TILE_SIZE/2, item.y * TILE_SIZE + TILE_SIZE/2, item.type + '_img');
                });
            }
        }
    }
}

// ... (The rest of the UI and helper functions from Step 4 remain largely the same)
// ... (setupUI, createBuildButton, zoneRoom, placeFurniture, drawGrid, etc.)

function setupUI(scene) {
    moneyText = scene.add.text(10, 10, `Money: $${money}`, { fontSize: '20px', fill: '#ffff00' }).setScrollFactor(0);
    buildStatusText = scene.add.text(10, 40, 'Mode: Pan & View', { fontSize: '16px', fill: '#ffffff' }).setScrollFactor(0);
    scene.floorText = scene.add.text(10, 70, `Floor: ${currentFloor + 1}`, { fontSize: '20px', fill: '#ffffff' }).setScrollFactor(0);
    const floorUp = scene.add.text(120, 70, '▲', { fontSize: '20px', fill: '#00ff00', backgroundColor: '#333' }).setScrollFactor(0).setInteractive().setPadding(4);
    const floorDown = scene.add.text(150, 70, '▼', { fontSize: '20px', fill: '#ff0000', backgroundColor: '#333' }).setScrollFactor(0).setInteractive().setPadding(4);
    floorUp.on('pointerdown', () => { if (currentFloor < NUM_FLOORS - 1) { currentFloor++; scene.floorText.setText(`Floor: ${currentFloor + 1}`); findRooms(); }});
    floorDown.on('pointerdown', () => { if (currentFloor > 0) { currentFloor--; scene.floorText.setText(`Floor: ${currentFloor + 1}`); findRooms(); }});
    let yPos = 110;
    createBuildButton(scene, yPos, 'Pan & View', null, '#00ff00');
    createBuildButton(scene, yPos += 35, 'Build Room', 'standard_room', '#ffffff');
    createBuildButton(scene, yPos += 35, 'Place Door', 'place_door', '#ffffff');
    createBuildButton(scene, yPos += 35, 'Place Bed', 'place_bed', '#ffffff');
}

function createBuildButton(scene, y, text, mode, color) {
    const button = scene.add.text(10, y, text, { fontSize: '18px', fill: color, backgroundColor: '#555555', padding: { x: 5, y: 5 } })
        .setScrollFactor(0).setInteractive();
    button.on('pointerdown', () => { buildMode = mode; updateBuildStatusText(); });
}

function zoneRoom(start, end) {
    const roomCost = (Math.abs(start.x - end.x) + 1) * (Math.abs(start.y - end.y) + 1) * 100;
    if (money < roomCost) return;
    money -= roomCost; moneyText.setText(`Money: $${money}`);
    const startX = Math.min(start.x, end.x), startY = Math.min(start.y, end.y);
    const endX = Math.max(start.x, end.x), endY = Math.max(start.y, end.y);
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
    money -= cost; moneyText.setText(`Money: $${money}`);
    const furnitureType = buildMode.split('_')[1];
    tile.furniture.push({ type: furnitureType, x: tileX, y: tileY });
    findRooms();
}

function drawGrid(graphics) {
    graphics.clear();
    for (let i = 0; i < MAP_WIDTH_TILES + 1; i++) graphics.lineBetween(i * TILE_SIZE, 0, i * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    for (let j = 0; j < MAP_HEIGHT_TILES + 1; j++) graphics.lineBetween(0, j * TILE_SIZE, MAP_WIDTH_TILES * TILE_SIZE, j * TILE_SIZE);
}

function updateBuildStatusText() { buildStatusText.setText(`Mode: ${buildMode || 'Pan & View'}`); }
// NOTE: This is a simplified version of the full loop for clarity. Full staff/guest AI is complex.
