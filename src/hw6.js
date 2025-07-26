import {OrbitControls} from './OrbitControls.js'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Set background color
scene.background = new THREE.Color(0x000000);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(20, 30, 20);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
scene.add(directionalLight);

// BONUS: Enhanced lighting with multiple light sources
const spotLight1 = new THREE.SpotLight(0xffffff, 0.6, 100, Math.PI / 6, 0.3);
spotLight1.position.set(-20, 25, 10);
spotLight1.target.position.set(0, 0, 0);
spotLight1.castShadow = true;
scene.add(spotLight1);
scene.add(spotLight1.target);

// Enable shadows
renderer.shadowMap.enabled = true;
directionalLight.castShadow = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function degrees_to_radians(degrees) {
  var pi = Math.PI;
  return degrees * (pi/180);
}

// Global constant sizes
const Y_LINE = 0.11;            // lines slightly above floor
const COURT_LEN = 42;           // X‑size   (width)
const COURT_WID = 21;           // Z‑size   (length)
const HALF_LEN = COURT_LEN / 2;
const HALF_WID = COURT_WID / 2;

// Game state variables
let gameState = {
  score: 0,
  shotAttempts: 0,
  shotsMade: 0,
  shotPower: 50, // 0-100%
  isMoving: false,
  isShooting: false,
  lastShotResult: '',
  hasScored: false, // Track if current shot has scored
  comboStreak: 0, // Track consecutive made shots
  maxCombo: 0 // Track max combo for display
};

// Basketball physics variables
let basketball = null;
let ballVelocity = new THREE.Vector3(0, 0, 0);
let ballPosition = new THREE.Vector3(0, 0.7, 0);
let ballRotation = new THREE.Vector3(0, 0, 0);
const gravity = -0.02; // Gravity acceleration
const bounceRestitution = 0.7; // Energy loss on bounce
const ballRadius = 0.6;
let rimTouchedThisShot = false; // Track if rim was touched during the shot

// Ball trail effect
let ballTrail = [];
const BALL_TRAIL_LENGTH = 30; // Number of points in the trail
let ballTrailMesh = null;

function updateBallTrailMesh() {
  // Remove old trail mesh
  if (ballTrailMesh) {
    scene.remove(ballTrailMesh);
    ballTrailMesh.geometry.dispose();
    ballTrailMesh.material.dispose();
    ballTrailMesh = null;
  }
  if (ballTrail.length < 2) return;
  // Create geometry from trail points
  const geometry = new THREE.BufferGeometry().setFromPoints(ballTrail);
  // Create a gradient material (fading alpha)
  const colors = [];
  for (let i = 0; i < ballTrail.length; i++) {
    const t = i / (ballTrail.length - 1);
    colors.push(1, 1, 1, 0.2 + 0.8 * t); // RGBA: fade from transparent to white
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
  ballTrailMesh = new THREE.Line(geometry, material);
  scene.add(ballTrailMesh);
}

// Input state tracking
const keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  w: false,
  s: false,
  space: false,
  r: false
};

// Create basketball court
function createBasketballCourt() {
  // Court floor - just a simple brown surface
  const courtGeometry = new THREE.BoxGeometry(COURT_LEN, 0.2,COURT_WID);
  const courtMaterial = new THREE.MeshPhongMaterial({
    color: 0xc68642,  // Brown wood color
    shininess: 50
  });
  const court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.receiveShadow = true;
  court.castShadow = true;
  scene.add(court);
}

function createCourtLines() {
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff });

  // Centre line (across the court at X=0)
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, Y_LINE, -HALF_WID),
      new THREE.Vector3(0, Y_LINE, HALF_WID)
    ]), mat));

  // Center circle
  const circlePts = Array.from({ length: 65 }, (_, i) => {
    const a = (i/64) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a)*2.5, Y_LINE, Math.sin(a)*2.5);
  });
  scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts), mat));

  // 3‑point arcs
  const r = 9.5;
  [-HALF_LEN, HALF_LEN].forEach(x0 => {
    const pts = Array.from({ length: 65 }, (_, i) => {
      const t = -Math.PI/2 + (i/64)*Math.PI;
      const z = Math.sin(t) * r;
      const x = x0 - Math.sign(x0) * Math.cos(t) * r;
      return new THREE.Vector3(x, Y_LINE, z);
    });
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  });
}

function createCourtBoundary() {
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff });

  // Court perimeter
  const boundaryPts = [
    new THREE.Vector3(-HALF_LEN, Y_LINE, -HALF_WID),
    new THREE.Vector3(HALF_LEN, Y_LINE, -HALF_WID),
    new THREE.Vector3(HALF_LEN, Y_LINE, HALF_WID),
    new THREE.Vector3(-HALF_LEN, Y_LINE, HALF_WID),
  ];
  scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(boundaryPts), mat));
}

