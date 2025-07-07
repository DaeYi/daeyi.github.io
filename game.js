// This is the main configuration object for our game
const config = {
    type: Phaser.AUTO, // Phaser will decide whether to use WebGL or Canvas
    width: 800,       // Game width in pixels
    height: 600,      // Game height in pixels
    backgroundColor: '#1b1464', // A dark blue background color
    parent: 'game-container', // This is not strictly needed with our HTML but good practice
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Create a new game instance
const game = new Phaser.Game(config);

/**
 * The preload function is where we'll load our assets like images and sounds.
 * For now, it's empty.
 */
function preload() {
    // We will load assets here in the future
}

/**
 * The create function is called once, after preload, and is where we'll set up
 * our game's initial state and objects.
 */
function create() {
    console.log("Game is running!");
    // The background color is already set in the config, so this area is for game objects.
}

/**
 * The update function is a loop that runs every frame.
 * This is where we'll handle player input and dynamic game logic.
 */
function update() {
    // This loop will be the heart of our game's logic
}
