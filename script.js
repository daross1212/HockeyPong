document.addEventListener('DOMContentLoaded', function() {
    // Get the canvas element
    const canvas = document.getElementById('gameCanvas');

    // Get menu elements
    const startMenu = document.getElementById('startMenu');
    const mouseModeButton = document.getElementById('mouseModeButton');
    const keyboardModeButton = document.getElementById('keyboardModeButton');

    // Get Game Over Menu elements
    const gameOverMenu = document.getElementById('gameOverMenu');
    const gameOverMessageElement = document.getElementById('gameOverMessage'); // The <h2> for the message
    const returnToMenuButton = document.getElementById('returnToMenuButton');

    // Check if canvas exists
    if (!canvas) {
        console.error("FATAL: Canvas element with id 'gameCanvas' was not found. Game cannot start.");
        if (document.body) document.body.innerHTML = "<h1>Error: Game canvas not found. Please check index.html.</h1>";
        return; // Stop script execution if canvas isn't there
    }

    // Check if menu elements exist
    if (!startMenu || !mouseModeButton || !keyboardModeButton) {
        console.error("FATAL: Menu elements ('startMenu', 'mouseModeButton', 'keyboardModeButton') not found. Game cannot start.");
        if (document.body) document.body.innerHTML = "<h1>Error: Menu components missing. Game cannot load. Please check index.html.</h1>";
        if (canvas) canvas.style.display = 'none'; // Ensure canvas is hidden if menu is broken
        return;
    }

    // Check if Game Over Menu elements exist
    if (!gameOverMenu || !gameOverMessageElement || !returnToMenuButton) {
        console.error("FATAL: Game Over Menu elements ('gameOverMenu', 'gameOverMessageElement', 'returnToMenuButton') not found. Please check index.html.");
        // Potentially display an error or just log, as game can technically start without game over menu
        // but it's a critical part of the flow.
        if (document.body && !startMenu.style.display !== 'none') { // If start menu is still up, don't overwrite
             // Potentially show a less intrusive error or rely on console.
        }
        // For now, we'll let the game proceed but log the error.
    }

    const context = canvas.getContext('2d');
    // Check if context was obtained
    if (!context) {
        console.error("FATAL: Could not get 2D rendering context. Game cannot start.");
        if (document.body) document.body.innerHTML = "<h1>Error: Graphics context failed. Try a different browser or update.</h1>";
        if (canvas) canvas.style.display = 'none';
        return; // Stop if we can't get the context
    }

    // Game state variables
    let controlMode = null; // 'mouse' or 'keyboard'
    let gameStarted = false;
    let animationFrameId = null; // To store the requestAnimationFrame ID for cancellation

    // Game settings
    canvas.width = 800; // Reverted width
    canvas.height = 600; // Reverted height

    // Paddle properties
    const PADDLE_RADIUS = 33; // New: Radius for circular paddles (was 20, 20 * 1.67 = 33.4)
    const paddleSpeed = 8;

    // Ball speed settings
    const INITIAL_BALL_DX_MAGNITUDE = 3; // Initial horizontal speed magnitude
    const INITIAL_BALL_DY_MAGNITUDE_RANGE = [1, 3]; // Range for initial vertical speed magnitude

    // Ball speed increase factor
    const BALL_SPEED_INCREASE_FACTOR = 1.05; // Increase speed by 5%

    // Player Charge Gauge Specific Settings
    const PLAYER_CHARGE_GAUGE_X_CENTER_FACTOR = 0.25; // Player gauge on the LEFT
    const PLAYER_CHARGE_GAUGE_WIDTH_PERCENT = 0.4;

    // AI Charge Gauge Specific Settings
    const AI_CHARGE_GAUGE_X_CENTER_FACTOR = 0.75; // AI gauge on the RIGHT
    const AI_CHARGE_GAUGE_WIDTH_PERCENT = 0.4; // AI gauge is same size as player's

    // General Charge Gauge Settings
    const CHARGE_GAUGE_HEIGHT = 20;
    const CHARGE_GAUGE_Y_OFFSET = 10;
    const CHARGE_GAUGE_BORDER_COLOR = 'black';

    // Charged Shot settings
    const CHARGE_LEVELS_CONFIG = [
        { id: 0, name: 'none', duration: 0, multiplier: 1, color: 'grey' }, // Base, not a real charge tier
        { id: 1, name: 'blue', duration: 750, multiplier: 2, color: 'deepskyblue', trailRgb: { r: 0, g: 191, b: 255 } },
        { id: 2, name: 'yellow', duration: 1500, multiplier: 3, color: 'gold', trailRgb: { r: 255, g: 215, b: 0 } }, // 750ms (blue) + 750ms
        { id: 3, name: 'purple', duration: 2500, multiplier: 5, color: 'mediumpurple', trailRgb: { r: 147, g: 112, b: 219 } } // 1500ms (yellow) + 1000ms
    ];

    // Goal dimensions
    const GOAL_HEIGHT_FACTOR = 1/5; // Goal is 1/5th of canvas height
    let goalHeight; // Will be set in initializeGameDimensions or similar, after canvas is ready
    let goalYTop;
    let goalYBottom;

    // Ball slowdown mechanic constants
    const NO_HIT_SLOWDOWN_DELAY = 2000; // 2 seconds in milliseconds
    const SLOWDOWN_INTERVAL = 500;      // 0.5 seconds in milliseconds
    const SLOWDOWN_FACTOR = 0.90;       // Reduce speed to 90% (10% decrease)
    const MIN_BALL_SPEED_DX = 1.5;      // Minimum horizontal speed magnitude
    const MIN_BALL_SPEED_DY = 1.5;      // Minimum vertical speed magnitude

    // AI Horizontal Movement Constants
    const AI_DEFAULT_X = canvas.width - PADDLE_RADIUS - 30; // Default defensive X position
    const AI_MAX_ADVANCE_X = canvas.width - PADDLE_RADIUS - 150; // Furthest AI advances from its back wall
    const AI_HORIZONTAL_SPEED_MAGNITUDE = 3; // Speed for AI horizontal movement

    // Player paddle
    const player = {
        x: 50, // Initial X position (center of paddle)
        y: canvas.height / 2, // Initial Y position (center of paddle)
        radius: PADDLE_RADIUS,
        color: 'blue',
        dy: 0, // For keyboard vertical speed
        dx: 0  // For keyboard horizontal speed
    };

    // AI paddle
    const ai = {
        x: canvas.width - 50, // Initial X position (center of AI paddle)
        y: canvas.height / 2,  // Initial Y position (center of AI paddle)
        radius: PADDLE_RADIUS,
        color: 'red', 
        speed: paddleSpeed, // Note: This 'speed' is currently unused by AI's vertical movement logic
        dx: 0 // For horizontal movement
    };

    // Ball properties
    const ball = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        prevX: canvas.width / 2, // Initialize prevX
        prevY: canvas.height / 2, // Initialize prevY
        radius: 7,
        dx: 0, // Initial horizontal velocity, will be set by resetBall
        dy: 0, // Initial vertical velocity, will be set by resetBall
        color: 'white', // Changed to white
        trail: [], // Array to store past positions for the trail
        maxTrailLength: 30, // Max number of points in the trail (Changed from 15 to 30)
        activeTrailRgb: null, // e.g., { r: 0, g: 100, b: 255 } for blue
        trailColorActivationTime: 0, // Timestamp of activation
        trailColorDuration: 2000, // Milliseconds for the color to last
        defaultTrailRgb: { r: 255, g: 255, b: 255 }, // White
        lastPaddleHitTime: 0,
        lastSpeedDecreaseTime: 0
    };

    // Score
    let playerScore = 0;
    let aiScore = 0;
    const winningScore = 5; // Score to win the game

    // Charged Shot State Variables
    let isCharging = false;
    let chargeStartTime = 0;
    let currentTierAchieved = 0; // Index for CHARGE_LEVELS_CONFIG (0-3), highest tier fully completed during current charge
    let chargeHeldTier = 0;      // Index for CHARGE_LEVELS_CONFIG (0-3), tier "banked" when space is released

    // AI Charged Shot State Variables
    let aiIsCharging = false;
    let aiChargeStartTime = 0;
    let aiCurrentTierAchieved = 0;
    let aiChargeHeldTier = 0;

    // Event listeners for paddle movement
    document.addEventListener('keydown', function(event) {
        if (!gameStarted) return; // Don't process any keys if game hasn't started

        if (controlMode === 'keyboard') {
            if (event.key === 'ArrowUp') {
                player.dy = -paddleSpeed;
            } else if (event.key === 'ArrowDown') {
                player.dy = paddleSpeed;
            } else if (event.key === 'ArrowLeft') {
                player.dx = -paddleSpeed; 
            } else if (event.key === 'ArrowRight') {
                player.dx = paddleSpeed;
            }
        }

        // Spacebar for charging - works in both modes once game started
        if (event.key === ' ') {
            if (!isCharging) {
                isCharging = true;
                chargeStartTime = Date.now();
                currentTierAchieved = 0; // Reset for new charge
            }
        }
    });

    document.addEventListener('keyup', function(event) {
        if (!gameStarted) return;

        if (controlMode === 'keyboard') {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                player.dy = 0;
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { 
                player.dx = 0;
            }
        }
        // Spacebar release for charging - works in both modes
        if (event.key === ' ') {
            if (isCharging) {
                isCharging = false;
                chargeHeldTier = currentTierAchieved; // Bank the charge
            }
        }
    });

    // Mouse move listener for player paddle
    canvas.addEventListener('mousemove', function(event) {
        if (!gameStarted || controlMode !== 'mouse') return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;    // Relationship bitmap vs. element for X
        const scaleY = canvas.height / rect.height;  // Relationship bitmap vs. element for Y

        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
        
        // Center paddle Y to mouse, constrained by canvas boundaries
        player.y = mouseY;
        if (player.y - player.radius < 0) player.y = player.radius;
        if (player.y + player.radius > canvas.height) player.y = canvas.height - player.radius;

        // Center paddle X to mouse, constrained to player's side (left of center line)
        player.x = mouseX;
        if (player.x - player.radius < 0) player.x = player.radius; 
        if (player.x + player.radius > canvas.width / 2) { 
            player.x = canvas.width / 2 - player.radius;
        }
    });

    // Mouse click listeners for charging in trackpad/mouse mode
    canvas.addEventListener('mousedown', function(event) {
        // Check if in mouse/trackpad mode and left button is pressed (button === 0)
        if (controlMode === 'mouse' && event.button === 0) {
            if (!isCharging) { // Start charging only if not already charging
                isCharging = true;
                chargeStartTime = performance.now();
                currentTierAchieved = 0; // Reset tier when new charge begins
            }
        }
    });

    canvas.addEventListener('mouseup', function(event) {
        // Check if in mouse/trackpad mode and left button is released (button === 0)
        if (controlMode === 'mouse' && event.button === 0) {
            if (isCharging) { // Release charge only if currently charging
                isCharging = false;
                chargeHeldTier = currentTierAchieved;
                // currentTierAchieved is already set by updateChargeState, no need to reset here
                // It will be reset when a new charge starts or after the shot is made.
            }
        }
    });

    // Function to move the player paddle
    function movePlayerPaddle() {
        if (controlMode === 'keyboard') {
            player.y += player.dy;
            player.x += player.dx; // Add horizontal movement for keyboard

            // Boundary checks for keyboard mode (vertical)
            if (player.y - player.radius < 0) player.y = player.radius;
            if (player.y + player.radius > canvas.height) player.y = canvas.height - player.radius;

            // Boundary checks for keyboard mode (horizontal)
            if (player.x - player.radius < 0) player.x = player.radius; 
            if (player.x + player.radius > canvas.width / 2) { 
                player.x = canvas.width / 2 - player.radius;
            }
        } else if (controlMode === 'mouse') {
            // Mouse movement (X and Y) is handled directly by the 'mousemove' event listener
            // No additional updates needed here for mouse mode, but we ensure dx/dy from keyboard don't persist
            player.dx = 0;
            player.dy = 0;
        }
    }

    // Function to draw the player paddle
    function drawPlayerPaddle() {
        context.fillStyle = player.color;
        context.beginPath();
        context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'black'; 
        context.lineWidth = 2;        
        context.stroke();
    }

    // Function to draw the AI paddle
    function drawAIPaddle() {
        context.fillStyle = ai.color;
        context.beginPath();
        context.arc(ai.x, ai.y, ai.radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'black'; 
        context.lineWidth = 2;        
        context.stroke();
    }

    // Function to draw the ball
    function drawBall() {
        context.beginPath();
        context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        context.fillStyle = ball.color;
        context.fill();
        context.strokeStyle = 'black'; // Border color
        context.lineWidth = 4;       // Border width
        context.stroke();            // Draw the border
        context.closePath();
    }

    // Helper function to interpolate between two RGB colors
    function interpolateRgb(rgb1, rgb2, factor) {
        const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
        const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
        const b = Math.round(rgb1.b + (rgb1.b - rgb2.b) * factor);
        return { r, g, b };
    }

    // Function to draw the ball trail
    function drawBallTrail() {
        const currentTime = performance.now();
        let currentTrailBaseRgb = ball.defaultTrailRgb;

        if (ball.activeTrailRgb) {
            const elapsedTime = currentTime - ball.trailColorActivationTime;
            if (elapsedTime < ball.trailColorDuration) {
                const progress = elapsedTime / ball.trailColorDuration;
                currentTrailBaseRgb = interpolateRgb(ball.activeTrailRgb, ball.defaultTrailRgb, progress);
            } else {
                ball.activeTrailRgb = null; // Reset after duration
            }
        }

        context.lineCap = 'butt'; // Changed from 'round' to 'butt'
        context.lineJoin = 'round';

        for (let i = 0; i < ball.trail.length - 1; i++) {
            const p1 = ball.trail[i];     // Current point (newer)
            const p2 = ball.trail[i + 1]; // Next point in the trail (older)

            // Determine the age of the segment based on the older point (p2)
            const trailAge = (i + 1) / ball.maxTrailLength;

            // Calculate line width, tapering from ball's diameter down to 0
            // Using a taper factor of 0.6 for a noticeable taper.
            const lineWidth = ball.radius * 2 * (1 - trailAge * 0.6);
            if (lineWidth <= 0) continue; // Don't draw if line width is zero or less

            // Calculate opacity, fading out for older segments
            const segmentOpacity = 0.75 * (1 - trailAge);
            if (segmentOpacity <= 0) continue; // Don't draw if fully transparent

            context.beginPath();
            context.moveTo(p1.x, p1.y);
            context.lineTo(p2.x, p2.y);
            context.lineWidth = lineWidth;
            context.strokeStyle = `rgba(${currentTrailBaseRgb.r}, ${currentTrailBaseRgb.g}, ${currentTrailBaseRgb.b}, ${segmentOpacity})`;
            context.stroke();
        }
        // Reset lineCap and lineJoin if other parts of your drawing code expect defaults
        // context.lineCap = 'butt'; // Default
        // context.lineJoin = 'miter'; // Default 
    }

    // Function to draw the score
    function drawScore() {
        context.fillStyle = 'black';
        context.font = '35px Arial';
        context.fillText(playerScore, canvas.width / 4, 50);
        context.fillText(aiScore, (canvas.width / 4) * 3, 50);
    }

    // Function to draw the net (optional visual element)
    function drawNet() {
        context.beginPath();
        context.setLineDash([10, 10]); // Dashed line
        context.moveTo(canvas.width / 2, 0);
        context.lineTo(canvas.width / 2, canvas.height);
        context.strokeStyle = 'grey';
        context.stroke();
        context.closePath();
        context.setLineDash([]); // Reset line dash
    }

    // Helper function to draw a rounded rectangle path
    function drawRoundedRect(x, y, width, height, radius) {
        context.beginPath();
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        context.moveTo(x + radius, y);
        context.arcTo(x + width, y, x + width, y + height, radius);
        context.arcTo(x + width, y + height, x, y + height, radius);
        context.arcTo(x, y + height, x, y, radius);
        context.arcTo(x, y, x + width, y, radius);
        context.closePath();
    }

    // Function to update charge state
    function updateChargeState() {
        if (isCharging) {
            const elapsedTime = performance.now() - chargeStartTime; // Use performance.now()
            let newTier = 0;
            for (let i = CHARGE_LEVELS_CONFIG.length - 1; i >= 1; i--) {
                if (elapsedTime >= CHARGE_LEVELS_CONFIG[i].duration) {
                    newTier = i;
                    break;
                }
            }
            currentTierAchieved = newTier;
        } else {
            // When not charging, currentTierAchieved reflects the held charge for drawing purposes
            // This is implicitly handled by chargeHeldTier being the source of truth for non-charging states.
            // No specific action needed here as drawChargeGauge will use chargeHeldTier or currentTierAchieved based on isCharging.
        }
    }

    // Function to update AI charge state
    function updateAIChargeState() {
        const centerLineX = canvas.width / 2;
        if (ball.x < centerLineX) { // Ball on player's side
            if (!aiIsCharging) {
                aiIsCharging = true;
                aiChargeStartTime = Date.now();
                aiCurrentTierAchieved = 0; // Reset tier for new charge
            }
            const elapsedTime = Date.now() - aiChargeStartTime;
            let newTier = 0;
            for (let i = CHARGE_LEVELS_CONFIG.length - 1; i >= 1; i--) {
                if (elapsedTime >= CHARGE_LEVELS_CONFIG[i].duration) {
                    newTier = i;
                    break;
                }
            }
            aiCurrentTierAchieved = newTier;
        } else { // Ball on AI's side
            if (aiIsCharging) {
                aiIsCharging = false;
                aiChargeHeldTier = aiCurrentTierAchieved; // Bank the charge
            }
        }
    }

    // Function to draw the charge gauge
    function drawChargeGauge() {
        const gaugeWidth = canvas.width * PLAYER_CHARGE_GAUGE_WIDTH_PERCENT; 
        const gaugeX = (canvas.width * PLAYER_CHARGE_GAUGE_X_CENTER_FACTOR) - (gaugeWidth / 2);
        const gaugeY = canvas.height - CHARGE_GAUGE_HEIGHT - CHARGE_GAUGE_Y_OFFSET;
        const maxPossibleChargeTime = CHARGE_LEVELS_CONFIG[CHARGE_LEVELS_CONFIG.length - 1].duration;
        const cornerRadius = 8;
        const borderWidth = 8; // Changed from 5 to 8

        let displayColor = CHARGE_LEVELS_CONFIG[0].color; // Default to 'none' (no charge) color
        let fillPercentage = 0;
        let actualTierForColor = 0; // Tier to use for display color if charging

        if (isCharging) {
            const elapsedTime = performance.now() - chargeStartTime; // Use performance.now()
            if (currentTierAchieved < CHARGE_LEVELS_CONFIG.length - 1) {
                actualTierForColor = currentTierAchieved + 1; 
            } else {
                actualTierForColor = currentTierAchieved;
            }
            displayColor = CHARGE_LEVELS_CONFIG[actualTierForColor].color;
            fillPercentage = Math.min(1, elapsedTime / maxPossibleChargeTime);
        } else if (chargeHeldTier > 0) { // Not charging, but a charge is held
            actualTierForColor = chargeHeldTier;
            displayColor = CHARGE_LEVELS_CONFIG[chargeHeldTier].color;
            fillPercentage = CHARGE_LEVELS_CONFIG[chargeHeldTier].duration / maxPossibleChargeTime;
        } else { // Not charging and no charge held
             // displayColor and fillPercentage already set to default 'none'
        }

        // Draw gauge background and border
        drawRoundedRect(gaugeX, gaugeY, gaugeWidth, CHARGE_GAUGE_HEIGHT, cornerRadius);
        context.fillStyle = '#E0E0E0'; // Light grey background
        context.fill();
        context.strokeStyle = CHARGE_GAUGE_BORDER_COLOR;
        context.lineWidth = borderWidth;
        context.stroke();

        // Draw filled portion of the gauge
        const currentFillWidth = gaugeWidth * fillPercentage;
        if (currentFillWidth > 0) {
            context.save();
            drawRoundedRect(gaugeX, gaugeY, gaugeWidth, CHARGE_GAUGE_HEIGHT, cornerRadius);
            context.clip();
            
            context.fillStyle = displayColor;
            context.fillRect(gaugeX, gaugeY, currentFillWidth, CHARGE_GAUGE_HEIGHT);
            
            context.restore();
        }
        context.lineWidth = 1; // Reset line width
    }

    // Function to draw the AI's charge gauge
    function drawAIChargeGauge() {
        const gaugeWidth = canvas.width * AI_CHARGE_GAUGE_WIDTH_PERCENT; 
        const gaugeX = (canvas.width * AI_CHARGE_GAUGE_X_CENTER_FACTOR) - (gaugeWidth / 2);
        const gaugeY = canvas.height - CHARGE_GAUGE_HEIGHT - CHARGE_GAUGE_Y_OFFSET; 
        const maxPossibleChargeTime = CHARGE_LEVELS_CONFIG[CHARGE_LEVELS_CONFIG.length - 1].duration;
        const cornerRadius = 8;
        const borderWidth = 8; // Changed from 5 to 8

        let displayColor = CHARGE_LEVELS_CONFIG[0].color;
        let fillPercentage = 0;

        if (aiIsCharging) {
            const elapsedTime = performance.now() - aiChargeStartTime; // CORRECTED to performance.now()
            if (aiCurrentTierAchieved < CHARGE_LEVELS_CONFIG.length - 1) {
                displayColor = CHARGE_LEVELS_CONFIG[aiCurrentTierAchieved + 1].color;
            } else {
                displayColor = CHARGE_LEVELS_CONFIG[aiCurrentTierAchieved].color;
            }
            fillPercentage = Math.min(1, elapsedTime / maxPossibleChargeTime);
        } else if (aiChargeHeldTier > 0) {
            displayColor = CHARGE_LEVELS_CONFIG[aiChargeHeldTier].color;
            fillPercentage = CHARGE_LEVELS_CONFIG[aiChargeHeldTier].duration / maxPossibleChargeTime;
        }

        // Draw gauge background and border
        drawRoundedRect(gaugeX, gaugeY, gaugeWidth, CHARGE_GAUGE_HEIGHT, cornerRadius);
        context.fillStyle = '#E0E0E0'; // Light grey background
        context.fill();
        context.strokeStyle = CHARGE_GAUGE_BORDER_COLOR;
        context.lineWidth = borderWidth;
        context.stroke();

        // Draw filled portion of the gauge
        const currentFillWidth = gaugeWidth * fillPercentage;
        if (currentFillWidth > 0) {
            context.save();
            drawRoundedRect(gaugeX, gaugeY, gaugeWidth, CHARGE_GAUGE_HEIGHT, cornerRadius);
            context.clip();
            
            context.fillStyle = displayColor;
            context.fillRect(gaugeX, gaugeY, currentFillWidth, CHARGE_GAUGE_HEIGHT);
            
            context.restore();
        }
        context.lineWidth = 1; // Reset line width
    }

    // Function to draw the goals
    function drawGoals() {
        const goalPostPathWidth = 8;    // Width of the path for the goal post shape
        const goalPostBorderWidth = 3;  // LineWidth for the border
        const goalPostCornerRadius = 5; // Radius for the rounded corners
        const goalPostBorderColor = 'rgb(50, 50, 50)'; // Dark grey border

        // AI's Goal (left side) - Blue
        const aiGoalX = 0; 
        const aiGoalY = goalYTop;
        const aiGoalWidth = goalPostPathWidth;
        const aiGoalHeight = goalHeight;

        context.fillStyle = 'rgb(0, 0, 255)'; // Opaque Blue for AI
        context.strokeStyle = goalPostBorderColor;
        context.lineWidth = goalPostBorderWidth;

        context.beginPath();
        context.moveTo(aiGoalX + goalPostCornerRadius, aiGoalY);
        context.lineTo(aiGoalX + aiGoalWidth - goalPostCornerRadius, aiGoalY);
        context.arcTo(aiGoalX + aiGoalWidth, aiGoalY, aiGoalX + aiGoalWidth, aiGoalY + goalPostCornerRadius, goalPostCornerRadius);
        context.lineTo(aiGoalX + aiGoalWidth, aiGoalY + aiGoalHeight - goalPostCornerRadius);
        context.arcTo(aiGoalX + aiGoalWidth, aiGoalY + aiGoalHeight, aiGoalX + aiGoalWidth - goalPostCornerRadius, aiGoalY + aiGoalHeight, goalPostCornerRadius);
        context.lineTo(aiGoalX + goalPostCornerRadius, aiGoalY + aiGoalHeight);
        context.arcTo(aiGoalX, aiGoalY + aiGoalHeight, aiGoalX, aiGoalY + aiGoalHeight - goalPostCornerRadius, goalPostCornerRadius);
        context.lineTo(aiGoalX, aiGoalY + goalPostCornerRadius);
        context.arcTo(aiGoalX, aiGoalY, aiGoalX + goalPostCornerRadius, aiGoalY, goalPostCornerRadius);
        context.closePath();
        context.fill();
        context.stroke();

        // Player's Goal (right side) - Red
        const playerGoalX = canvas.width - goalPostPathWidth; 
        const playerGoalY = goalYTop;
        const playerGoalWidth = goalPostPathWidth;
        const playerGoalHeight = goalHeight;

        context.fillStyle = 'rgb(255, 0, 0)'; // Opaque Red for Player
        // strokeStyle and lineWidth are already set from AI's goal

        context.beginPath();
        context.moveTo(playerGoalX + goalPostCornerRadius, playerGoalY);
        context.lineTo(playerGoalX + playerGoalWidth - goalPostCornerRadius, playerGoalY);
        context.arcTo(playerGoalX + playerGoalWidth, playerGoalY, playerGoalX + playerGoalWidth, playerGoalY + goalPostCornerRadius, goalPostCornerRadius);
        context.lineTo(playerGoalX + playerGoalWidth, playerGoalY + playerGoalHeight - goalPostCornerRadius);
        context.arcTo(playerGoalX + playerGoalWidth, playerGoalY + playerGoalHeight, playerGoalX + playerGoalWidth - goalPostCornerRadius, playerGoalY + playerGoalHeight, goalPostCornerRadius);
        context.lineTo(playerGoalX + goalPostCornerRadius, playerGoalY + playerGoalHeight);
        context.arcTo(playerGoalX, playerGoalY + playerGoalHeight, playerGoalX, playerGoalY + playerGoalHeight - goalPostCornerRadius, goalPostCornerRadius);
        context.lineTo(playerGoalX, playerGoalY + goalPostCornerRadius);
        context.arcTo(playerGoalX, playerGoalY, playerGoalX + goalPostCornerRadius, playerGoalY, goalPostCornerRadius);
        context.closePath();
        context.fill();
        context.stroke();

        // Optional: Draw lines for the entire back wall segments that are NOT goals
        // These lines will now be drawn along the inner edge of the new, wider posts.
        context.strokeStyle = 'rgba(200, 200, 200, 0.5)'; // Light grey for non-goal wall parts
        context.lineWidth = 2; // Reset lineWidth for these decorative lines

        const nonGoalLineOffsetX = goalPostPathWidth; // Offset from canvas edge to draw these lines

        // Left wall (non-goal parts)
        context.beginPath();
        context.moveTo(nonGoalLineOffsetX, 0);
        context.lineTo(nonGoalLineOffsetX, goalYTop);
        context.moveTo(nonGoalLineOffsetX, goalYBottom);
        context.lineTo(nonGoalLineOffsetX, canvas.height);
        context.stroke();

        // Right wall (non-goal parts)
        context.beginPath();
        context.moveTo(canvas.width - nonGoalLineOffsetX, 0);
        context.lineTo(canvas.width - nonGoalLineOffsetX, goalYTop);
        context.moveTo(canvas.width - nonGoalLineOffsetX, goalYBottom);
        context.lineTo(canvas.width - nonGoalLineOffsetX, canvas.height);
        context.stroke();
    }

    // Function to move the ball
    function moveBall() {
        const currentTime = performance.now();

        // Ball collision with top and bottom walls
        if (ball.y - ball.radius < 0) { // Hits top wall
            ball.y = ball.radius; // Reposition flush with top wall
            ball.dy *= -1;        // Reverse vertical direction
        } else if (ball.y + ball.radius > canvas.height) { // Hits bottom wall
            ball.y = canvas.height - ball.radius; // Reposition flush with bottom wall
            ball.dy *= -1;                       // Reverse vertical direction
        }

        // --- Player Paddle Collision --- 
        let dxPaddle = player.x - ball.x;
        let dyPaddle = player.y - ball.y;
        let distancePaddleSq = dxPaddle * dxPaddle + dyPaddle * dyPaddle;
        let sumRadiiPaddle = player.radius + ball.radius;

        if (distancePaddleSq <= sumRadiiPaddle * sumRadiiPaddle) {
            // Collision detected
            const distance = Math.sqrt(distancePaddleSq) || 1; // Avoid division by zero if centers overlap
            const normalX = dxPaddle / distance; // Normal from ball to paddle center
            const normalY = dyPaddle / distance;

            // Calculate reflection (ball's velocity dot normal)
            const dotProduct = ball.dx * (-normalX) + ball.dy * (-normalY); // Use normal from paddle to ball for reflection
            
            let newDx = ball.dx - 2 * dotProduct * (-normalX);
            let newDy = ball.dy - 2 * dotProduct * (-normalY);

            ball.dx = newDx;
            ball.dy = newDy;

            // Apply charge shot / speed increase
            if (chargeHeldTier > 0) {
                const levelConfig = CHARGE_LEVELS_CONFIG[chargeHeldTier];
                ball.dx *= levelConfig.multiplier;
                ball.dy *= levelConfig.multiplier;
                if (levelConfig.trailRgb) {
                    ball.activeTrailRgb = { ...levelConfig.trailRgb };
                    ball.trailColorActivationTime = currentTime;
                }
                chargeHeldTier = 0;
                currentTierAchieved = 0;
                isCharging = false;
            } else {
                ball.dx *= BALL_SPEED_INCREASE_FACTOR;
                ball.dy *= BALL_SPEED_INCREASE_FACTOR;
            }

            // Reposition ball to be just outside the paddle along the collision normal (from paddle to ball)
            // The normal for repositioning should be from paddle center towards ball center.
            const repositionNormalX = -normalX; // From paddle to ball
            const repositionNormalY = -normalY; // From paddle to ball
            ball.x = player.x + repositionNormalX * (sumRadiiPaddle + 0.5); // Increased offset from 0.1 to 0.5
            ball.y = player.y + repositionNormalY * (sumRadiiPaddle + 0.5);

            ball.lastPaddleHitTime = currentTime;
            ball.lastSpeedDecreaseTime = currentTime;
        }

        // --- AI Paddle Collision --- 
        let dxAi = ai.x - ball.x;
        let dyAi = ai.y - ball.y;
        let distanceAiSq = dxAi * dxAi + dyAi * dyAi;
        let sumRadiiAi = ai.radius + ball.radius;

        if (distanceAiSq <= sumRadiiAi * sumRadiiAi) {
            // Collision detected
            const distance = Math.sqrt(distanceAiSq) || 1;
            const normalX = dxAi / distance; // Normal from ball to AI paddle center
            const normalY = dyAi / distance;

            const dotProduct = ball.dx * (-normalX) + ball.dy * (-normalY); // Use normal from AI paddle to ball

            let newDx = ball.dx - 2 * dotProduct * (-normalX);
            let newDy = ball.dy - 2 * dotProduct * (-normalY);

            ball.dx = newDx;
            ball.dy = newDy;

            if (aiChargeHeldTier > 0) {
                const levelConfig = CHARGE_LEVELS_CONFIG[aiChargeHeldTier];
                ball.dx *= levelConfig.multiplier;
                ball.dy *= levelConfig.multiplier;
                if (levelConfig.trailRgb) {
                    ball.activeTrailRgb = { ...levelConfig.trailRgb };
                    ball.trailColorActivationTime = currentTime;
                }
                aiChargeHeldTier = 0;
                aiCurrentTierAchieved = 0;
            } else {
                ball.dx *= BALL_SPEED_INCREASE_FACTOR;
                ball.dy *= BALL_SPEED_INCREASE_FACTOR;
            }

            // Reposition ball (normal from AI paddle to ball)
            const repositionNormalX = -normalX;
            const repositionNormalY = -normalY;
            ball.x = ai.x + repositionNormalX * (sumRadiiAi + 0.5); // Increased offset from 0.1 to 0.5
            ball.y = ai.y + repositionNormalY * (sumRadiiAi + 0.5);

            ball.lastPaddleHitTime = currentTime;
            ball.lastSpeedDecreaseTime = currentTime;
        }

        // Ball slowdown logic (if not hit by a paddle for a while)
        if (currentTime - ball.lastPaddleHitTime > NO_HIT_SLOWDOWN_DELAY) {
            if (currentTime - ball.lastSpeedDecreaseTime > SLOWDOWN_INTERVAL) {
                const currentSpeedMagnitude = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                // Only slow down if speed is above minimums (approximately)
                if (Math.abs(ball.dx) > MIN_BALL_SPEED_DX || Math.abs(ball.dy) > MIN_BALL_SPEED_DY) {
                    ball.dx *= SLOWDOWN_FACTOR;
                    ball.dy *= SLOWDOWN_FACTOR;

                    // Ensure minimum speed is maintained (preserving direction)
                    if (Math.abs(ball.dx) < MIN_BALL_SPEED_DX) {
                        ball.dx = MIN_BALL_SPEED_DX * Math.sign(ball.dx);
                    }
                    if (Math.abs(ball.dy) < MIN_BALL_SPEED_DY) {
                        ball.dy = MIN_BALL_SPEED_DY * Math.sign(ball.dy);
                    }
                }
                ball.lastSpeedDecreaseTime = currentTime;
            }
        }

        // Scoring logic with Goals
        if (ball.x - ball.radius < 0) { // Ball reaches player's side (AI's goal area)
            if (ball.y > goalYTop && ball.y < goalYBottom) { // Check if ball is within goal height
                aiScore++;
                resetBall(true); // AI scored, ball goes to player
            } else { // Ball hit wall outside goal
                ball.x = ball.radius; // Reposition flush with left wall
                ball.dx *= -1;        // Bounce back
            }
        } else if (ball.x + ball.radius > canvas.width) { // Ball reaches AI's side (Player's goal area)
            if (ball.y > goalYTop && ball.y < goalYBottom) { // Check if ball is within goal height
                playerScore++;
                resetBall(false); // Player scored, ball goes to AI
            } else { // Ball hit wall outside goal
                ball.x = canvas.width - ball.radius; // Reposition flush with right wall
                ball.dx *= -1;                       // Bounce back
            }
        }

        // Move the ball
        ball.x += ball.dx;
        ball.y += ball.dy;
    }

    // Function to reset the ball
    function resetBall(aiScoredLast) {
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        ball.prevX = ball.x;
        ball.prevY = ball.y;
        ball.activeTrailRgb = null;
        ball.dx = aiScoredLast ? INITIAL_BALL_DX_MAGNITUDE : -INITIAL_BALL_DX_MAGNITUDE;
        ball.dy = (Math.random() > 0.5 ? 1 : -1) *
                  (Math.random() * (INITIAL_BALL_DY_MAGNITUDE_RANGE[1] - INITIAL_BALL_DY_MAGNITUDE_RANGE[0]) + INITIAL_BALL_DY_MAGNITUDE_RANGE[0]);
        
        // Initialize slowdown timers
        const currentTime = performance.now();
        ball.lastPaddleHitTime = currentTime;
        ball.lastSpeedDecreaseTime = currentTime;
    }

    // Function to check for game over
    function gameOver(message) {
        // Stop the game immediately
        gameStarted = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // Hide canvas, show game over menu
        if (canvas) canvas.style.display = 'none';
        if (gameOverMenu) {
            if (gameOverMessageElement) gameOverMessageElement.textContent = message;
            gameOverMenu.style.display = 'block'; // Or 'flex' if you styled it that way
        } else {
            // Fallback if HTML menu isn't there for some reason (should not happen with checks)
            console.error("Game Over Menu not found, falling back to canvas drawing.");
            context.fillStyle = 'rgba(0, 0, 0, 0.75)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = 'green';
            context.font = '50px Arial';
            context.textAlign = 'center';
            context.fillText(message, canvas.width / 2, canvas.height / 2 - 30);
            context.font = '30px Arial';
            context.fillText('Click to Return to Menu (Fallback)', canvas.width / 2, canvas.height / 2 + 30);
            context.textAlign = 'left';
            // Fallback click listener on canvas if button isn't there
            canvas.addEventListener('click', function handleFallbackReturn() {
                if (startMenu) startMenu.style.display = 'flex';
                // context.clearRect(0, 0, canvas.width, canvas.height); // Canvas is hidden
            }, { once: true });
            return; // Exit to avoid adding listener to a non-existent button
        }

        // Event listener for the 'Return to Main Menu' button
        // Ensure we don't add multiple listeners if gameOver is somehow called multiple times rapidly
        // The {once: true} on the button's own listener handles its removal after click.
        // No need for a separate named function and removeEventListener here if we re-get the button each time
        // OR ensure the listener is only added once.
        // For simplicity, we'll rely on the button being fresh or its listener being single-use.
        // However, a robust way is to define the handler outside and add/remove it.

        // For now, let's assume the button is fresh or its listener is {once:true} if set in HTML or elsewhere.
        // The most straightforward way is to add it here with {once:true}
        if (returnToMenuButton) {
            returnToMenuButton.onclick = function() { // Using onclick for simplicity, or addEventListener with {once:true}
                if (gameOverMenu) gameOverMenu.style.display = 'none';
                if (startMenu) startMenu.style.display = 'flex';
                // No need to clear canvas as it's hidden
            };
            // Or, if you prefer addEventListener for consistency:
            // const returnHandler = () => {
            //     if (gameOverMenu) gameOverMenu.style.display = 'none';
            //     if (startMenu) startMenu.style.display = 'flex';
            // };
            // returnToMenuButton.removeEventListener('click', returnHandler); // Remove old one if any
            // returnToMenuButton.addEventListener('click', returnHandler, { once: true });
        }
    }

    // Function to check for winning score
    function checkGameOver() {
        if (playerScore >= winningScore || aiScore >= winningScore) {
            if (playerScore >= winningScore) {
                gameOver('Player Wins!');
            } else {
                gameOver('AI Wins!');
            }
            return true; // Game is over
        }
        return false; // Game continues
    }

    // Event listener for restarting the game
    function handleGameRestart(event) {
        if (playerScore >= winningScore || aiScore >= winningScore) {
            playerScore = 0;
            aiScore = 0;
            resetBall(Math.random() > 0.5); // Randomly decide who starts next game
            document.removeEventListener('click', handleGameRestart); // Remove to prevent multiple listeners
            gameLoop(); // Restart the game loop
        }
    }

    // Function to move the AI paddle
    function moveAIPaddle() {
        // Vertical Movement (Easing)
        const targetAiCenterY = ball.y;
        const currentAiCenterY = ai.y;
        const diffY = targetAiCenterY - currentAiCenterY;
        ai.y += diffY * 0.1;
        // Vertical boundary
        if (ai.y - ai.radius < 0) ai.y = ai.radius;
        else if (ai.y + ai.radius > canvas.height) ai.y = canvas.height - ai.radius;

        // Horizontal Movement
        let targetX;
        // If ball is on player's side (left of center)
        if (ball.x < canvas.width / 2) {
            if (ball.dx < 0 && ball.x < canvas.width / 4) { // Ball moving further into player's side (away from AI) and quite far
                targetX = AI_DEFAULT_X; // Stay back
            } else { // Ball on player's side, potentially coming towards AI or in mid-player-court
                targetX = AI_MAX_ADVANCE_X; // Advance to meet/intercept
            }
        } else { // Ball on AI's side (right of center)
            targetX = AI_DEFAULT_X; // Stay in a defensive position
        }

        // Move ai.x towards targetX
        if (ai.x < targetX) {
            ai.dx = AI_HORIZONTAL_SPEED_MAGNITUDE;
            ai.x += ai.dx;
            if (ai.x > targetX) ai.x = targetX; // Don't overshoot
        } else if (ai.x > targetX) {
            ai.dx = -AI_HORIZONTAL_SPEED_MAGNITUDE;
            ai.x += ai.dx;
            if (ai.x < targetX) ai.x = targetX; // Don't overshoot
        } else {
            ai.dx = 0; // Reached target
        }

        // Horizontal boundary checks for AI
        // AI must stay on its half (right side of the center line)
        if (ai.x - ai.radius < canvas.width / 2) {
            ai.x = canvas.width / 2 + ai.radius;
        }
        // AI must not go off the right edge of the canvas
        if (ai.x + ai.radius > canvas.width) {
            ai.x = canvas.width - ai.radius;
        }
    }

    // Game loop function
    function gameLoop() {
        if (!gameStarted) return; // Don't run if game hasn't started

        // Store previous ball position before updates
        ball.prevX = ball.x;
        ball.prevY = ball.y;

        // Fill canvas with light tan background for in-game screen
        context.fillStyle = 'blanchedalmond';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Clear canvas (not strictly necessary if filling background each frame, but good practice if layers were transparent)
        // context.clearRect(0, 0, canvas.width, canvas.height); 
        // For now, we'll rely on the fillRect above to cover previous frame.

        // Update positions
        movePlayerPaddle(); // Ensure player paddle movement is called
        moveAIPaddle();     // Ensure AI paddle movement is called
        moveBall();         // Handles ball movement, collisions, and scoring
        updateChargeState(); // Update the player charge meter state
        updateAIChargeState(); // Update the AI charge meter state

        // Record current position for the trail AFTER ball movement
        ball.trail.unshift({ x: ball.x, y: ball.y }); // Add to the beginning
        // Keep the trail to a maximum length
        if (ball.trail.length > ball.maxTrailLength) {
            ball.trail.pop(); // Remove the oldest point
        }

        // Draw elements
        drawNet();
        drawGoals(); // Call drawGoals
        drawPlayerPaddle();
        drawAIPaddle();
        drawBallTrail(); // Draw the trail first
        drawBall();     // Then draw the ball on top
        drawScore();
        drawChargeGauge(); // Draw the player charge meter
        drawAIChargeGauge(); // Draw the AI charge meter

        // Check for game over and stop loop if necessary
        if (checkGameOver()) {
            return; // Stop the current game animation frame if game is over
        }

        // Request next frame
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Function to initialize and start the game
    function startGame(selectedMode) {
        controlMode = selectedMode;
        gameStarted = true;

        // Initialize dimensions that depend on canvas size
        goalHeight = canvas.height * GOAL_HEIGHT_FACTOR;
        goalYTop = (canvas.height / 2) - (goalHeight / 2);
        goalYBottom = goalYTop + goalHeight;

        startMenu.style.display = 'none';
        canvas.style.display = 'block'; // Or 'flex', 'inline-block' as appropriate

        // Reset scores and game elements for a fresh start
        playerScore = 0;
        aiScore = 0;
        player.y = canvas.height / 2; // Reset player paddle position
        player.x = 50; // Reset player paddle X position to default starting X
        player.dy = 0; // Ensure no residual movement from keyboard mode
        player.dx = 0; // Ensure no residual horizontal movement
        ai.y = canvas.height / 2;     // Reset AI paddle position
        ai.x = AI_DEFAULT_X; // Reset AI horizontal position to its default
        ai.dx = 0; // Reset AI horizontal speed

        // Reset charge states for both player and AI
        isCharging = false;
        chargeStartTime = 0;
        currentTierAchieved = 0;
        chargeHeldTier = 0;
        aiIsCharging = false;
        aiChargeStartTime = 0;
        aiCurrentTierAchieved = 0;
        aiChargeHeldTier = 0;

        resetBall(Math.random() > 0.5); // Initialize ball position and speed

        // Cancel any existing game loop to prevent multiple loops if startGame is called again
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        gameLoop(); // Start the actual game animation loop
    }

    // Event listeners for menu buttons
    mouseModeButton.addEventListener('click', function() {
        startGame('mouse');
    });

    keyboardModeButton.addEventListener('click', function() {
        startGame('keyboard');
    });

    // Remove automatic game start. Game now waits for menu selection.
    // resetBall(Math.random() > 0.5); 
    // gameLoop(); 

}); // Closing bracket for DOMContentLoaded