// Create basketball hoop with all components
function createBasketballHoop(xPosition) {
  // Support pole (behind the backboard)
  const poleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 8);
  const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.set(xPosition + (xPosition > 0 ? 2 : -2), 4, 0);
  pole.castShadow = true;
  scene.add(pole);

  // Support arm connecting pole to backboard
  const armGeometry = new THREE.BoxGeometry(2, 0.3, 0.3);
  const arm = new THREE.Mesh(armGeometry, poleMaterial);
  arm.position.set(xPosition + (xPosition > 0 ? 1 : -1), 7, 0);
  arm.castShadow = true;
  scene.add(arm);

  // Backboard (white, partially transparent)
  const backboardGeometry = new THREE.BoxGeometry(0.1, 3, 5);
  const backboardMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  });
  const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
  backboard.position.set(xPosition, 7, 0);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  scene.add(backboard);

  // Basketball rim (orange)
  const rimGeometry = new THREE.TorusGeometry(0.75, 0.05, 8, 16);
  const rimMaterial = new THREE.MeshPhongMaterial({ color: 0xff4500 });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.position.set(xPosition + (xPosition > 0 ? -0.8 : 0.8), 6, 0);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  scene.add(rim);

  // Net using line segments
  createBasketballNet(xPosition + (xPosition > 0 ? -0.8 : 0.8), 6, 0);
}

let netStrands = [];

function createBasketballNet(x, y, z) {
  const netMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const segments = 12;
  const rimRadius = 0.75;
  const netHeight = 1.5;

  // Clear existing net strands for this hoop
  const hoopIndex = x > 0 ? 0 : 1;
  if (!netStrands[hoopIndex]) netStrands[hoopIndex] = [];

  // Create vertical strands
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const startX = x + Math.cos(angle) * rimRadius;
    const startZ = z + Math.sin(angle) * rimRadius;

    // Create curved strand that hangs down naturally
    const strandPoints = [];
    for (let j = 0; j <= 10; j++) {
      const t = j / 10;
      const hangCurve = Math.sin(t * Math.PI) * 0.3; // Natural hanging curve
      const currentRadius = rimRadius * (1 - t * 0.4); // Tapers inward

      const currentX = x + Math.cos(angle) * currentRadius;
      const currentZ = z + Math.sin(angle) * currentRadius;
      const currentY = y - t * netHeight - hangCurve;

      strandPoints.push(new THREE.Vector3(currentX, currentY, currentZ));
    }

    const strandGeometry = new THREE.BufferGeometry().setFromPoints(strandPoints);
    const strand = new THREE.Line(strandGeometry, netMaterial);
    strand.userData = { originalPoints: strandPoints.slice(), hoopX: x, hoopY: y, hoopZ: z, strandIndex: i };
    netStrands[hoopIndex].push(strand);
    scene.add(strand);
  }

  // Create horizontal connecting strands at different heights
  for (let level = 0; level < 3; level++) {
    const levelY = y - (level + 1) * (netHeight / 4);
    const levelRadius = rimRadius * (1 - level * 0.15);

    const ringPoints = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const ringX = x + Math.cos(angle) * levelRadius;
      const ringZ = z + Math.sin(angle) * levelRadius;
      ringPoints.push(new THREE.Vector3(ringX, levelY, ringZ));
    }

    const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ring = new THREE.Line(ringGeometry, netMaterial);
    scene.add(ring);
  }
}

// Create enhanced basketball with physics
function createInteractiveBasketball() {
  // Remove existing basketball if it exists
  const existingBall = scene.getObjectByName('basketball');
  if (existingBall) {
    scene.remove(existingBall);
  }

  // Basketball sphere
  const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
  const ballMaterial = new THREE.MeshPhongMaterial({
    color: 0xff6600,
    shininess: 30
  });
  basketball = new THREE.Mesh(ballGeometry, ballMaterial);
  basketball.name = 'basketball';
  basketball.position.copy(ballPosition);
  basketball.castShadow = true;
  basketball.receiveShadow = true;
  scene.add(basketball);

  // Basketball seams (black lines)
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // Curved seams
  for (let i = 0; i < 4; i++) {
    const seamGeometry = new THREE.TorusGeometry(ballRadius + 0.01, 0.02, 4, 16, Math.PI);
    const seam = new THREE.Mesh(seamGeometry, seamMaterial);
    seam.position.set(0, 0, 0); // Relative to basketball
    seam.rotation.y = (i * Math.PI) / 2;
    seam.rotation.z = Math.PI / 2;
    seam.name = `seam_${i}`;
    basketball.add(seam); // Attach to basketball so they move together
  }

  // Horizontal seam
  const horizontalSeamGeometry = new THREE.TorusGeometry(ballRadius + 0.01, 0.02, 4, 32, Math.PI * 2);
  const horizontalSeam = new THREE.Mesh(horizontalSeamGeometry, seamMaterial);
  horizontalSeam.rotation.x = Math.PI / 2;
  horizontalSeam.name = 'horizontal_seam';
  basketball.add(horizontalSeam);
}

// Update UI with enhanced scoring system
function updateGameUI() {
  const scoreElement = document.getElementById('scoreboard');
  const accuracy = gameState.shotAttempts > 0 ? Math.round((gameState.shotsMade / gameState.shotAttempts) * 100) : 0;

  if (scoreElement) {
    scoreElement.innerHTML = `
      Score: <span id="score-value">${gameState.score}</span> | 
      Shots: ${gameState.shotAttempts} | 
      Made: ${gameState.shotsMade} | 
      Accuracy: ${accuracy}%<br>
      <span style="font-size: 18px;">Shot Power: ${gameState.shotPower}% | ${gameState.lastShotResult}</span><br>
      <span style="font-size: 18px; color: #FFD700;">Combo: x${gameState.comboStreak} (Max: x${gameState.maxCombo})</span><br>
      <div id='leaderboard-box' style='margin-top:10px;'>${renderLeaderboard()}</div>
    `;
  }
}

