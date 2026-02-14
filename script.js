const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const mainMenu = document.getElementById('main-menu');
const hud = document.getElementById('hud');
const progressFill = document.getElementById('progress-fill');
const attemptSpan = document.getElementById('attempt-count');
const crashFlash = document.getElementById('crash-flash');
const modeDisplay = document.getElementById('mode-display');

canvas.width = 1280;
canvas.height = 640;

// Loop Variables
let lastTime = 0;
let accumulator = 0;
const STEP = 1/60;
let animationFrameId;

// --- PHYSICS CONSTANTS ---
const PHY = {
    GRAVITY: 0.65,
    JUMP_FORCE: -10.5,
    SHIP_LIFT: -0.35,
    SHIP_GRAVITY: 0.25,
    UFO_JUMP: -9,        
    // ROBOT CHANGED: Lower jump height as requested
    ROBOT_JUMP_MIN: -6.5, 
    WAVE_SPEED: 7,       
    TERMINAL_VEL: 12,
    SPEED: 6.5,
    GROUND: 570,
    BLOCK_SIZE: 40
};

// --- BACKGROUND COLORS ---
const BG_COLORS = [
    '#3b5ddb', '#d042da', '#2ecc71', '#c0392b', 
    '#34495e', '#8e44ad', '#3498db', '#e67e22', 
    '#1abc9c', '#f1c40f'
];

// --- TERRAIN GENERATORS ---

function tunnel(start, length, floorH, ceilH) {
    let arr = [];
    for(let i=0; i<length; i++) {
        for(let j=0; j<floorH; j++) arr.push({x: start+i, y: j, t: 1});
        for(let k=ceilH; k<16; k++) arr.push({x: start+i, y: k, t: 1});
        arr.push({x: start+i, y: floorH, t: 2}); 
        arr.push({x: start+i, y: ceilH-1, t: 2});
    }
    return arr;
}

function platform(x, y, width) {
    let arr = [];
    for(let i=0; i<width; i++) {
        arr.push({x: x+i, y: y, t: 1});
        arr.push({x: x+i, y: y+1, t: 2});
        arr.push({x: x+i, y: y-1, t: 2});
    }
    return arr;
}

function wavePath(start, length, yLevel, tightness) {
    let arr = [];
    for(let i=0; i<length; i++) {
        for(let j=0; j<yLevel; j++) arr.push({x: start+i, y: j, t: 1});
        for(let k=yLevel+tightness; k<16; k++) arr.push({x: start+i, y: k, t: 1});
    }
    return arr;
}

function pillar(x, height) {
    let arr = [];
    for(let i=0; i<height; i++) arr.push({x: x, y: i, t: 1});
    return arr;
}

// NEW: UFO GATE - 2 Block gap with spikes on the bottom block
function ufoGate(x, yGapLevel) {
    let arr = [];
    // Bottom Pillar (y 0 to yGapLevel)
    for(let i=0; i<=yGapLevel; i++) {
        arr.push({x: x, y: i, t: 1});
    }
    // Spike on top of bottom pillar
    arr.push({x: x, y: yGapLevel + 1, t: 2});

    // Top Pillar (Leaves 2 block gap: yGapLevel+2 and yGapLevel+3 are empty)
    // Starts at yGapLevel + 4
    for(let i=yGapLevel+4; i<16; i++) {
        arr.push({x: x, y: i, t: 1});
    }
    return arr;
}

// --- LEVEL DATA ---
// T: 1=Block, 2=Spike, 3=Ship, 4=Cube, 5=Ball, 6=UFO, 7=Wave, 8=Robot

