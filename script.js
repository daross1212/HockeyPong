// Hockey Pong game logic will go here

// --- Matter.js module aliases ---
const { Engine, Render, Runner, World, Bodies, Body, Events, Composite, Sleeping } = Matter;

// --- DOM Element References ---
const gameCanvas = document.getElementById('gameCanvas');
const startMenu = document.getElementById('startMenu');
const gameOverMenu = document.getElementById('gameOverMenu');
const mouseModeButton = document.getElementById('mouseModeButton');
const keyboardModeButton = document.getElementById('keyboardModeButton');
const returnToMenuButton = document.getElementById('returnToMenuButton');
const gameOverMessage = document.getElementById('gameOverMessage');
const playerScoreDisplay = document.getElementById('playerScoreDisplay'); 
const aiScoreDisplay = document.getElementById('aiScoreDisplay');     
const playerNameInput = document.getElementById('playerNameInput'); // Input field for player name
const streakDisplay = document.getElementById('streakDisplay'); // For win streak
const winLossDisplay = document.getElementById('winLossDisplay'); // For Wins/Losses
const scoreBoard = document.getElementById('scoreBoard'); // Get reference to the scoreboard
const spinGaugeContainerEl = document.getElementById('spinGaugeContainer');
const spinGaugeFillEl = document.getElementById('spinGaugeFill');
const spinGaugeTextEl = document.getElementById('spinGaugeText');

// --- Game Variables & Constants ---
const canvasWidth = 1120; // Game width (800 * 1.40)
const canvasHeight = 750; // Game height (600 * 1.25)
let controlMode = ''; // 'mouse' or 'keyboard'
let scorePlayer = 0;
let scoreAI = 0;
const maxScore = 10; // Score to win the game

// Goal Text Animation Variables
let isGoalTextAnimating = false;
let goalTextX = 0;
let goalTextY = 0;
const goalTextString = "GOAL!";
let goalTextFontSize = 0; // Will be set based on paddle size
const goalTextFontFamily = "'Press Start 2P', cursive";
const goalTextColor = "#FFFFFF";
const goalTextShadowColor = "#000000";
let goalTextSpeed = 0; // Will be calculated dynamically
let measuredGoalTextWidth = 0; // To store the measured width of the text

// Game Over State Variables
let isGameOver = false;
let gameOverMessageText = "";
let gameOverScoreText = "";

let allowAiRush = true; // For AI puck rushing logic

// Spin Move Variables
let isSpinMoveActive = false;
let spinMoveOrbitalAngle = 0; // Current angle of the puck in orbit
let spinMovePuck = null;      // Reference to the puck body during spin move
let SPIN_MOVE_ORBITAL_RADIUS; // Calculated: playerPaddleRadius + puckRadius + gap
let SPIN_MOVE_ACTIVATION_RADIUS; // Calculated: playerPaddleRadius + puckRadius + 20px
const SPIN_MOVE_ROTATION_SPEED = 0.1; // Radians per tick, adjust for desired speed

// Spin Move Charge Gauge Variables
let spinMoveCharge = 0;
const MAX_SPIN_MOVE_CHARGE = 15;
let isSpinMoveCharged = false;

// LocalStorage Keys for Stats
const LOCAL_STORAGE_KEY_WIN_STREAK = 'hockeyPongWinStreakV1'; // Added V1 for potential future structure changes
const LOCAL_STORAGE_KEY_TOTAL_WINS = 'hockeyPongTotalWinsV1';
const LOCAL_STORAGE_KEY_TOTAL_LOSSES = 'hockeyPongTotalLossesV1';
const LOCAL_STORAGE_KEY_PLAYER_NAME = 'hockeyPongPlayerNameV1'; // Key for player name

// Win Streak and Wins/Losses Tracking - Load from localStorage or default to 0
let playerWinStreak = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_WIN_STREAK)) || 0;
let totalPlayerWins = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_TOTAL_WINS)) || 0;
let totalPlayerLosses = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_TOTAL_LOSSES)) || 0;
let playerName = localStorage.getItem(LOCAL_STORAGE_KEY_PLAYER_NAME) || "Player"; // Load player name or default
const statsFontSizeMultiplier = 0.4; // Relative to playerPaddleRadiusConst for stats text // This might be deprecated or reused for HTML font size

// Initial UI updates after loading data
updateScoreDisplay();
updateScoreboardStats(); // Call to update new HTML stats elements on load

// "Play Again" Button State
const playAgainButtonText = "Play Again";
let playAgainButtonRect = { x: 0, y: 0, width: 0, height: 0 };
let isMouseOverPlayAgain = false;
const playAgainButtonDefaultColor = "#FFFFFF";
const playAgainButtonHoverColor = "#90EE90"; // Light Green
const playAgainButtonFontSizeMultiplier = 1.25; // Relative to playerPaddleRadiusConst
let gameOverMouseMoveHandler = null;
let gameOverMouseClickHandler = null;

// --- Restore Accidentally Deleted Constants and Variables ---
const MAX_TRAIL_POINTS = 15;
let puckTrailPoints = [];

let smackEffects = []; // Array to store active smack effects

// Game element constants
const wallThicknessConst = 45; // Increased from 30
const paddleActualWidthConst = 20; // No longer directly used for paddle width, but concept kept for AI initial pos if needed
const paddleActualHeightConst = 100;
const playerPaddleRadiusConst = paddleActualHeightConst / 2; // Radius for both player's and AI's circular paddle
const puckRadiusConst = 15;

// AI State and Movement Speeds
let aiState = 'IDLE_DEFENDING'; // Possible states: 'IDLE_DEFENDING', 'ATTACKING', 'RETREATING_AFTER_HIT', 'RUSHING_PUCK'
const aiPaddleYSpeed = 9;          // Speed for AI Y-axis tracking of the puck
const aiAttackSpeedX = 12;         // Speed for AI X-axis tracking when attacking
const aiRetreatSpeedX = 18;      // Speed for AI fast retreat
const aiRushSpeed = 27.5;          // Speed for AI when rushing the puck after respawn
const aiBaseX = canvasWidth - playerPaddleRadiusConst - 10; // AI's default X position
const aiMaxIdleSpeedX = 3; // Max speed for AI when returning to base in IDLE_DEFENDING
const aiProportionalFactor = 0.225; // General factor for proportional speed calculation

// Goal Sensor dimensions
let leftGoalSensor, rightGoalSensor; // Declare globally

// Control related
const playerPaddleMoveSpeed = 20; // Speed for mouse-controlled paddle
const keyboardPaddleMoveSpeed = 7; // Speed for keyboard-controlled paddle
let keys = {}; // Tracks pressed keys for keyboard control
let targetMouseX = playerPaddleRadiusConst + 10; // Initial X for player paddle center
let targetMouseY = canvasHeight / 2; // Target Y for mouse control, initialized to center
let documentMouseMoveHandler = null; // To store the mouse move handler function

// --- Puck Trail Color Logic ---
const colorStops = [
    { speed: 0, color: '#FFFFFF' },   // White
    { speed: 5, color: '#ADD8E6' },   // Light Pastel Blue
    { speed: 10, color: '#FFFFE0' },  // Light Pastel Yellow
    { speed: 15, color: '#E6E6FA' },  // Lavender (Pastel Purple)
    { speed: 20, color: '#FFB6C1' }   // Light Pink (Pastel Red)
];

// Helper function to interpolate between two hex colors
function lerpColor(hex1, hex2, factor) {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);

    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function getColorForSpeed(speed) {
    if (speed <= colorStops[0].speed) {
        return colorStops[0].color;
    }

    for (let i = 1; i < colorStops.length; i++) {
        if (speed <= colorStops[i].speed) {
            const lowerStop = colorStops[i-1];
            const upperStop = colorStops[i];
            // Calculate the factor for interpolation within this segment
            const factor = (speed - lowerStop.speed) / (upperStop.speed - lowerStop.speed);
            return lerpColor(lowerStop.color, upperStop.color, factor);
        }
    }

    // If speed is greater than the last defined stop, return the last color
    return colorStops[colorStops.length - 1].color;
}