// Enhanced UI framework with power indicator
function createEnhancedUI() {
  // Score display (top-center)
  const scoreElement = document.createElement('div');
  scoreElement.id = 'scoreboard';
  scoreElement.style.position = 'absolute';
  scoreElement.style.top = '30px';
  scoreElement.style.left = '50%';
  scoreElement.style.transform = 'translateX(-50%)';
  scoreElement.style.color = 'white';
  scoreElement.style.fontSize = '24px';
  scoreElement.style.fontFamily = 'Arial, sans-serif';
  scoreElement.style.fontWeight = 'bold';
  scoreElement.style.textAlign = 'center';
  scoreElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
  scoreElement.style.backgroundColor = 'rgba(0,0,0,0.3)';
  scoreElement.style.padding = '10px 20px';
  scoreElement.style.borderRadius = '10px';
  scoreElement.innerHTML = `Score: <span id="score-value">0</span> | Shots: 0`;
  document.body.appendChild(scoreElement);

  // Instructions display (bottom-left)
  const instructionsElement = document.createElement('div');
  instructionsElement.id = 'controls';
  instructionsElement.style.position = 'absolute';
  instructionsElement.style.bottom = '20px';
  instructionsElement.style.left = '20px';
  instructionsElement.style.color = 'white';
  instructionsElement.style.fontSize = '16px';
  instructionsElement.style.fontFamily = 'Arial, sans-serif';
  instructionsElement.style.textAlign = 'left';
  instructionsElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
  instructionsElement.style.padding = '10px';
  instructionsElement.style.borderRadius = '8px';
  instructionsElement.innerHTML = `
    <h3 style="margin-top: 0;">Controls:</h3>
    <p style="margin: 5px 0;">Arrow Keys: Move ball</p>
    <p style="margin: 5px 0;">W/S: Adjust shot power</p>
    <p style="margin: 5px 0;">Space: Shoot ball</p>
    <p style="margin: 5px 0;">R: Reset Ball</p>
    <p style="margin: 5px 0;">O: Toggle orbit camera</p>
    <p style="margin: 5px 0; margin-bottom: 0;">C: Switch camera presets</p>
  `;
  document.body.appendChild(instructionsElement);

  // Add power indicator
  const powerIndicator = document.createElement('div');
  powerIndicator.id = 'power-indicator';
  powerIndicator.style.position = 'absolute';
  powerIndicator.style.bottom = '20px';
  powerIndicator.style.right = '20px';
  powerIndicator.style.color = 'white';
  powerIndicator.style.fontSize = '18px';
  powerIndicator.style.fontFamily = 'Arial, sans-serif';
  powerIndicator.style.textAlign = 'center';
  powerIndicator.style.backgroundColor = 'rgba(0,0,0,0.7)';
  powerIndicator.style.padding = '10px';
  powerIndicator.style.borderRadius = '8px';
  powerIndicator.innerHTML = `
    <div>Shot Power</div>
    <div style="width: 200px; height: 20px; background: #333; border: 2px solid white; margin: 5px 0;">
      <div id="power-bar" style="height: 100%; background: linear-gradient(to right, green, yellow, red); width: ${gameState.shotPower}%; transition: width 0.2s;"></div>
    </div>
    <div>${gameState.shotPower}%</div>
  `;
  document.body.appendChild(powerIndicator);

  // Add game status display
  const statusDisplay = document.createElement('div');
  statusDisplay.id = 'status-display';
  statusDisplay.style.position = 'absolute';
  statusDisplay.style.top = '120px';
  statusDisplay.style.left = '50%';
  statusDisplay.style.transform = 'translateX(-50%)';
  statusDisplay.style.color = 'white';
  statusDisplay.style.fontSize = '28px';
  statusDisplay.style.fontFamily = 'Arial, sans-serif';
  statusDisplay.style.fontWeight = 'bold';
  statusDisplay.style.textAlign = 'center';
  statusDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
  statusDisplay.style.zIndex = '1000';
  statusDisplay.innerHTML = '';
  document.body.appendChild(statusDisplay);
}

// Basketball movement and controls
function updateBasketballMovement() {
  if (gameState.isShooting) return; // Don't allow movement while shooting

  const moveSpeed = 0.3;
  let moved = false;

  // Arrow key movement
  if (keys.left && ballPosition.x > -HALF_LEN + ballRadius) {
    ballPosition.x -= moveSpeed;
    moved = true;
  }
  if (keys.right && ballPosition.x < HALF_LEN - ballRadius) {
    ballPosition.x += moveSpeed;
    moved = true;
  }
  if (keys.up && ballPosition.z > -HALF_WID + ballRadius) {
    ballPosition.z -= moveSpeed;
    moved = true;
  }
  if (keys.down && ballPosition.z < HALF_WID - ballRadius) {
    ballPosition.z += moveSpeed;
    moved = true;
  }

  // Power adjustment
  if (keys.w && gameState.shotPower < 100) {
    gameState.shotPower = Math.min(100, gameState.shotPower + 2);
    updatePowerIndicator();
  }
  if (keys.s && gameState.shotPower > 0) {
    gameState.shotPower = Math.max(0, gameState.shotPower - 2);
    updatePowerIndicator();
  }

  // Update basketball rotation during movement
  if (moved && basketball) {
    const rotationSpeed = 0.1;
    if (keys.left) ballRotation.z += rotationSpeed;
    if (keys.right) ballRotation.z -= rotationSpeed;
    if (keys.up) ballRotation.x += rotationSpeed;
    if (keys.down) ballRotation.x -= rotationSpeed;

    basketball.rotation.x = ballRotation.x;
    basketball.rotation.z = ballRotation.z;
  }

  // Update position if not shooting
  if (basketball && !gameState.isShooting) {
    basketball.position.copy(ballPosition);
  }
}