const LEVELS = [
    // 1. Stereo Madness
    [
        {x: 10, y: 0, t: 1}, {x: 20, y: 1, t: 1}, {x: 25, y: 2, t: 1}, 
        {x: 35, y: 0, t: 2}, {x: 45, y: 0, t: 2}, 
        {x: 60, y: 0, t: 1}, {x: 65, y: 1, t: 2}, 
        {x: 80, y: 0, t: 2}, {x: 81, y: 0, t: 2}, {x: 82, y: 0, t: 2}, 

        {x: 100, y: 3, t: 3}, // SHIP
        ...tunnel(110, 20, 1, 12),
        
        {x: 170, y: 3, t: 4}, // CUBE
        {x: 180, y: 0, t: 1}, {x: 185, y: 1, t: 2}, {x: 190, y: 2, t: 1},
        {x: 210, y: 0, t: 2}, {x: 211, y: 0, t: 2}
    ],

    // 2. Back on Track
    [
        {x: 10, y: 0, t: 1}, {x: 15, y: 1, t: 1}, {x: 20, y: 2, t: 1},
        {x: 30, y: 0, t: 2}, {x: 32, y: 0, t: 2},
        {x: 45, y: 4, t: 1}, {x: 55, y: 2, t: 1}, {x: 65, y: 0, t: 1}, 
        {x: 80, y: 0, t: 2}, {x: 81, y: 0, t: 2}, {x: 82, y: 0, t: 2},

        {x: 100, y: 4, t: 3}, // SHIP
        ...tunnel(105, 10, 2, 11),
        ...tunnel(120, 10, 3, 10),
        
        {x: 150, y: 0, t: 4}, // CUBE
        {x: 160, y: 0, t: 1}, {x: 170, y: 1, t: 1}, {x: 180, y: 2, t: 2}
    ],

    // 3. Polargeist
    [
        {x: 10, y: 0, t: 2}, {x: 12, y: 0, t: 2},
        {x: 20, y: 1, t: 1}, {x: 25, y: 3, t: 1}, {x: 30, y: 2, t: 2}, 
        
        {x: 50, y: 4, t: 5}, // BALL
        ...platform(60, 3, 3), 
        ...platform(70, 6, 3),
        ...platform(80, 3, 3),
        
        {x: 100, y: 5, t: 3}, // SHIP
        ...tunnel(105, 30, 2, 10),

        {x: 190, y: 0, t: 4}, // CUBE
        {x: 200, y: 0, t: 2}, {x: 201, y: 0, t: 2}
    ],

    // 4. Dry Out (UFO Gates)
    [
        {x: 10, y: 0, t: 1}, {x: 15, y: 0, t: 2},
        
        {x: 40, y: 0, t: 5}, // BALL
        {x: 50, y: 0, t: 1}, {x: 55, y: 0, t: 2}, 
        {x: 65, y: 6, t: 1}, {x: 70, y: 6, t: 1}, {x: 75, y: 0, t: 2}, 
        
        {x: 90, y: 0, t: 6}, // UFO
        // 2 Block Gap Gates with Spikes
        ...ufoGate(100, 2),
        ...ufoGate(115, 5),
        ...ufoGate(130, 3),
        ...ufoGate(145, 6),

        {x: 160, y: 0, t: 4}, // CUBE
        {x: 170, y: 0, t: 2}
    ],

    // 5. Base After Base
    [
        {x: 10, y: 0, t: 1}, {x: 10, y: 1, t: 1}, 
        {x: 30, y: 0, t: 2}, {x: 32, y: 0, t: 2},
        
        {x: 70, y: 4, t: 3}, // SHIP
        ...tunnel(75, 10, 2, 9),
        ...tunnel(90, 10, 5, 12),
        ...tunnel(105, 10, 2, 9),
        
        {x: 140, y: 0, t: 4}, // CUBE
        {x: 150, y: 0, t: 1}, {x: 160, y: 2, t: 1}
    ],

    // 6. Can't Let Go
    [
        {x: 10, y: 0, t: 1}, {x: 15, y: 2, t: 1}, {x: 20, y: 4, t: 1},
        
        {x: 50, y: 0, t: 5}, // BALL
        ...platform(60, 4, 3),
        ...platform(75, 7, 3),
        ...platform(90, 4, 3),
        
        {x: 120, y: 0, t: 4}, // CUBE
        {x: 130, y: 2, t: 1}, {x: 140, y: 3, t: 1}, {x: 150, y: 4, t: 1},
        {x: 165, y: 4, t: 2}, {x: 175, y: 2, t: 1}
    ],

    // 7. Jumper (Robot Nerfed)
    [
        {x: 10, y: 0, t: 8}, // ROBOT
        ...pillar(20, 2), ...pillar(35, 3), ...pillar(50, 4), // Reduced heights due to nerf
        {x: 60, y: 0, t: 2}, {x: 62, y: 0, t: 2},
        
        {x: 80, y: 4, t: 3}, // SHIP
        ...tunnel(85, 30, 3, 9),
        
        {x: 150, y: 0, t: 4}, // CUBE
        {x: 160, y: 0, t: 1}, {x: 170, y: 2, t: 1}
    ],

    // 8. Time Machine
    [
        {x: 10, y: 0, t: 1}, {x: 20, y: 0, t: 2},
        
        {x: 40, y: 0, t: 5}, // BALL
        ...platform(50, 4, 2), ...platform(60, 4, 2), ...platform(70, 4, 2),
        
        {x: 100, y: 0, t: 8}, // ROBOT
        ...pillar(110, 3), ...pillar(125, 4), ...pillar(140, 5),
        
        {x: 160, y: 0, t: 4} // CUBE
    ],

    // 9. Cycles (UFO Gates)
    [
        {x: 10, y: 0, t: 5}, // BALL
        {x: 20, y: 0, t: 1}, {x: 30, y: 7, t: 1}, 
        {x: 40, y: 1, t: 2}, {x: 50, y: 6, t: 2},
        
        {x: 70, y: 4, t: 6}, // UFO
        // Tight Gate Sequence
        ...ufoGate(80, 2), ...ufoGate(90, 4), ...ufoGate(100, 2), 
        ...ufoGate(110, 5), ...ufoGate(120, 3),
        
        {x: 140, y: 3, t: 3}, // SHIP
        ...tunnel(145, 30, 4, 10),

        {x: 190, y: 0, t: 4}
    ],

    // 10. xStep (Demon - Wave & UFO)
    [
        {x: 10, y: 0, t: 1}, {x: 15, y: 1, t: 1}, 
        
        {x: 30, y: 0, t: 6}, // UFO
        ...ufoGate(40, 2), ...ufoGate(50, 2), ...ufoGate(60, 5), 
        ...ufoGate(70, 5), ...ufoGate(80, 2),
        
        {x: 100, y: 4, t: 7}, // WAVE
        ...wavePath(105, 10, 3, 5),
        ...wavePath(115, 10, 5, 5),
        ...wavePath(125, 10, 2, 5),
        ...wavePath(135, 15, 4, 4),
        
        {x: 160, y: 0, t: 8}, // ROBOT
        ...pillar(170, 3), ...pillar(185, 5),
        
        {x: 210, y: 3, t: 3}, // SHIP END
        ...tunnel(215, 20, 3, 9)
    ]
];