// --- Global Game Objects (will be initialized in initializeGameElements) ---
let playerPaddle, aiPaddle, puck;

// --- Matter.js Engine Setup ---
const engine = Engine.create({
    gravity: {
        x: 0,
        y: 0 // No vertical gravity for air hockey style
    },
    positionIterations: 10, // Default is 6
    velocityIterations: 8,   // Default is 4
    timing: { timeScale: 0.8 } // Added to improve collision detection for fast bodies
});
const world = engine.world;

// Create a renderer
const render = Render.create({
    element: document.body, // Render to the body initially, will adjust to canvas later
    canvas: gameCanvas,
    engine: engine,
    options: {
        width: canvasWidth, // Use updated width
        height: canvasHeight, // Use updated height
        wireframes: false, // Show shapes with fill colors
        background: '#D2B48C' // Light tan background
    }
});

// Add event listener for drawing custom graphics after Matter.js renders
Events.on(render, 'afterRender', function() {
    const context = render.context;
    context.beginPath();
    context.moveTo(canvasWidth / 2, 0);
    context.lineTo(canvasWidth / 2, canvasHeight);
    context.strokeStyle = '#808080'; // Grey color for the line
    context.lineWidth = 2;
    context.setLineDash([10, 10]); // Dashed line pattern (10px line, 10px gap)
    context.stroke();
    context.setLineDash([]); // Reset line dash for other potential drawings

    // Puck Trail Drawing
    if (puckTrailPoints.length > 1) {
        const context = render.context; 
        const minTrailWidth = 2; 
        const maxTrailWidth = puckRadiusConst * 2;
        const numPoints = puckTrailPoints.length;

        for (let i = 0; i < numPoints - 1; i++) {
            const startPoint = puckTrailPoints[i];    // Current point in iteration (newer)
            const endPoint = puckTrailPoints[i+1];  // Next point in iteration (older)
            
            // Taper factor: 1.0 for segments starting at the newest point (i=0), approaches 0 for oldest segments
            let taperFactor = 1.0;
            if (numPoints -1 > 0) { // numPoints-1 is total number of segments
                 taperFactor = i / (numPoints - 1);
            }
            taperFactor = Math.max(0, Math.min(1, taperFactor)); // Clamp between 0 and 1

            const currentLineWidth = minTrailWidth + (maxTrailWidth - minTrailWidth) * taperFactor;
            
            context.beginPath();
            context.moveTo(startPoint.x, startPoint.y);
            // Use a simple lineTo for now to ensure connection, can re-evaluate curves if this works
            context.lineTo(endPoint.x, endPoint.y);
            
            context.strokeStyle = startPoint.color; 
            context.lineWidth = Math.max(1, currentLineWidth); 
            context.lineCap = 'round'; // Use round line caps to help fill gaps
            context.stroke();
        }
        context.lineCap = 'butt'; // Reset line cap style
        context.lineWidth = 1; // Reset line width for other drawings
    }

    // Draw borders for paddles
    context.lineWidth = 10; // Border width
    context.strokeStyle = '#000000'; // Black border color, change as needed

    if (playerPaddle) {
        context.beginPath();
        context.arc(playerPaddle.position.x, playerPaddle.position.y, playerPaddleRadiusConst, 0, Math.PI * 2);
        context.stroke();
    }

    if (aiPaddle) {
        context.beginPath();
        context.arc(aiPaddle.position.x, aiPaddle.position.y, playerPaddleRadiusConst, 0, Math.PI * 2);
        context.stroke();
    }

    // Draw GOAL! Text Animation OR Game Over Screen
    if (isGameOver) {
        // Draw grey tint
        context.fillStyle = 'rgba(100, 100, 100, 0.5)';
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw Game Over Message (e.g., "YOU WIN!")
        const mainMessageFontSize = playerPaddleRadiusConst * 2.25; // Reduced from 3
        context.font = `${mainMessageFontSize}px ${goalTextFontFamily}`;
        context.fillStyle = goalTextColor; 
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        context.shadowColor = goalTextShadowColor;
        context.shadowOffsetX = 3;
        context.shadowOffsetY = 3;
        context.shadowBlur = 5;
        context.fillText(gameOverMessageText, canvasWidth / 2, canvasHeight / 2 - mainMessageFontSize * 0.75);

        // Draw Final Score
        const scoreFontSize = playerPaddleRadiusConst * 1.5; 
        context.font = `${scoreFontSize}px ${goalTextFontFamily}`;
        context.fillText(gameOverScoreText, canvasWidth / 2, canvasHeight / 2 + mainMessageFontSize * 0.25);
        
        context.shadowColor = 'transparent'; // Reset shadow
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.shadowBlur = 0;

        // --- Draw "Play Again" Button ---
        const buttonFontSize = playerPaddleRadiusConst * playAgainButtonFontSizeMultiplier;
        context.font = `${buttonFontSize}px ${goalTextFontFamily}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const buttonTextMetrics = context.measureText(playAgainButtonText);
        playAgainButtonRect.width = buttonTextMetrics.width;
        playAgainButtonRect.height = buttonFontSize * 1.5; // A bit taller for easier clicking
        
        // Position button below the score text
        const scoreTextY = canvasHeight / 2 + mainMessageFontSize * 0.25; // Y-center of score text
        playAgainButtonRect.x = canvasWidth / 2 - playAgainButtonRect.width / 2;
        playAgainButtonRect.y = scoreTextY + scoreFontSize / 2 + 40; // 40px spacing below score text's baseline

        context.fillStyle = isMouseOverPlayAgain ? playAgainButtonHoverColor : playAgainButtonDefaultColor;
        // Apply shadow to button text too
        context.shadowColor = goalTextShadowColor;
        context.shadowOffsetX = 2; // Smaller shadow for button
        context.shadowOffsetY = 2;
        context.shadowBlur = 3;

        context.fillText(playAgainButtonText, canvasWidth / 2, playAgainButtonRect.y + playAgainButtonRect.height / 2);

        context.shadowColor = 'transparent'; // Reset shadow
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.shadowBlur = 0;

    } else if (isGoalTextAnimating) { // Make this an else-if to prevent overlap with game over
        // Apply grey tint to the screen
        context.fillStyle = 'rgba(100, 100, 100, 0.5)'; // Semi-transparent grey
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        // Update position (moved here from beforeUpdate as afterRender runs when timeScale=0)
        goalTextX += goalTextSpeed;

        context.font = `${goalTextFontSize}px ${goalTextFontFamily}`;
        context.fillStyle = goalTextColor;
        context.textAlign = 'left'; // Use 'left' for simpler X calculation
        context.textBaseline = 'middle';
        
        // Apply shadow for better visibility
        context.shadowColor = goalTextShadowColor;
        context.shadowOffsetX = 3;
        context.shadowOffsetY = 3;
        context.shadowBlur = 5;

        context.fillText(goalTextString, goalTextX, goalTextY);

        // Reset shadow for other drawings
        context.shadowColor = 'transparent';
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.shadowBlur = 0;

        // Check for animation end
        if (goalTextX > canvasWidth) { // Text's left edge has passed the right edge of canvas
            isGoalTextAnimating = false;
            if (!isGameOver) { // Only unfreeze if the game isn't over
                engine.timing.timeScale = 1; // Unfreeze game
            }
        }
    }

    // Draw Smack Effects
    for (let i = smackEffects.length - 1; i >= 0; i--) {
        const effect = smackEffects[i];
        effect.age++;

        if (effect.age > effect.maxAge) {
            smackEffects.splice(i, 1); // Remove old effect
            continue;
        }

        const progress = effect.age / effect.maxAge;
        const currentSize = effect.initialSize + (effect.maxSize - effect.initialSize) * progress;
        const opacityEffect = (1 - progress) * 0.6; // Start at 60% opacity and fade

        context.beginPath();
        context.arc(effect.x, effect.y, currentSize / 2, 0, Math.PI * 2);
        
        // Assuming effect.color is hex like '#FFD700'
        let r_eff = parseInt(effect.color.slice(1, 3), 16);
        let g_eff = parseInt(effect.color.slice(3, 5), 16);
        let b_eff = parseInt(effect.color.slice(5, 7), 16);
        context.fillStyle = `rgba(${r_eff}, ${g_eff}, ${b_eff}, ${opacityEffect})`;
        context.fill();
    }

    // Reset line width and stroke style (from original trail renderer, good practice)
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(0,0,0,1)'; 
    context.fillStyle = 'rgba(0,0,0,1)'; // Also reset fillStyle
});

// After the engine updates, record the puck's position for the trail
Events.on(engine, 'afterUpdate', function() {
    if (puck && puck.position && puck.velocity) {
        const speed = Math.sqrt(puck.velocity.x * puck.velocity.x + puck.velocity.y * puck.velocity.y);
        const trailColor = getColorForSpeed(speed);
        puckTrailPoints.push({ x: puck.position.x, y: puck.position.y, color: trailColor });
        if (puckTrailPoints.length > MAX_TRAIL_POINTS) {
            puckTrailPoints.shift(); // Remove the oldest point
        }
    }
});

// Create a runner
const runner = Runner.create();

// Function to check and reset puck if it goes out of bounds
function checkPuckOutOfBounds() {
    if (!puck || !puck.position) return;

    const buffer = puckRadiusConst * 3; // A buffer zone outside the canvas, can be adjusted
    let outOfBounds = false;

    if (puck.position.x < -buffer || puck.position.x > canvasWidth + buffer ||
        puck.position.y < -buffer || puck.position.y > canvasHeight + buffer) {
        outOfBounds = true;
    }

    if (outOfBounds) {
        console.log(`checkPuckOutOfBounds: Puck at (${puck.position.x.toFixed(1)}, ${puck.position.y.toFixed(1)}) is out of bounds. Calling resetPuck('bounds').`);
        resetPuck('bounds'); 
    }
}

// --- Game Initialization and Control --- 
function updateScoreDisplay() {
    if (playerScoreDisplay) {
        playerScoreDisplay.textContent = `${playerName.toUpperCase()}: ${scorePlayer}`;
    }
    if (aiScoreDisplay) {
        aiScoreDisplay.textContent = `AI: ${scoreAI}`;
    }
}

function updateScoreboardStats() {
    if (streakDisplay) {
        streakDisplay.textContent = `STREAK: ${playerWinStreak}`;
    }
    if (winLossDisplay) {
        winLossDisplay.textContent = `W: ${totalPlayerWins} L: ${totalPlayerLosses}`;
    }
}

function startGame(mode) {
    // Get player name from input field (assuming id="playerNameInput")
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput && nameInput.value.trim() !== "") {
        playerName = nameInput.value.trim();
        localStorage.setItem(LOCAL_STORAGE_KEY_PLAYER_NAME, playerName); // Save new name
    }
    updateScoreDisplay(); // Update score display with new name if changed
    updateScoreboardStats(); // Update HTML stats with new name if changed

    controlMode = mode;
    startMenu.style.display = 'none';
    gameOverMenu.style.display = 'none'; // Ensure game over menu is hidden
    gameCanvas.style.display = 'block';
    scoreBoard.style.display = 'flex'; // Show scoreboard
    spinGaugeContainerEl.style.display = 'flex'; // Show spin gauge
    updateSpinGaugeVisual(); // Initialize gauge visual

    // Update renderer and canvas dimensions for the new game
    render.canvas.width = canvasWidth;
    render.canvas.height = canvasHeight;
    render.options.width = canvasWidth;
    render.options.height = canvasHeight;

    // Clear previous world objects and engine state for a clean start
    Composite.clear(world, false); // Clears non-static bodies, keeps static ones if any were marked so
    Engine.clear(engine); // Clears the engine state

    // Reset scores
    scorePlayer = 0;
    scoreAI = 0;
    updateScoreDisplay(); // Initialize score display
    updateScoreboardStats(); // Update HTML stats on restart

    // Add game elements (paddles, puck, walls)
    initializeGameElements();

    setupControls(); // Setup controls based on the control mode

    // Start the renderer
    Render.run(render);
    // Start the engine runner
    Runner.run(runner, engine); // CRITICAL: This line must pass the 'engine' to the runner.
    Events.on(engine, 'beforeUpdate', function() {
        // Update AI Paddle
        updateAiPaddle();
        // Check for puck out of bounds
        checkPuckOutOfBounds();

        // Player paddle updates are handled by their own 'beforeUpdate' listeners
        // added in setupControls, so no need to call them directly here unless
        // that structure changes.
    });

    console.log(`Game started with ${controlMode} controls.`);
}

function stopGame() {
    Render.stop(render);
    Runner.stop(runner);
    Events.off(engine, 'beforeUpdate', updatePlayerPaddleMouse); 
    Events.off(engine, 'beforeUpdate', updatePlayerPaddleKeyboard);
    // Ensure we also remove the listener for the current updateAiPaddle, 
    // regardless of which version it is, to prevent errors if it's not defined
    // or to stop the AI if it is defined.
    if (typeof updateAiPaddle === 'function') {
        Events.off(engine, 'beforeUpdate', updateAiPaddle);
    }
    
    aiState = 'IDLE_DEFENDING'; // Reset AI state (consistent with other new AI parts)
    puckTrailPoints = []; // Clear trail points

    // Clear all bodies from the world
    World.clear(world, false); // false to keep a reference to the world

    // Reset scores
    scorePlayer = 0;
    scoreAI = 0;
    updateScoreDisplay(); // Update display to show 0-0
    updateScoreboardStats(); // Update HTML stats on restart

    // Show start menu, hide game canvas and game over menu
    startMenu.style.display = 'block';
    gameCanvas.style.display = 'none';
    gameOverMenu.style.display = 'none';
    scoreBoard.style.display = 'none'; // Hide scoreboard
    spinGaugeContainerEl.style.display = 'none'; // Hide spin gauge
    spinMoveCharge = 0; // Reset charge
    updateSpinGaugeVisual(); // Update gauge visual

    console.log("Game stopped, returned to menu.");
}

function showStartMenu() {
    startMenu.style.display = 'block';
    gameOverMenu.style.display = 'none';
    gameCanvas.style.display = 'none';
    scoreBoard.style.display = 'none'; // Hide scoreboard
    spinGaugeContainerEl.style.display = 'none'; // Hide spin gauge

    stopGame();

    scorePlayer = 0; // Reset scores when returning to menu
    scoreAI = 0;
    updateScoreDisplay(); // Update display to 0-0
    updateScoreboardStats(); // Update HTML stats on restart

    console.log("Returned to start menu.");
}

function initializeGameElements() {
    console.log("Initializing game elements...");

    // Clear existing bodies from the world if any (for restarts)
    World.clear(world, false); // Keep static bodies like walls if true, but we re-add all
    puckTrailPoints = []; // Clear trail points
    spinMoveCharge = 0; // Reset spin move charge
    updateSpinGaugeVisual(); // Update gauge visual

    // Initialize Spin Move Radii (dependent on paddle and puck radii)
    // These constants (playerPaddleRadiusConst, puckRadiusConst) are defined globally
    SPIN_MOVE_ORBITAL_RADIUS = playerPaddleRadiusConst + puckRadiusConst + 15; 
    SPIN_MOVE_ACTIVATION_RADIUS = playerPaddleRadiusConst + puckRadiusConst + 50;

    // Player Paddle (green, circular, on the left)
    playerPaddle = Bodies.circle(playerPaddleRadiusConst + 10, canvasHeight / 2, playerPaddleRadiusConst, {
        isStatic: false, // Make paddle dynamic
        label: 'playerPaddle',
        render: { fillStyle: '#4CAF50' },
        friction: 0.1, 
        restitution: 0.5, 
        density: 0.1, // Increased density to make it 'heavier'
        frictionAir: 0.05 // Add some air friction to prevent drifting
    });

    // AI Paddle (red, circular, on the right)
    aiPaddle = Bodies.circle(canvasWidth - playerPaddleRadiusConst - 10, canvasHeight / 2, playerPaddleRadiusConst, {
        isStatic: false, // Make paddle dynamic
        label: 'aiPaddle',
        render: { fillStyle: '#F44336' },
        friction: 0.1,
        restitution: 0.5,
        density: 0.1, // Increased density to make it 'heavier'
        frictionAir: 0.05 // Add some air friction to prevent drifting
    });

    // Puck
    puck = Bodies.circle(canvasWidth / 2, canvasHeight / 2, puckRadiusConst, {
        restitution: 1.0, // Capped at 1.0 for stability (was 2.0)
        friction: 0.00001,   
        frictionAir: 0.005, 
        density: 0.01,     
        label: 'puck',
        render: {
            fillStyle: '#FFFFFF', // White puck
            strokeStyle: 'black', // Border color
            lineWidth: 10          // Border width
        },
        isSensor: false, // Ensure it's not a sensor
        collisionFilter: {
            category: 0x0001, // Default category
            mask: 0xFFFFFFFF    // Collide with everything by default
        },
        slop: 0.01, // Slightly reduce slop for tighter collision, default is 0.05
        ccdEnabled: true // Enable Continuous Collision Detection
    });

    const wallOptions = {
        isStatic: true,
        restitution: 0.7,
        friction: 0,
        render: { fillStyle: '#607D8B' }
    };

    // Top and Bottom walls
    const topWall = Bodies.rectangle(canvasWidth / 2, wallThicknessConst / 2, canvasWidth, wallThicknessConst, { ...wallOptions, label: 'topWall' });
    const bottomWall = Bodies.rectangle(canvasWidth / 2, canvasHeight - wallThicknessConst / 2, canvasWidth, wallThicknessConst, { ...wallOptions, label: 'bottomWall' });

    const goalOpeningHeight = 150; // Height of the goal opening on the sides
    const goalPostLength = (canvasHeight - goalOpeningHeight) / 2;

    // Left Goal Area
    const leftGoalTopPost = Bodies.rectangle(wallThicknessConst / 2, goalPostLength / 2, wallThicknessConst, goalPostLength, { ...wallOptions, label: 'leftGoalWall' });
    const leftGoalBottomPost = Bodies.rectangle(wallThicknessConst / 2, canvasHeight - goalPostLength / 2, wallThicknessConst, goalPostLength, { ...wallOptions, label: 'leftGoalWall' });

    // Right Goal Area
    const rightGoalTopPost = Bodies.rectangle(canvasWidth - wallThicknessConst / 2, goalPostLength / 2, wallThicknessConst, goalPostLength, { ...wallOptions, label: 'rightGoalWall' });
    const rightGoalBottomPost = Bodies.rectangle(canvasWidth - wallThicknessConst / 2, canvasHeight - goalPostLength / 2, wallThicknessConst, goalPostLength, { ...wallOptions, label: 'rightGoalWall' });

    // Goal Sensors (for detecting goals) - Adjusted to fit inside nooks
    leftGoalSensor = Bodies.rectangle(
        wallThicknessConst / 2,    // X: Centered within the left nook
        canvasHeight / 2,          // Y: Centered vertically in the goal opening
        wallThicknessConst,        // Width: Full depth of the nook
        goalOpeningHeight,         // Height: The height of the goal opening
        {
            isSensor: true,
            isStatic: true,
            label: 'leftGoalSensor',
            render: { 
                strokeStyle: 'green', // Green outline for player's goal side
                lineWidth: 2,
                fillStyle: 'transparent' // Make the sensor fill transparent
            }
        }
    );

    rightGoalSensor = Bodies.rectangle(
        canvasWidth - wallThicknessConst / 2, // X: Centered within the right nook
        canvasHeight / 2,                     // Y: Centered
        wallThicknessConst,                   // Width: Full depth of the nook
        goalOpeningHeight,
        {
            isSensor: true,
            isStatic: true,
            label: 'rightGoalSensor',
            render: { 
                strokeStyle: 'red', // Red outline for AI's goal side
                lineWidth: 2,
                fillStyle: 'transparent'
            }
        }
    );

    World.add(world, [
        playerPaddle, aiPaddle, puck, 
        topWall, bottomWall, 
        leftGoalTopPost, leftGoalBottomPost, 
        rightGoalTopPost, rightGoalBottomPost,
        leftGoalSensor, rightGoalSensor // Add sensors to the world
    ]);

    aiState = 'RUSHING_PUCK'; // AI should rush the puck at the very start of the game

    const initialForceMagnitude = 0.005 * puck.mass;
    Body.applyForce(puck, puck.position, {
        x: (Math.random() > 0.5 ? 1 : -1) * initialForceMagnitude * 0.5,
        y: (Math.random() - 0.5) * initialForceMagnitude * 0.25
    });
}

function setupControls() {
    // Remove any existing listeners first to prevent duplicates
    if (documentMouseMoveHandler) {
        document.removeEventListener('mousemove', documentMouseMoveHandler);
        documentMouseMoveHandler = null;
    }
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    Events.off(engine, 'beforeUpdate', updatePlayerPaddleMouse); 
    Events.off(engine, 'beforeUpdate', updatePlayerPaddleKeyboard);

    if (controlMode === 'mouse') {
        documentMouseMoveHandler = function(event) {
            const rect = gameCanvas.getBoundingClientRect();
            targetMouseX = event.clientX - rect.left;
            targetMouseY = event.clientY - rect.top;
        };
        document.addEventListener('mousemove', documentMouseMoveHandler);
        Events.on(engine, 'beforeUpdate', updatePlayerPaddleMouse);
        console.log("Mouse controls enabled.");
    } else if (controlMode === 'keyboard') {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        Events.on(engine, 'beforeUpdate', updatePlayerPaddleKeyboard);
        console.log("Keyboard controls enabled.");
    }
}

function handleKeyDown(event) {
    keys[event.key] = true;
}

function handleKeyUp(event) {
    keys[event.key] = false;
}

function updatePlayerPaddleMouse() {
    if (!playerPaddle || controlMode !== 'mouse') return;

    let currentX = playerPaddle.position.x;
    let currentY = playerPaddle.position.y;
    let diffX = targetMouseX - currentX;
    let diffY = targetMouseY - currentY;
    let newX = currentX;
    let newY = currentY;

    // Move towards target X
    if (Math.abs(diffX) > 1) { // Only move if there's a significant difference
        if (Math.abs(diffX) > playerPaddleMoveSpeed) {
            newX += Math.sign(diffX) * playerPaddleMoveSpeed;
        } else {
            newX = targetMouseX; // Snap if close enough
        }
    }

    // Move towards target Y
    if (Math.abs(diffY) > 1) { // Only move if there's a significant difference
        if (Math.abs(diffY) > playerPaddleMoveSpeed) {
            newY += Math.sign(diffY) * playerPaddleMoveSpeed;
        } else {
            newY = targetMouseY; // Snap if close enough
        }
    }

    // Constrain paddle position X (left half of the table)
    const minX = playerPaddleRadiusConst; // Center cannot go past radius from left edge
    const maxX = (canvasWidth / 2) - playerPaddleRadiusConst; // Center cannot go past radius from center line
    newX = Math.max(minX, Math.min(newX, maxX));

    // Constrain paddle position Y
    const minY = wallThicknessConst + playerPaddleRadiusConst;
    const maxY = canvasHeight - wallThicknessConst - playerPaddleRadiusConst;
    newY = Math.max(minY, Math.min(newY, maxY));

    // Calculate velocity needed to reach newX, newY from current position
    // This is a simplified approach; for more precise control with setVelocity,
    // you might need to factor in the physics engine's update timestep.
    const targetVelX = (newX - currentX); // Effectively speed per frame
    const targetVelY = (newY - currentY);

    Body.setVelocity(playerPaddle, { x: targetVelX, y: targetVelY });
    // Body.setPosition(playerPaddle, { x: newX, y: newY }); // Old method
}

function updatePlayerPaddleKeyboard() {
    if (!playerPaddle || controlMode !== 'keyboard') return;

    let newY = playerPaddle.position.y;

    if (keys['ArrowUp']) {
        newY -= keyboardPaddleMoveSpeed;
    }
    if (keys['ArrowDown']) {
        newY += keyboardPaddleMoveSpeed;
    }

    // Constrain paddle position vertically
    const minY = wallThicknessConst + playerPaddleRadiusConst;
    const maxY = canvasHeight - wallThicknessConst - playerPaddleRadiusConst;
    newY = Math.max(minY, Math.min(newY, maxY));

    // For keyboard, we can set a more direct velocity if a key is pressed.
    // The X position is static for keyboard control in this setup.
    let targetVelY = 0;
    if (keys['ArrowUp']) {
        targetVelY = -keyboardPaddleMoveSpeed;
    }
    if (keys['ArrowDown']) {
        targetVelY = keyboardPaddleMoveSpeed;
    }
    // If no key is pressed, we want it to stop, so set velocity to 0 for Y.
    // We also need to ensure it doesn't drift due to past collisions.
    // Setting X velocity to 0 to prevent drift from puck collisions.
    Body.setVelocity(playerPaddle, { x: 0, y: targetVelY });

    // We still need to enforce the Y position boundary directly if velocity causes overshoot in one frame
    // or if it's pushed by the puck.
    if (playerPaddle.position.y < minY) Body.setPosition(playerPaddle, {x: playerPaddle.position.x, y: minY});
    if (playerPaddle.position.y > maxY) Body.setPosition(playerPaddle, {x: playerPaddle.position.x, y: maxY});
    // Body.setPosition(playerPaddle, { x: playerPaddle.position.x, y: newY }); // Old method
}

// --- AI Paddle Logic (New Strategy - Full Implementation) ---
function updateAiPaddle() {
    if (!aiPaddle || !puck || playerPaddleRadiusConst === undefined || !puck.position) return;
    console.log(`updateAiPaddle ENTRY: aiState=${aiState}, puck=(${puck.position.x.toFixed(1)}, ${puck.position.y.toFixed(1)}), ai=(${aiPaddle.position.x.toFixed(1)}, ${aiPaddle.position.y.toFixed(1)})`);

    const aiX = aiPaddle.position.x;
    const aiY = aiPaddle.position.y;
    const puckX = puck.position.x;
    const puckY = puck.position.y;
    const centerLine = canvasWidth / 2;

    // --- State Transitions (Non-collision based, excluding RUSHING_PUCK) ---
    // This logic runs first to ensure AI is in the correct state before movement decisions.
    if (aiState !== 'RUSHING_PUCK') {
        const puckOnAISide = puckX > centerLine; // Puck is considered on AI side if its center is past the center line

        if (aiState === 'IDLE_DEFENDING') {
            if (puckOnAISide && puckX < aiBaseX - playerPaddleRadiusConst) { // Puck on AI side and not behind AI base
                aiState = 'ATTACKING';
                console.log("AI State: IDLE_DEFENDING -> ATTACKING (puck on AI side)");
            }
        } else if (aiState === 'ATTACKING') {
            // If puck is past the AI paddle (e.g., AI missed or puck moved quickly)
            if (puckX > aiX + playerPaddleRadiusConst / 2 && puckX < aiBaseX + puckRadiusConst) { 
                aiState = 'RETREATING_AFTER_HIT'; // Treat as if AI needs to reset
                console.log("AI State: ATTACKING -> RETREATING_AFTER_HIT (puck got past AI paddle)");
            } else if (!puckOnAISide && puckX < centerLine - puckRadiusConst) { // Puck clearly back on player's side
                aiState = 'IDLE_DEFENDING'; 
                console.log("AI State: ATTACKING -> IDLE_DEFENDING (puck left AI side)");
            }
        } else if (aiState === 'RETREATING_AFTER_HIT') {
            if (aiX >= aiBaseX - 1) { // AI is at or very near its base
                aiState = 'IDLE_DEFENDING';
                console.log("AI State: RETREATING_AFTER_HIT -> IDLE_DEFENDING (AI reached base)");
                Body.setPosition(aiPaddle, { x: aiBaseX, y: aiY }); // Snap to base
                Body.setVelocity(aiPaddle, { x: 0, y: aiPaddle.velocity.y }); // Stop X movement
            }
        }
    }

    // --- Movement Logic based on current aiState ---
    const yThreshold = 3; 
    const xThreshold = 1; 
    let targetXVel = 0;
    let targetYVel = 0;

    if (aiState === 'RUSHING_PUCK') {
        if (allowAiRush) {
            const rushDiffX = puckX - aiX;
            const rushDiffY = puckY - aiY;
            const rushDistance = Math.sqrt(rushDiffX * rushDiffX + rushDiffY * rushDiffY);

            if (rushDistance > 1) { // Avoid division by zero or jitter when very close
                targetXVel = (rushDiffX / rushDistance) * aiRushSpeed;
                targetYVel = (rushDiffY / rushDistance) * aiRushSpeed;
            } else {
                // AI is very close, stop. Collision should handle the next state.
                targetXVel = 0;
                targetYVel = 0;
            }
            console.log(`RUSHING (ALLOWED): puck=(${puckX.toFixed(1)},${puckY.toFixed(1)}) ai=(${aiX.toFixed(1)},${aiY.toFixed(1)}) dist=${rushDistance.toFixed(1)}, targetVel=(${targetXVel.toFixed(1)},${targetYVel.toFixed(1)})`);
        } else {
            targetXVel = 0; // Waiting for rush delay
            targetYVel = 0;
            console.log(`RUSHING (DELAYED): AI waiting for rush timer.`);
        }
        Body.setVelocity(aiPaddle, { x: targetXVel, y: targetYVel });

    } else { // Logic for IDLE_DEFENDING, ATTACKING, RETREATING_AFTER_HIT
        // Y-axis: Always try to align with puck's Y (Proportional and Smoother)
        const diffY = puckY - aiY;
        if (Math.abs(diffY) > yThreshold) {
            targetYVel = diffY * aiProportionalFactor; // Proportional speed
            targetYVel = Math.max(-aiPaddleYSpeed, Math.min(aiPaddleYSpeed, targetYVel));
        } else {
            targetYVel = 0; // Within threshold, stop Y movement
        }

        // X-axis:
        if (aiState === 'IDLE_DEFENDING') {
            const diffXToBase = aiBaseX - aiX;
            if (Math.abs(diffXToBase) > xThreshold) { 
                targetXVel = diffXToBase * aiProportionalFactor; // Proportional speed towards base
                targetXVel = Math.max(-aiMaxIdleSpeedX, Math.min(aiMaxIdleSpeedX, targetXVel));
            } else {
                targetXVel = 0; // Very close to base
                if (aiX !== aiBaseX) { // Snap if not exactly at base and not moving
                    Body.setPosition(aiPaddle, {x: aiBaseX, y: aiY});
                    Body.setVelocity(aiPaddle, {x:0, y: aiPaddle.velocity.y}); 
                }
            }
        } else if (aiState === 'ATTACKING') {
            const desiredAiX = puckX - playerPaddleRadiusConst - 5; 
            const diffXToDesired = desiredAiX - aiX;
            const xAttackThreshold = 3; 

            if (Math.abs(diffXToDesired) > xAttackThreshold) {
                targetXVel = diffXToDesired * aiProportionalFactor * 1.5; 
                const currentMaxAttackSpeedX = (diffXToDesired < 0) ? aiAttackSpeedX : aiAttackSpeedX * 0.7;
                targetXVel = Math.max(-currentMaxAttackSpeedX, Math.min(currentMaxAttackSpeedX, targetXVel));
            } else {
                targetXVel = 0; 
            }
            
            const attackAggressionLimitX = centerLine + playerPaddleRadiusConst; 
            if (aiX + targetXVel < attackAggressionLimitX && targetXVel < 0) { 
                if (aiX >= attackAggressionLimitX) {
                     if (puckX < aiX && targetXVel < 0) targetXVel = 0; 
                } else {
                    // Consider if targetXVel needs adjustment if it would cross the limit
                }
            }
        } else if (aiState === 'RETREATING_AFTER_HIT') {
            if (aiX < aiBaseX - 1) { 
                targetXVel = aiRetreatSpeedX;
            } else {
                targetXVel = 0; 
                if (aiX !== aiBaseX) { 
                    Body.setPosition(aiPaddle, {x: aiBaseX, y: aiY});
                    Body.setVelocity(aiPaddle, {x:0, y: aiPaddle.velocity.y});
                }
            }
        }

        // --- Apply Global Speed Cap (for non-rushing states) ---
        const maxTotalSpeed = 30; 
        const currentSpeedSq = targetXVel * targetXVel + targetYVel * targetYVel;
        if (currentSpeedSq > maxTotalSpeed * maxTotalSpeed) {
            const currentSpeed = Math.sqrt(currentSpeedSq);
            targetXVel = (targetXVel / currentSpeed) * maxTotalSpeed;
            targetYVel = (targetYVel / currentSpeed) * maxTotalSpeed;
        }
    }
    
    Body.setVelocity(aiPaddle, { x: targetXVel, y: targetYVel });
}

// --- Game Loop for Spin Move ---
Events.on(engine, 'beforeUpdate', function(event) {
    // This event fires before the physics engine updates positions based on forces/velocity

    if (isSpinMoveActive && spinMovePuck && playerPaddle && playerPaddle.position && typeof SPIN_MOVE_ORBITAL_RADIUS !== 'undefined') {
        spinMoveOrbitalAngle += SPIN_MOVE_ROTATION_SPEED;
        // Normalize angle to keep it within 0 to 2*PI
        if (spinMoveOrbitalAngle > Math.PI * 2) {
            spinMoveOrbitalAngle -= Math.PI * 2;
        } else if (spinMoveOrbitalAngle < 0) {
            spinMoveOrbitalAngle += Math.PI * 2;
        }

        const newPuckX = playerPaddle.position.x + SPIN_MOVE_ORBITAL_RADIUS * Math.cos(spinMoveOrbitalAngle);
        const newPuckY = playerPaddle.position.y + SPIN_MOVE_ORBITAL_RADIUS * Math.sin(spinMoveOrbitalAngle);
        
        // Directly set puck's position and clear its velocity to ensure it follows the orbit
        Body.setPosition(spinMovePuck, { x: newPuckX, y: newPuckY });
        Body.setVelocity(spinMovePuck, { x: 0, y: 0 }); 
    }

    // updateAiPaddle(); // Consider if AI logic is better here or in afterUpdate
});

// --- Spin Move Logic --- 
// Placed here, assuming it's after other core game functions like resetPuck, updateScoreDisplay etc.

document.addEventListener('keydown', function(event) {
    if (event.code === 'Space') {
        event.preventDefault(); 
        // Ensure game is running, playerPaddle and puck exist, and critical constants are defined
        if (!isGameOver && !isGoalTextAnimating && playerPaddle && puck && controlMode !== '' && typeof playerPaddleRadiusConst !== 'undefined') { 
            if (isSpinMoveActive) {
                deactivateSpinMove();
            } else {
                tryActivateSpinMove();
            }
        }
    }
});

function tryActivateSpinMove() {
    if (!isSpinMoveCharged) {
        console.log("Spin move NOT charged!");
        return;
    }
    // Ensure all required objects and properties exist, and radii are calculated
    if (!playerPaddle || !puck || !playerPaddle.position || !puck.position || typeof SPIN_MOVE_ACTIVATION_RADIUS === 'undefined') {
        // console.log("Spin move prerequisites not met for activation check.");
        return;
    }

    const distance = Math.sqrt(
        Math.pow(playerPaddle.position.x - puck.position.x, 2) +
        Math.pow(playerPaddle.position.y - puck.position.y, 2)
    );

    if (distance <= SPIN_MOVE_ACTIVATION_RADIUS) {
        activateSpinMoveActual();
    } else {
        // console.log(`Puck not close enough for spin move. Dist: ${distance.toFixed(1)}, Req: ${SPIN_MOVE_ACTIVATION_RADIUS.toFixed(1)}`);
    }
}

function activateSpinMoveActual() {
    if (!puck || !playerPaddle || !playerPaddle.position) {
        // console.log("Spin move prerequisites not met for actual activation.");
        return;
    }
    isSpinMoveActive = true;
    spinMovePuck = puck; // Store the actual puck object

    // Calculate initial angle so puck doesn't "jump" to angle 0 when spin starts
    // This sets the puck to its current relative angle from the paddle center
    spinMoveOrbitalAngle = Math.atan2(
        spinMovePuck.position.y - playerPaddle.position.y,
        spinMovePuck.position.x - playerPaddle.position.x
    );

    Sleeping.set(spinMovePuck, true); // Temporarily disable Matter.js physics control for the puck
    console.log("Spin move ACTIVATED. Puck captured.");

    // Consume charge
    spinMoveCharge = 0;
    updateSpinGaugeVisual();
}

function deactivateSpinMove() {
    if (!spinMovePuck || !playerPaddle || !playerPaddle.velocity || typeof SPIN_MOVE_ORBITAL_RADIUS === 'undefined') {
        // console.log("Spin move prerequisites not met for deactivation.");
        return;
    }

    isSpinMoveActive = false;
    Sleeping.set(spinMovePuck, false); // Re-enable Matter.js physics for the puck

    // Calculate release velocity (tangential to orbit)
    // Tangential speed = angular speed * radius. Factor of 20 is for 'oomph'.
    const baseTangentialSpeed = SPIN_MOVE_ROTATION_SPEED * SPIN_MOVE_ORBITAL_RADIUS * 20; 

    // Velocity components based on the angle PERPENDICULAR to the orbital radius vector
    // For counter-clockwise orbit (angle increasing): tangent is (-sin(angle), cos(angle))
    let releaseVx = -baseTangentialSpeed * Math.sin(spinMoveOrbitalAngle);
    let releaseVy = baseTangentialSpeed * Math.cos(spinMoveOrbitalAngle);

    // Add a significant portion of the player paddle's current velocity for a more dynamic release
    releaseVx += playerPaddle.velocity.x * 0.8; 
    releaseVy += playerPaddle.velocity.y * 0.8;
    
    // Cap release velocity to prevent extreme speeds that might break the game
    const maxReleaseSpeed = 35; // Max speed for the released puck
    const currentReleaseSpeed = Math.sqrt(releaseVx * releaseVx + releaseVy * releaseVy);
    if (currentReleaseSpeed > maxReleaseSpeed) {
        const capFactor = maxReleaseSpeed / (currentReleaseSpeed || 1); // Avoid division by zero
        releaseVx *= capFactor;
        releaseVy *= capFactor;
    }

    Body.setVelocity(spinMovePuck, { x: releaseVx, y: releaseVy });

    // Nudge the puck slightly away from the paddle along the release vector
    // This helps prevent immediate re-collision or re-capture if space is pressed rapidly
    const nudgeDistance = 2.0; // Small distance to move the puck
    const normReleaseVx = releaseVx / (currentReleaseSpeed || 1); 
    const normReleaseVy = releaseVy / (currentReleaseSpeed || 1);
    
    // Ensure spinMovePuck.position is valid before trying to update it
    if (spinMovePuck.position) {
        Body.setPosition(spinMovePuck, {
            x: spinMovePuck.position.x + normReleaseVx * nudgeDistance,
            y: spinMovePuck.position.y + normReleaseVy * nudgeDistance
        });
    }
    
    console.log(`Spin move DEACTIVATED. Puck released with velocity: (${releaseVx.toFixed(2)}, ${releaseVy.toFixed(2)})`);
    spinMovePuck = null; // Clear the reference to the puck
}

// --- Goal Handling and Scoring ---
function handleGoalScored(scorer) {
    if (isGameOver) return; // Don't process new goals if game is already over

    if (scorer === 'Player') {
        scorePlayer++;
        console.log(`Player scored! Score: P-${scorePlayer} AI-${scoreAI}`);
        resetPuck('playerGoal'); 
    } else if (scorer === 'AI') {
        scoreAI++;
        console.log(`AI scored! Score: P-${scorePlayer} AI-${scoreAI}`);
        resetPuck('aiGoal');
    }

    // Trigger GOAL! text animation
    isGoalTextAnimating = true;
    goalTextFontSize = playerPaddleRadiusConst * 4; // Double the diameter of paddles
    goalTextY = canvasHeight / 2;

    // Measure text width to calculate speed and starting position accurately
    const tempContext = render.context; // Use the existing render context
    tempContext.font = `${goalTextFontSize}px ${goalTextFontFamily}`;
    measuredGoalTextWidth = tempContext.measureText(goalTextString).width;

    goalTextX = -measuredGoalTextWidth; // Start completely off-screen to the left

    const totalDistanceToTravel = canvasWidth + measuredGoalTextWidth;
    const animationDurationFrames = 60; // For 1 second at ~60fps
    goalTextSpeed = totalDistanceToTravel / animationDurationFrames;
    
    engine.timing.timeScale = 0; // Freeze game physics

    updateScoreDisplay(); // Update score display after a goal
    updateScoreboardStats(); // Update HTML stats after a goal

    // Check for Game Over condition
    if (scorePlayer >= maxScore || scoreAI >= maxScore) {
        isGameOver = true;
        engine.timing.timeScale = 0; // Freeze game physics
        isGoalTextAnimating = false; // Ensure GOAL! animation doesn't play

        if (scorePlayer >= maxScore) {
            gameOverMessageText = `${playerName.toUpperCase()} WINS!`; // Use playerName
            playerWinStreak++;
            totalPlayerWins++;
        } else {
            gameOverMessageText = "AI WINS!";
            playerWinStreak = 0;
            totalPlayerLosses++;
        }
        gameOverScoreText = `${scorePlayer} - ${scoreAI}`;
        
        saveGameDataToLocalStorage(); // Save stats after they are updated
        setupGameOverControls(); // Add listeners for the "Play Again" button
        
        // Note: We are no longer using the DOM-based gameOverScreen or stopping the engine/renderer here.
        // The game over state will be drawn on the canvas in afterRender.

    } else {
        // Trigger GOAL! text animation for non-game-ending goals
        isGoalTextAnimating = true;
        goalTextFontSize = playerPaddleRadiusConst * 4; // Double the diameter of paddles
        goalTextY = canvasHeight / 2;

        const tempContext = render.context;
        tempContext.font = `${goalTextFontSize}px ${goalTextFontFamily}`;
        measuredGoalTextWidth = tempContext.measureText(goalTextString).width;
        goalTextX = -measuredGoalTextWidth;

        const totalDistanceToTravel = canvasWidth + measuredGoalTextWidth;
        const animationDurationFrames = 60; 
        goalTextSpeed = totalDistanceToTravel / animationDurationFrames;
        
        engine.timing.timeScale = 0; // Freeze game physics for GOAL! animation
    }
}

// --- Collision Detection ---
Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // --- BEGIN NEW SMACK EFFECT LOGIC ---
        let isPuckCollisionForSmack = false;
        let otherBodyForSmack = null;
        let puckBodyForSmack = null;

        if (bodyA.label === 'puck') {
            isPuckCollisionForSmack = true;
            otherBodyForSmack = bodyB;
            puckBodyForSmack = bodyA;
        } else if (bodyB.label === 'puck') {
            isPuckCollisionForSmack = true;
            otherBodyForSmack = bodyA;
            puckBodyForSmack = bodyB;
        }

        if (isPuckCollisionForSmack && otherBodyForSmack && puckBodyForSmack) {
            // Create smack effect if puck hits a wall or a paddle
            // A wall is static, not a sensor, and not a goal sensor.
            const isWall = otherBodyForSmack.isStatic && 
                           !otherBodyForSmack.isSensor && 
                           otherBodyForSmack.label !== 'leftGoalSensor' && 
                           otherBodyForSmack.label !== 'rightGoalSensor';
            const isPaddle = otherBodyForSmack.label === 'playerPaddle' || otherBodyForSmack.label === 'aiPaddle';

            if (isWall || isPaddle) {
                let contactPoint = null;
                // Prefer collision support points if available for accuracy
                if (pair.collision && pair.collision.supports && pair.collision.supports.length > 0) {
                    contactPoint = { x: pair.collision.supports[0].x, y: pair.collision.supports[0].y };
                } else { // Fallback to puck's center
                    contactPoint = { x: puckBodyForSmack.position.x, y: puckBodyForSmack.position.y };
                }

                if (contactPoint) {
                    smackEffects.push({
                        x: contactPoint.x,
                        y: contactPoint.y,
                        age: 0,
                        maxAge: 20, // Effect duration in frames (e.g., 1/3 second at 60fps)
                        initialSize: puckRadiusConst * 0.75, // Start fairly small
                        maxSize: puckRadiusConst * 2.5,    // Grow to 2.5x puck size
                        color: '#FFFFFF' // Changed to White
                    });
                }
            }
        }
        // --- END NEW SMACK EFFECT LOGIC ---

        // Goal detection logic (existing)
        if ((bodyA === puck && bodyB === leftGoalSensor) || (bodyB === puck && bodyA === leftGoalSensor)) {
            handleGoalScored('AI');
        } else if ((bodyA === puck && bodyB === rightGoalSensor) || (bodyB === puck && bodyA === rightGoalSensor)) {
            handleGoalScored('Player');
        }

        // AI Paddle hits Puck detection (existing)
        if (((bodyA === aiPaddle && bodyB === puck) || (bodyB === aiPaddle && bodyA === puck))) {
            if (aiState === 'ATTACKING' || aiState === 'RUSHING_PUCK') {
                const previousState = aiState;
                aiState = 'RETREATING_AFTER_HIT';
                console.log(`AI State: ${previousState} -> RETREATING_AFTER_HIT (AI hit puck)`);
                
                // Optional: Apply a slight impulse to the puck away from AI to ensure it moves
                const forceMagnitude = 0.002 * puck.mass; // Adjust as needed
                let forceDirectionX = -1; // Force puck towards player side
                // If AI is very close to center, ensure puck is pushed away from AI's current X
                if (aiPaddle.position.x < canvasWidth / 2 + playerPaddleRadiusConst * 2) {
                    forceDirectionX = (puck.position.x > aiPaddle.position.x) ? 1 : -1;
                }
                Body.applyForce(puck, puck.position, { 
                    x: forceDirectionX * forceMagnitude, 
                    y: (Math.random() - 0.5) * forceMagnitude * 0.5 // Slight random Y to vary trajectory
                });
            }
        }

        // Puck Trail Update on collision with paddles
        if ((bodyA === puck && (bodyB === playerPaddle || bodyB === aiPaddle)) || 
            (bodyB === puck && (bodyA === playerPaddle || bodyA === aiPaddle))) {
            if (puckTrailPoints.length > 0) {
                // ... (trail update logic)
            }

            // Increment spin move charge
            if (spinMoveCharge < MAX_SPIN_MOVE_CHARGE) {
                spinMoveCharge++;
                updateSpinGaugeVisual();
                console.log(`Spin Charge: ${spinMoveCharge}/${MAX_SPIN_MOVE_CHARGE}`);
            }
        }
    }
});

// Add this new function to update the gauge's appearance
function updateSpinGaugeVisual() {
    if (!spinGaugeFillEl || !spinGaugeTextEl) return;

    const chargePercentage = (spinMoveCharge / MAX_SPIN_MOVE_CHARGE) * 100;
    spinGaugeFillEl.style.height = `${chargePercentage}%`;

    isSpinMoveCharged = (spinMoveCharge >= MAX_SPIN_MOVE_CHARGE);

    if (isSpinMoveCharged) {
        spinGaugeFillEl.style.backgroundColor = '#00FF00'; // Green - Ready
        spinGaugeTextEl.textContent = 'READY!';
    } else if (chargePercentage > 60) {
        spinGaugeFillEl.style.backgroundColor = '#FFFF00'; // Yellow - Almost ready
        spinGaugeTextEl.innerHTML = 'SPIN<br>(SPACE BAR)';
    } else {
        spinGaugeFillEl.style.backgroundColor = '#FF0000'; // Red - Charging
        spinGaugeTextEl.innerHTML = 'SPIN<br>(SPACE BAR)';
    }
    // For debugging or display, could update text with charge count
    // spinGaugeTextEl.textContent = `${spinMoveCharge}/${MAX_SPIN_MOVE_CHARGE}`;
}

// --- Event Listeners for Menus ---
mouseModeButton.addEventListener('click', () => startGame('mouse'));
keyboardModeButton.addEventListener('click', () => startGame('keyboard'));
returnToMenuButton.addEventListener('click', showStartMenu);

function restartGame() {
    isGameOver = false;
    isGoalTextAnimating = false;
    isMouseOverPlayAgain = false; // Reset hover state

    scorePlayer = 0;
    scoreAI = 0;
    updateScoreDisplay();
    updateScoreboardStats(); // Update HTML stats on restart

    aiState = 'IDLE_DEFENDING'; // Reset AI state
    
    if (puck) World.remove(world, puck); // Remove old puck if it exists
    resetPuck('restart');
    
    engine.timing.timeScale = 1; // Resume game physics
    removeGameOverControls(); // Remove listeners
}

function setupGameOverControls() {
    gameOverMouseMoveHandler = function(event) {
        if (!isGameOver) return;
        const rect = gameCanvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (mouseX >= playAgainButtonRect.x && mouseX <= playAgainButtonRect.x + playAgainButtonRect.width &&
            mouseY >= playAgainButtonRect.y && mouseY <= playAgainButtonRect.y + playAgainButtonRect.height) {
            isMouseOverPlayAgain = true;
            gameCanvas.style.cursor = 'pointer';
        } else {
            isMouseOverPlayAgain = false;
            gameCanvas.style.cursor = 'default';
        }
    };

    gameOverMouseClickHandler = function(event) {
        if (!isGameOver || !isMouseOverPlayAgain) return;
        const rect = gameCanvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (mouseX >= playAgainButtonRect.x && mouseX <= playAgainButtonRect.x + playAgainButtonRect.width &&
            mouseY >= playAgainButtonRect.y && mouseY <= playAgainButtonRect.y + playAgainButtonRect.height) {
            restartGame();
        }
    };

    gameCanvas.addEventListener('mousemove', gameOverMouseMoveHandler);
    gameCanvas.addEventListener('click', gameOverMouseClickHandler);
    gameCanvas.style.cursor = 'default'; // Initial cursor state
}

function removeGameOverControls() {
    if (gameOverMouseMoveHandler) {
        gameCanvas.removeEventListener('mousemove', gameOverMouseMoveHandler);
        gameOverMouseMoveHandler = null;
    }
    if (gameOverMouseClickHandler) {
        gameCanvas.removeEventListener('click', gameOverMouseClickHandler);
        gameOverMouseClickHandler = null;
    }
    gameCanvas.style.cursor = 'default'; // Reset cursor
}

// --- Game Over and Restart Logic (Simplified for now) ---
function resetPuck(reason) { 
    console.log(`resetPuck CALLED. Reason: ${reason}. Initial aiState: ${aiState}`); 

    if (puck) {
        console.log("resetPuck: Attempting to remove old puck."); 
        try {
            World.remove(world, puck);
            console.log("resetPuck: Old puck removed successfully."); 
        } catch (e) {
            console.error("resetPuck: Error removing old puck:", e);
        }
    } else {
        console.log("resetPuck: No old puck to remove (puck was null/undefined)."); 
    }

    console.log("resetPuck: Attempting to create new puck."); 
    try {
        puck = Bodies.circle(canvasWidth / 2, canvasHeight / 2, puckRadiusConst, {
            restitution: 0.95, 
            friction: 0.005,    
            frictionAir: 0.005, 
            density: 0.001,      
            label: 'puck',
            render: {
                fillStyle: '#FFFFFF', // White puck
                strokeStyle: 'black', // Border color
                lineWidth: 10          // Border width
            },
            collisionFilter: {
                category: 0x0004,
                mask: 0x0001 | 0x0002 | 0x0008 
            },
            sleepThreshold: -1 
        });
        console.log("resetPuck: New puck object created."); 
    } catch (e) {
        console.error("resetPuck: Error creating new puck object:", e);
        return; // Stop if puck creation fails
    }
    
    console.log("resetPuck: Attempting to add new puck to world."); 
    try {
        World.add(world, puck);
        console.log("resetPuck: New puck added to world successfully."); 
    } catch (e) {
        console.error("resetPuck: Error adding new puck to world:", e);
        return; // Stop if adding to world fails
    }

    console.log("resetPuck: Attempting to apply force to new puck."); 
    try {
        const initialForceMagnitude = 0.005 * (puck.mass || 0.1); // Guard against undefined/zero mass
        Body.applyForce(puck, puck.position, {
            x: (Math.random() > 0.5 ? 1 : -1) * initialForceMagnitude * 0.5,
            y: (Math.random() - 0.5) * initialForceMagnitude * 0.25
        });
        console.log("resetPuck: Force applied to new puck successfully."); 
    } catch (e) {
        console.error("resetPuck: Error applying force to puck:", e);
    }

    if (aiPaddle) {
        try {
            Sleeping.set(aiPaddle, false);
            console.log("resetPuck: AI paddle awakened."); 
        } catch (e) {
            console.error("resetPuck: Error awakening AI paddle:", e);
        }
    } else {
        console.log("resetPuck: aiPaddle not found, cannot awaken."); 
    }

    // Decide if AI will rush (1/3 chance on respawn)
    if (Math.random() < (1/3)) {
        aiState = 'RUSHING_PUCK';
        allowAiRush = false; // Prevent immediate rush
        console.log(`resetPuck: AI will RUSH (1/3 chance). aiState: ${aiState}. Scheduling rush enable in 0.25s.`);
        setTimeout(() => {
            allowAiRush = true;
            console.log("resetPuck (setTimeout): allowAiRush is now true after 0.25s delay for RUSH."); 
        }, 250); // 0.25-second delay
    } else {
        aiState = 'IDLE_DEFENDING';
        allowAiRush = true; // Not strictly necessary for IDLE, but ensures it can act if needed
        console.log(`resetPuck: AI will NOT rush (2/3 chance). aiState: ${aiState}.`);
    }

    puckTrailPoints = [];
    console.log("resetPuck: COMPLETED."); 
}

// --- LocalStorage Functions ---
function saveGameDataToLocalStorage() { // Renamed from saveStatsToLocalStorage
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_WIN_STREAK, playerWinStreak.toString());
        localStorage.setItem(LOCAL_STORAGE_KEY_TOTAL_WINS, totalPlayerWins.toString());
        localStorage.setItem(LOCAL_STORAGE_KEY_TOTAL_LOSSES, totalPlayerLosses.toString());
        localStorage.setItem(LOCAL_STORAGE_KEY_PLAYER_NAME, playerName); // Save player name
        console.log('Game data saved to localStorage.');
        updateScoreboardStats(); // Update HTML stats after saving new data
    } catch (e) {
        console.error('Failed to save game data to localStorage:', e);
    }
}

// No explicit load function needed here as stats are loaded directly during variable initialization.
// However, if we had more complex loading logic, a dedicated function would be good.