// Power indicator update
function updatePowerIndicator() {
  const powerBar = document.getElementById('power-bar');
  const powerText = document.querySelector('#power-indicator div:last-child');
  if (powerBar) {
    powerBar.style.width = `${gameState.shotPower}%`;
  }
  if (powerText) {
    powerText.textContent = `${gameState.shotPower}%`;
  }
  updateGameUI();
}

// Physics simulation
function updateBasketballPhysics() {
  if (!gameState.isShooting || !basketball) return;

  // Ball trail: add current position to trail
  ballTrail.push(ballPosition.clone());
  if (ballTrail.length > BALL_TRAIL_LENGTH) ballTrail.shift();

  // Update trail mesh
  updateBallTrailMesh();

  // Apply gravity continuously
  ballVelocity.y += gravity;

  // Update position - let ball move freely through space
  ballPosition.add(ballVelocity);
  basketball.position.copy(ballPosition);

  // Rotate ball during flight
  const speed = ballVelocity.length();
  basketball.rotation.x += speed * 0.1;
  basketball.rotation.z += speed * 0.05;

  // Check backboard collisions
  checkBackboardCollision();

  // Ground collision - only when ball actually hits the floor
  if (ballPosition.y <= ballRadius) {
    ballPosition.y = ballRadius;
    ballVelocity.y *= -bounceRestitution; // Bounce with energy loss
    ballVelocity.x *= 0.9; // Friction
    ballVelocity.z *= 0.9; // Friction

    // Stop if velocity is too low after bouncing
    if (Math.abs(ballVelocity.y) < 0.02 && speed < 0.08) {
      ballVelocity.set(0, 0, 0);
      gameState.isShooting = false;

      // Show missed shot message only if ball stopped without scoring
      if (!gameState.hasScored && gameState.lastShotResult === '') {
        gameState.lastShotResult = '❌ MISSED SHOT';
        showShotFeedback('MISSED SHOT ❌', '#ff0000');
        updateGameUI();
      }

      // Auto-reset after ball completely stops
      setTimeout(() => {
        resetBasketball();
      }, 2000);
    }
  }

  // Check for hoop collision/score - this should not stop the ball
  checkHoopCollision();

  // Keep ball in reasonable bounds but allow it to fall through hoop
  if (ballPosition.x < -HALF_LEN - 10 || ballPosition.x > HALF_LEN + 10 ||
    ballPosition.z < -HALF_WID - 10 || ballPosition.z > HALF_WID + 10) {
    if (ballPosition.y <= ballRadius + 1) {
      if (!gameState.hasScored && gameState.lastShotResult === '') {
        gameState.lastShotResult = '❌ MISSED SHOT';
        showShotFeedback('MISSED SHOT ❌', '#ff0000');
        updateGameUI();
      }
      setTimeout(() => resetBasketball(), 1000);
    }
  }
}

// Backboard collision detection
function checkBackboardCollision() {
  const backboardPositions = [
    { x: HALF_LEN, y: 7, z: 0, width: 5, height: 3 },      // Right backboard
    { x: -HALF_LEN, y: 7, z: 0, width: 5, height: 3 }     // Left backboard
  ];

  for (const backboard of backboardPositions) {
    // Check if ball is near backboard
    const isNearBackboard = Math.abs(ballPosition.z) <= backboard.width / 2 &&
      ballPosition.y >= (backboard.y - backboard.height / 2) &&
      ballPosition.y <= (backboard.y + backboard.height / 2);

    if (isNearBackboard) {
      // Right backboard collision (ball coming from left)
      if (backboard.x > 0 && ballPosition.x >= (backboard.x - ballRadius - 0.1) && ballVelocity.x > 0) {
        ballPosition.x = backboard.x - ballRadius - 0.1;
        ballVelocity.x *= -0.8; // Reverse X velocity with some energy loss
        ballVelocity.y *= 0.9;  // Slight Y velocity reduction
        ballVelocity.z *= 0.9;  // Slight Z velocity reduction
        return;
      }

      // Left backboard collision (ball coming from right)
      if (backboard.x < 0 && ballPosition.x <= (backboard.x + ballRadius + 0.1) && ballVelocity.x < 0) {
        ballPosition.x = backboard.x + ballRadius + 0.1;
        ballVelocity.x *= -0.8; // Reverse X velocity with some energy loss
        ballVelocity.y *= 0.9;  // Slight Y velocity reduction
        ballVelocity.z *= 0.9;  // Slight Z velocity reduction
        return;
      }
    }
  }
}