// --- GAME STATE ---
let gameState = {
    mode: "MENU",
    levelIndex: 0,
    objects: [],
    cameraX: 0,
    attempts: 1,
    levelLength: 0
};

let player = {
    x: 200, y: 0, w: 30, h: 30,
    dy: 0,
    gamemode: 'CUBE',
    rotation: 0,
    onGround: false,
    dead: false,
    gravityScale: 1,
    robotJumpTimer: 0
};

let input = { hold: false, jumpPressed: false, clickProcessed: false };

// --- INPUT HANDLING ---
function bindInput() {
    const handleDown = () => {
        if (gameState.mode === "PLAYING") {
            input.hold = true;
            input.jumpPressed = true;
            input.clickProcessed = false;
        }
    };
    const handleUp = () => { input.hold = false; player.robotJumpTimer = 0; };

    window.addEventListener('mousedown', handleDown);
    window.addEventListener('touchstart', (e) => { e.preventDefault(); handleDown(); }, {passive: false});
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') handleDown();
        if (e.code === 'Escape') exitToMenu();
    });

    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') handleUp();
    });
}

// --- LEVEL MANAGEMENT ---
function startLevel(index) {
    gameState.levelIndex = index;
    gameState.attempts = 1;
    attemptSpan.innerText = gameState.attempts;
    loadLevelData(index);
    
    mainMenu.style.display = 'none';
    hud.style.display = 'block';
    gameState.mode = "PLAYING";
    
    lastTime = performance.now();
    accumulator = 0;
    if(animationFrameId) cancelAnimationFrame(animationFrameId);
    requestAnimationFrame(loop);
}