// Enhanced rim collision detection
function checkRimCollision() {
  const rimPositions = [
    { x: HALF_LEN - 0.8, y: 6, z: 0 },
    { x: -HALF_LEN + 0.8, y: 6, z: 0 }
  ];

  for (const rim of rimPositions) {
    const horizontalDistance = Math.sqrt(
      Math.pow(ballPosition.x - rim.x, 2) +
      Math.pow(ballPosition.z - rim.z, 2)
    );

    // Check if ball hits the rim (not scoring area)
    const isHittingRim = horizontalDistance >= 0.6 && horizontalDistance <= 0.9;
    const isAtRimHeight = Math.abs(ballPosition.y - rim.y) <= 0.3;

    if (isHittingRim && isAtRimHeight) {
      // Ball hits rim - bounce off
      const rimDirection = new THREE.Vector3(
        ballPosition.x - rim.x,
        0,
        ballPosition.z - rim.z
      ).normalize();

      // Bounce away from rim
      const bounceForce = 0.3;
      ballVelocity.x += rimDirection.x * bounceForce;
      ballVelocity.z += rimDirection.z * bounceForce;
      ballVelocity.y *= 0.7; // Reduce upward velocity

      // Move ball away from rim to prevent sticking
      ballPosition.x += rimDirection.x * 0.2;
      ballPosition.z += rimDirection.z * 0.2;
      rimTouchedThisShot = true; // Mark rim as touched for this shot
      return true;
    }
  }
  return false;
}

// Hoop collision and scoring
function checkHoopCollision() {
  // First check if ball hits the rim (not scoring)
  if (checkRimCollision()) {
    // Combo breaks on rim hit
    if (gameState.comboStreak > 0) {
      gameState.comboStreak = 0;
      updateGameUI();
    }
    return; // Ball hit rim, don't check for scoring
  }

  const hoopPositions = [
    { x: HALF_LEN - 0.8, y: 6, z: 0 },
    { x: -HALF_LEN + 0.8, y: 6, z: 0 }
  ];

  for (const hoop of hoopPositions) {
    const dx = ballPosition.x - hoop.x;
    const dz = ballPosition.z - hoop.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

    // Store previous Y position for rim crossing detection
    if (!basketball.userData.prevY) basketball.userData.prevY = ballPosition.y;

    const rimRadius = 0.75;
    const isWithinRim = horizontalDistance < rimRadius * 0.8; // slightly inside rim
    const crossedRim = (basketball.userData.prevY > hoop.y) && (ballPosition.y <= hoop.y);
    const isMovingDown = ballVelocity.y < -0.05;

    if (
      isWithinRim &&
      crossedRim &&
      isMovingDown &&
      !gameState.hasScored
    ) {
      // Score!
      gameState.score += 2;
      gameState.shotsMade++;
      gameState.lastShotResult = '🏀 SHOT MADE!';
      gameState.hasScored = true;

      // Swish detection: bonus if rim was not touched
      if (!rimTouchedThisShot) {
        gameState.score += 3; // Swish bonus
        gameState.lastShotResult += ' SWISH! +3';
        showShotFeedback('SWISH! +3 BONUS!', '#00BFFF');
      }

      // Combo system: increase streak, award bonus
      gameState.comboStreak++;
      if (gameState.comboStreak > gameState.maxCombo) gameState.maxCombo = gameState.comboStreak;
      if (gameState.comboStreak > 1) {
        const comboBonus = gameState.comboStreak; // 2nd shot = +2, 3rd = +3, etc.
        gameState.score += comboBonus;
        gameState.lastShotResult += ` +${comboBonus} COMBO!`;
        showShotFeedback(`COMBO x${gameState.comboStreak}! +${comboBonus} BONUS!`, '#FFD700');
      } else if (rimTouchedThisShot) {
        showShotFeedback('SHOT MADE! 🏀', '#00ff00');
      }
      animateNet(hoop.x, hoop.y, hoop.z);

      // Let the ball fall naturally, slightly slow it for realism
      ballVelocity.y *= 0.9;
      ballVelocity.x *= 0.95;
      ballVelocity.z *= 0.95;

      updateGameUI();
      // Don't return, let the ball keep falling
    }

    // Update previous Y for next frame
    basketball.userData.prevY = ballPosition.y;
  }

  // Missed shot condition
  if (
    ballPosition.y <= ballRadius &&
    ballVelocity.length() < 0.1 &&
    gameState.isShooting &&
    !gameState.hasScored
  ) {
    gameState.lastShotResult = '❌ MISSED SHOT';
    showShotFeedback('MISSED SHOT ❌', '#ff0000');
    gameState.isShooting = false;
    // Reset combo on miss
    if (gameState.comboStreak > 0) {
      gameState.comboStreak = 0;
      updateGameUI();
    }
    updateGameUI();
  }
}

// Show shot feedback
function showShotFeedback(message, color) {
  const statusDisplay = document.getElementById('status-display');
  if (statusDisplay) {
    statusDisplay.innerHTML = message;
    statusDisplay.style.color = color;
    statusDisplay.style.fontSize = '32px';

    setTimeout(() => {
      statusDisplay.innerHTML = '';
    }, 2000);
  }
}

// Shoot basketball
function shootBasketball() {
  if (gameState.isShooting) return;

  gameState.shotAttempts++;
  gameState.isShooting = true;
  gameState.lastShotResult = '';
  gameState.hasScored = false; // Reset scoring flag for new shot
  rimTouchedThisShot = false; // Reset rim touch for new shot

  // Find nearest hoop
  const hoopPositions = [
    { x: HALF_LEN - 0.8, y: 6, z: 0 },
    { x: -HALF_LEN + 0.8, y: 6, z: 0 }
  ];

  let nearestHoop = hoopPositions[0];
  let minDistance = ballPosition.distanceTo(new THREE.Vector3(nearestHoop.x, nearestHoop.y, nearestHoop.z));

  for (const hoop of hoopPositions) {
    const distance = ballPosition.distanceTo(new THREE.Vector3(hoop.x, hoop.y, hoop.z));
    if (distance < minDistance) {
      minDistance = distance;
      nearestHoop = hoop;
    }
  }

  // Calculate trajectory with improved physics
  const target = new THREE.Vector3(nearestHoop.x, nearestHoop.y, nearestHoop.z);
  const direction = target.clone().sub(ballPosition);
  const horizontalDistance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);

  // Improved trajectory calculation
  const powerMultiplier = gameState.shotPower / 100;

  // Calculate the time to reach the target (simplified projectile motion)
  const targetHeight = nearestHoop.y;
  const currentHeight = ballPosition.y;
  const heightDiff = targetHeight - currentHeight;

  // Calculate required initial velocity components
  const time = Math.sqrt(2 * (heightDiff + 3) / Math.abs(gravity)); // Add arc height
  const horizontalSpeed = horizontalDistance / time;
  const verticalSpeed = (heightDiff / time) - (0.5 * gravity * time);

  // Apply power scaling
  const speedMultiplier = 0.8 + (powerMultiplier * 0.6);

  ballVelocity.x = (direction.x / horizontalDistance) * horizontalSpeed * speedMultiplier;
  ballVelocity.z = (direction.z / horizontalDistance) * horizontalSpeed * speedMultiplier;
  ballVelocity.y = verticalSpeed * speedMultiplier;

  // Add slight randomness based on power (more power = more accuracy)
  const accuracy = powerMultiplier;
  const randomFactor = (1 - accuracy) * 0.1;
  ballVelocity.x += (Math.random() - 0.5) * randomFactor;
  ballVelocity.z += (Math.random() - 0.5) * randomFactor;

  updateGameUI();
}

// Reset basketball to center court
function resetBasketball() {
  ballPosition.set(0, 0.7, 0);
  ballVelocity.set(0, 0, 0);
  ballRotation.set(0, 0, 0);
  gameState.isShooting = false;
  gameState.shotPower = 50;
  gameState.lastShotResult = '';
  gameState.hasScored = false; // Reset scoring flag
  rimTouchedThisShot = false; // Reset rim touch on reset
  ballTrail = []; // Clear trail on reset
  updateBallTrailMesh();

  if (basketball) {
    basketball.position.copy(ballPosition);
    basketball.rotation.set(0, 0, 0);
  }

  updateGameUI();
  updatePowerIndicator();
  // Save score to leaderboard if a shot was made or attempted
  if (gameState.shotAttempts > 0 && (gameState.shotsMade > 0 || gameState.score > 0)) {
    addScoreToLeaderboard(gameState.score);
  }
  // Reset game state for new game
  gameState.score = 0;
  gameState.shotAttempts = 0;
  gameState.shotsMade = 0;
  gameState.comboStreak = 0;
  gameState.maxCombo = 0;
  updateGameUI();
}