function loadLevelData(index) {
    gameState.objects = [];
    
    // Convert Level Data
    LEVELS[index].forEach(obj => {
        let newObj = {
            x: obj.x * PHY.BLOCK_SIZE,
            y: PHY.GROUND - (obj.y * PHY.BLOCK_SIZE) - PHY.BLOCK_SIZE,
            type: obj.t,
            w: PHY.BLOCK_SIZE, h: PHY.BLOCK_SIZE
        };

        // Portals stretch to ground
        if (obj.t >= 3 && obj.t <= 8) {
            newObj.y = 0;
            newObj.h = PHY.GROUND;
        }
        
        gameState.objects.push(newObj);
    });
    
    if (gameState.objects.length > 0) {
        gameState.levelLength = gameState.objects[gameState.objects.length-1].x + 500;
    } else {
        gameState.levelLength = 2000; 
    }
    resetPlayer();
}

function resetPlayer() {
    player.x = 200;
    player.y = PHY.GROUND - player.h;
    player.dy = 0;
    player.gamemode = 'CUBE';
    player.rotation = 0;
    player.dead = false;
    player.onGround = true;
    player.gravityScale = 1;
    gameState.cameraX = 0;
    modeDisplay.innerText = "CUBE";
    crashFlash.classList.remove('flash-active');
}

function exitToMenu() {
    gameState.mode = "MENU";
    mainMenu.style.display = 'flex';
    hud.style.display = 'none';
    cancelAnimationFrame(animationFrameId);
}

function crash() {
    if (player.dead) return;
    player.dead = true;
    gameState.attempts++;
    attemptSpan.innerText = gameState.attempts;
    
    crashFlash.classList.add('flash-active');
    setTimeout(() => crashFlash.classList.remove('flash-active'), 100);

    setTimeout(() => {
        resetPlayer();
    }, 600);
}