// BONUS: Create stadium environment
function createStadiumEnvironment() {
  // Create stadium seating with individual seats
  const seatMaterial = new THREE.MeshPhongMaterial({ color: 0x4444ff });
  const stairMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

  // Left side bleachers with individual seats
  for (let row = 0; row < 5; row++) {
    // Create the bleacher platform/stairs
    const platformGeometry = new THREE.BoxGeometry(25, 0.5, 3);
    const platform = new THREE.Mesh(platformGeometry, stairMaterial);
    platform.position.set(0, 0.25 + row * 2, -12 - row * 2);
    platform.castShadow = true;
    platform.receiveShadow = true;
    scene.add(platform);

    // Add individual seats on each row
    for (let seat = 0; seat < 20; seat++) {
      const seatGeometry = new THREE.BoxGeometry(1, 0.8, 1.5);
      const seatMesh = new THREE.Mesh(seatGeometry, seatMaterial);
      seatMesh.position.set(-12 + seat * 1.2, 0.9 + row * 2, -11.5 - row * 2);
      seatMesh.castShadow = true;
      scene.add(seatMesh);

      // Add seat back
      const backGeometry = new THREE.BoxGeometry(1, 1.2, 0.2);
      const backMesh = new THREE.Mesh(backGeometry, seatMaterial);
      backMesh.position.set(-12 + seat * 1.2, 1.5 + row * 2, -12.2 - row * 2);
      backMesh.castShadow = true;
      scene.add(backMesh);
    }
  }

  // Right side bleachers with individual seats
  for (let row = 0; row < 5; row++) {
    // Create the bleacher platform/stairs
    const platformGeometry = new THREE.BoxGeometry(25, 0.5, 3);
    const platform = new THREE.Mesh(platformGeometry, stairMaterial);
    platform.position.set(0, 0.25 + row * 2, 12 + row * 2);
    platform.castShadow = true;
    platform.receiveShadow = true;
    scene.add(platform);

    // Add individual seats on each row
    for (let seat = 0; seat < 20; seat++) {
      const seatGeometry = new THREE.BoxGeometry(1, 0.8, 1.5);
      const seatMesh = new THREE.Mesh(seatGeometry, seatMaterial);
      seatMesh.position.set(-12 + seat * 1.2, 0.9 + row * 2, 11.5 + row * 2);
      seatMesh.castShadow = true;
      seatMesh.receiveShadow = true;
      scene.add(seatMesh);

      // Add seat back
      const backGeometry = new THREE.BoxGeometry(1, 1.2, 0.2);
      const backMesh = new THREE.Mesh(backGeometry, seatMaterial);
      backMesh.position.set(-12 + seat * 1.2, 1.5 + row * 2, 12.2 + row * 2);
      backMesh.receiveShadow = true;
      backMesh.castShadow = true;
      scene.add(backMesh);
    }
  }

  // Scoreboard
  const scoreboardGeometry = new THREE.BoxGeometry(8, 4, 0.5);
  const scoreboardMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const scoreboard = new THREE.Mesh(scoreboardGeometry, scoreboardMaterial);
  scoreboard.position.set(0, 12, 0);
  scoreboard.castShadow = true;
  scene.add(scoreboard);

  // Scoreboard screen
  const screenGeometry = new THREE.BoxGeometry(7, 3, 0.1);
  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x003300 });
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.position.set(0, 12, 0.3);
  scene.add(screen);

  // Add text to scoreboard
  createScoreboardText();
}

// Animate net when ball goes through
function animateNet(hoopX, hoopY, hoopZ) {
  const hoopIndex = hoopX > 0 ? 0 : 1;
  if (!netStrands[hoopIndex]) return;

  let animationTime = 0;
  const animationDuration = 2000; // 2 seconds

  function updateNetAnimation() {
    animationTime += 16; // ~60fps
    const progress = Math.min(animationTime / animationDuration, 1);

    // Create swaying effect
    const swayAmount = Math.sin(progress * Math.PI * 3) * 0.3 * (1 - progress);

    netStrands[hoopIndex].forEach((strand, index) => {
      if (strand.userData && strand.userData.originalPoints) {
        const newPoints = strand.userData.originalPoints.map((point, pointIndex) => {
          const t = pointIndex / (strand.userData.originalPoints.length - 1);

          // Add swaying motion that decreases over time
          const swayX = swayAmount * Math.cos(index * 0.5) * t;
          const swayZ = swayAmount * Math.sin(index * 0.5) * t;

          // Add slight outward push effect
          const pushEffect = (1 - progress) * 0.2 * t;
          const angle = (index / netStrands[hoopIndex].length) * Math.PI * 2;
          const pushX = Math.cos(angle) * pushEffect;
          const pushZ = Math.sin(angle) * pushEffect;

          return new THREE.Vector3(
            point.x + swayX + pushX,
            point.y,
            point.z + swayZ + pushZ
          );
        });

        strand.geometry.setFromPoints(newPoints);
        strand.geometry.attributes.position.needsUpdate = true;
      }
    });

    if (progress < 1) {
      requestAnimationFrame(updateNetAnimation);
    } else {
      // Reset net to original position
      resetNetPosition(hoopIndex);
    }
  }

  updateNetAnimation();
}

// Reset net to original position
function resetNetPosition(hoopIndex) {
  if (!netStrands[hoopIndex]) return;

  netStrands[hoopIndex].forEach(strand => {
    if (strand.userData && strand.userData.originalPoints) {
      strand.geometry.setFromPoints(strand.userData.originalPoints);
      strand.geometry.attributes.position.needsUpdate = true;
    }
  });
}
function createScoreboardText() {
  // Create canvas for text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 512;

  // Clear canvas with black background
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text on canvas with better quality
  context.fillStyle = '#00ff00';
  context.font = 'bold 100px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  // Add glow effect
  context.shadowColor = '#00ff00';
  context.shadowBlur = 10;

  context.fillText('LET THE FUN', 512, 200);
  context.fillText('BEGIN!', 512, 320);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // Create material with the text texture
  const textMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true
  });

  // Create plane for the text
  const textGeometry = new THREE.PlaneGeometry(6, 2.5);
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.position.set(0, 12, 0.4);
  scene.add(textMesh);

  // Create plane for the text
  const textGeometry2 = new THREE.PlaneGeometry(6, 2.5);
  const textMesh2 = new THREE.Mesh(textGeometry2, textMaterial);
  textMesh2.position.set(0, 12, -0.4);
  textMesh2.rotation.y = Math.PI;
  scene.add(textMesh2);
}

// BONUS: Multiple camera preset positions
const cameraPresets = [
  { name: "Overview", position: { x: 0, y: 15, z: 30 }, target: { x: 0, y: 0, z: 0 } },
  { name: "Hoop 1", position: { x: 0, y: 0, z: 0 }, target: { x: 21, y: 6, z: 0 } },
  { name: "Behind Hoop 2", position: { x: -25, y: 8, z: 3 }, target: { x: -21, y: 6, z: 0 } },
  { name: "Top View", position: { x: 0, y: 25, z: 0 }, target: { x: 0, y: 0, z: 0 } }
];

let currentPreset = 0;

function switchCameraPreset() {
  const preset = cameraPresets[currentPreset];
  camera.position.set(preset.position.x, preset.position.y, preset.position.z);

  // Look at the specific target instead of always center court
  if (preset.target) {
    camera.lookAt(preset.target.x, preset.target.y, preset.target.z);
    controls.target.set(preset.target.x, preset.target.y, preset.target.z);
  } else {
    camera.lookAt(0, 0, 0); // Fallback to center court
  }

  currentPreset = (currentPreset + 1) % cameraPresets.length;
}

// Set camera position for better view
const cameraTranslate = new THREE.Matrix4();
cameraTranslate.makeTranslation(0, 15, 30);
camera.applyMatrix4(cameraTranslate);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI / 2;
let isOrbitEnabled = true;

// Handle window resize
function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', handleResize);

// Enhanced keyboard event handling
function handleEnhancedKeyDown(e) {
  switch (e.code) {
    case 'ArrowLeft':
      keys.left = true;
      e.preventDefault();
      break;
    case 'ArrowRight':
      keys.right = true;
      e.preventDefault();
      break;
    case 'ArrowUp':
      keys.up = true;
      e.preventDefault();
      break;
    case 'ArrowDown':
      keys.down = true;
      e.preventDefault();
      break;
    case 'KeyW':
      keys.w = true;
      e.preventDefault();
      break;
    case 'KeyS':
      keys.s = true;
      e.preventDefault();
      break;
    case 'Space':
      e.preventDefault();
      if (!keys.space) {
        keys.space = true;
        shootBasketball();
      }
      break;
    case 'KeyR':
      resetBasketball();
      e.preventDefault();
      break;
    case 'KeyO':
      // Handle orbit toggle
      isOrbitEnabled = !isOrbitEnabled;
      controls.enabled = isOrbitEnabled;
      e.preventDefault();
      break;
    case 'KeyC':
      // Handle camera preset
      switchCameraPreset();
      e.preventDefault();
      break;
  }
}

function handleEnhancedKeyUp(e) {
  switch (e.code) {
    case 'ArrowLeft':
      keys.left = false;
      break;
    case 'ArrowRight':
      keys.right = false;
      break;
    case 'ArrowUp':
      keys.up = false;
      break;
    case 'ArrowDown':
      keys.down = false;
      break;
    case 'KeyW':
      keys.w = false;
      break;
    case 'KeyS':
      keys.s = false;
      break;
    case 'Space':
      keys.space = false;
      break;
  }
}

// Leaderboard logic
function getLeaderboard() {
  const data = localStorage.getItem('basketballLeaderboard');
  return data ? JSON.parse(data) : [];
}
function saveLeaderboard(leaderboard) {
  localStorage.setItem('basketballLeaderboard', JSON.stringify(leaderboard));
}
function addScoreToLeaderboard(score) {
  let leaderboard = getLeaderboard();
  leaderboard.push({ score, date: new Date().toLocaleString() });
  leaderboard = leaderboard.sort((a, b) => b.score - a.score).slice(0, 5); // Top 5
  saveLeaderboard(leaderboard);
}
function renderLeaderboard() {
  let leaderboard = getLeaderboard();
  let html = '<h3 style="margin:0 0 5px 0;">🏆 Leaderboard</h3>';
  if (leaderboard.length === 0) {
    html += '<div>No scores yet.</div>';
  } else {
    html += '<ol style="padding-left:20px; margin:0;">';
    leaderboard.forEach(entry => {
      html += `<li>Score: <b>${entry.score}</b> <span style='font-size:12px;color:#aaa;'>(${entry.date})</span></li>`;
    });
    html += '</ol>';
  }
  return html;
}

// Initialize the interactive basketball game
function initializeInteractiveGame() {
  // Create interactive basketball
  createInteractiveBasketball();

  // Create enhanced UI
  createEnhancedUI();

  // Add event listeners
  document.addEventListener('keydown', handleEnhancedKeyDown);
  document.addEventListener('keyup', handleEnhancedKeyUp);

  // Update initial UI
  updateGameUI();
  updatePowerIndicator();
}

// Enhanced animation loop
function animateInteractiveGame() {
  requestAnimationFrame(animateInteractiveGame);

  // Update basketball movement and physics
  updateBasketballMovement();
  updateBasketballPhysics();

  // Update controls
  if (isOrbitEnabled) {
    controls.update();
  }

  // Ball trail fades out when not shooting
  if (!gameState.isShooting && ballTrail.length > 0) {
    ballTrail.shift();
    updateBallTrailMesh();
  }

  renderer.render(scene, camera);
}

// Create all elements
createBasketballCourt();
createCourtLines();
createCourtBoundary();
createBasketballHoop(HALF_LEN);
createBasketballHoop(-HALF_LEN);
createStadiumEnvironment();

// Initialize interactive features and start the game
initializeInteractiveGame();
animateInteractiveGame();