// --- PHYSICS ENGINE ---
function updatePhysics() {
    if (player.dead || gameState.mode !== "PLAYING") return;

    gameState.cameraX += PHY.SPEED;
    let gravity = PHY.GRAVITY * player.gravityScale;

    // --- GAMEMODE BEHAVIOR ---
    if (player.gamemode === 'CUBE') {
        player.dy += gravity;
        if (player.onGround && input.hold) {
            player.dy = PHY.JUMP_FORCE * player.gravityScale;
            player.onGround = false;
        }
        if (!player.onGround) player.rotation += 5 * player.gravityScale;
        else player.rotation = Math.round(player.rotation / 90) * 90;
    } 
    else if (player.gamemode === 'SHIP') {
        player.dy += input.hold ? PHY.SHIP_LIFT : PHY.SHIP_GRAVITY;
        player.rotation = player.dy * 2.5;
        // Ship Floor Ceiling is handled by Boundary Check now
    }
    else if (player.gamemode === 'BALL') {
        player.dy += gravity;
        if (player.onGround && input.jumpPressed) {
            player.gravityScale *= -1;
            player.dy = 2 * player.gravityScale;
            player.onGround = false;
            input.jumpPressed = false;
        }
        player.rotation += 5 * player.gravityScale;
    }
    else if (player.gamemode === 'UFO') {
        player.dy += gravity;
        if (input.jumpPressed && !input.clickProcessed) {
            player.dy = PHY.UFO_JUMP;
            input.clickProcessed = true;
            input.jumpPressed = false;
        }
    }
    else if (player.gamemode === 'WAVE') {
        player.dy = input.hold ? -PHY.WAVE_SPEED : PHY.WAVE_SPEED;
        player.rotation = player.dy * 5;
    }
    else if (player.gamemode === 'ROBOT') {
        player.dy += gravity;
        if (player.onGround && input.hold) {
            player.dy = PHY.ROBOT_JUMP_MIN;
            player.onGround = false;
            player.robotJumpTimer = 15;
        } else if (input.hold && player.robotJumpTimer > 0) {
            player.dy -= 0.5; // Slightly reduced boost for nerfed robot
            player.robotJumpTimer--;
        }
    }

    // Terminal Velocity
    if (Math.abs(player.dy) > PHY.TERMINAL_VEL) player.dy = PHY.TERMINAL_VEL * Math.sign(player.dy);
    player.y += player.dy;

    // --- BOUNDARY CHECK (OFF SCREEN DEATH) ---
    // Top of screen death or Below Floor death (if no blocks)
    // Note: y=0 is top. 
    if (player.y < -10) crash(); // Hit top of screen
    if (player.y > PHY.GROUND + 10) crash(); // Fall below floor

    // --- COLLISION RESOLUTION ---
    player.onGround = false; 

    // Floor Bounds (Only for Cube/Robot/UFO/Ball)
    // Ship/Wave are free flying but die on floor if they touch it without blocks
    if (player.gamemode !== 'WAVE' && player.gamemode !== 'SHIP') {
        if (player.gravityScale === 1 && player.y + player.h >= PHY.GROUND) {
            player.y = PHY.GROUND - player.h;
            player.dy = 0;
            player.onGround = true;
        } else if (player.gravityScale === -1 && player.y <= 0) {
            player.y = 0;
            player.dy = 0;
            player.onGround = true;
        }
    }

    // Object Collision
    let pRect = {
        l: gameState.cameraX + player.x + 8,
        r: gameState.cameraX + player.x + player.w - 8,
        t: player.y + 8,
        b: player.y + player.h - 8
    };

    let nearby = gameState.objects.filter(o => 
        o.x > gameState.cameraX + 100 && o.x < gameState.cameraX + 500
    );

    for (let obj of nearby) {
        if (pRect.r > obj.x && pRect.l < obj.x + obj.w &&
            pRect.b > obj.y && pRect.t < obj.y + obj.h) {
            
            // Spikes (2)
            if (obj.type === 2) crash();

            // Portals (3-8)
            if (obj.type >= 3 && obj.type <= 8) {
                switch(obj.type) {
                    case 3: player.gamemode = 'SHIP'; break;
                    case 4: player.gamemode = 'CUBE'; break;
                    case 5: player.gamemode = 'BALL'; break;
                    case 6: player.gamemode = 'UFO'; break;
                    case 7: player.gamemode = 'WAVE'; break;
                    case 8: player.gamemode = 'ROBOT'; break;
                }
                player.gravityScale = 1;
                modeDisplay.innerText = player.gamemode;
            }

            // Blocks (1)
            if (obj.type === 1) {
                if (player.gamemode === 'WAVE') crash();

                let prevY = player.y - player.dy;

                if (player.gravityScale === 1) {
                    // Falling down onto block
                    if (prevY + player.h <= obj.y + 15 && player.dy >= 0) {
                        player.y = obj.y - player.h;
                        player.dy = 0;
                        player.onGround = true;
                        if (player.gamemode === 'CUBE' || player.gamemode === 'ROBOT')
                            player.rotation = Math.round(player.rotation / 90) * 90;
                    } 
                    // Hitting bottom
                    else if (prevY >= obj.y + obj.h - 15 && player.dy < 0) {
                        player.y = obj.y + obj.h;
                        player.dy = 0;
                    } 
                    else { crash(); }
                } 
                else { // Reverse Gravity (Ball)
                    // Falling UP onto block
                    if (prevY >= obj.y + obj.h - 15 && player.dy <= 0) {
                        player.y = obj.y + obj.h;
                        player.dy = 0;
                        player.onGround = true;
                    } else { crash(); }
                }
            }
        }
    }

    if (gameState.cameraX > gameState.levelLength) exitToMenu();

    let pct = Math.min((gameState.cameraX / gameState.levelLength) * 100, 100);
    if(progressFill) progressFill.style.width = pct + '%';
}

// --- RENDERER ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let bgCol = BG_COLORS[gameState.levelIndex] || '#001133';
    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, PHY.GROUND, canvas.width, canvas.height - PHY.GROUND);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, PHY.GROUND); ctx.lineTo(canvas.width, PHY.GROUND); ctx.stroke();

    gameState.objects.forEach(obj => {
        let drawX = obj.x - gameState.cameraX;
        if (drawX > -50 && drawX < canvas.width + 50) {
            if (obj.type === 1) { // Block
                ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
                ctx.strokeRect(drawX, obj.y, obj.w, obj.h);
                ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(drawX, obj.y, obj.w, obj.h);
            } 
            else if (obj.type === 2) { // Spike
                ctx.fillStyle = 'red'; ctx.strokeStyle = 'white'; ctx.lineWidth = 1;
                ctx.beginPath();
                if (player.gravityScale === 1) {
                    ctx.moveTo(drawX, obj.y + obj.h); 
                    ctx.lineTo(drawX + obj.w/2, obj.y); 
                    ctx.lineTo(drawX + obj.w, obj.y + obj.h);
                } else {
                    ctx.moveTo(drawX, obj.y); 
                    ctx.lineTo(drawX + obj.w/2, obj.y + obj.h); 
                    ctx.lineTo(drawX + obj.w, obj.y);
                }
                ctx.closePath();
                ctx.fill(); ctx.stroke();
            } 
            else if (obj.type >= 3) { // Portals
                let colors = {3:'pink', 4:'cyan', 5:'orange', 6:'purple', 7:'blue', 8:'white'};
                ctx.fillStyle = colors[obj.type] || 'gray';
                ctx.globalAlpha = 0.5;
                ctx.fillRect(drawX, 0, 40, obj.h);
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = 'white'; ctx.font = "bold 12px Arial"; 
                let names = {3:'SHIP', 4:'CUBE', 5:'BALL', 6:'UFO', 7:'WAVE', 8:'ROBOT'};
                ctx.fillText(names[obj.type], drawX, 50);
            }
        }
    });

    if (!player.dead) {
        ctx.save();
        ctx.translate(player.x + player.w/2, player.y + player.h/2);
        ctx.rotate(player.rotation * Math.PI / 180);
        
        ctx.fillStyle = player.gamemode === 'SHIP' ? '#ff55aa' : '#00ffff';
        
        if (player.gamemode === 'WAVE') {
            ctx.beginPath(); ctx.moveTo(-15, -15); ctx.lineTo(15, 0); ctx.lineTo(-15, 15); ctx.fill();
        } else {
            ctx.fillRect(-player.w/2, -player.w/2, player.w, player.w);
            ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
            ctx.strokeRect(-player.w/2 + 5, -player.w/2 + 5, player.w - 10, player.w - 10);
            ctx.fillStyle = 'black'; ctx.fillRect(5, -5, 5, 5);
        }
        ctx.restore();
    }
}

function loop(timestamp) {
    if (gameState.mode !== "PLAYING") return;
    if (!lastTime) lastTime = timestamp;
    let deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (deltaTime > 0.1) deltaTime = 0.1;

    accumulator += deltaTime;
    while (accumulator >= STEP) {
        updatePhysics();
        accumulator -= STEP;
    }
    draw();
    animationFrameId = requestAnimationFrame(loop);
}

bindInput();
ctx.fillStyle = '#001133'; 
ctx.fillRect(0,0,canvas.width,canvas.height);
