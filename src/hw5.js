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
const HALF_LEN  = COURT_LEN/2;
const HALF_WID  = COURT_WID/2;

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

function createBasketballNet(x, y, z) {
  const netMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const segments = 12;
  const rimRadius = 0.75;
  const netHeight = 1.5;
  
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

// Create static basketball
function createBasketball() {
  // Basketball sphere
  const ballGeometry = new THREE.SphereGeometry(0.6, 32, 32);
  const ballMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xff6600,
    shininess: 30
  });
  const basketball = new THREE.Mesh(ballGeometry, ballMaterial);
  basketball.position.set(0, 0.7, 0); // Center court, on the ground
  basketball.castShadow = true;
  basketball.receiveShadow = true;
  scene.add(basketball);
  
  // Basketball seams (black lines)
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  
  // Curved seams
  for (let i = 0; i < 4; i++) {
    const seamGeometry = new THREE.TorusGeometry(0.61, 0.02, 4, 16, Math.PI);
    const seam = new THREE.Mesh(seamGeometry, seamMaterial);
    seam.position.copy(basketball.position);
    seam.rotation.y = (i * Math.PI) / 2;
    seam.rotation.z = Math.PI / 2;
    scene.add(seam);
  }
  
  // Horizontal seam
  const horizontalSeamGeometry = new THREE.TorusGeometry(0.61, 0.02, 4, 32, Math.PI * 2);
  const horizontalSeam = new THREE.Mesh(horizontalSeamGeometry, seamMaterial);
  horizontalSeam.position.copy(basketball.position);
  horizontalSeam.rotation.x = Math.PI / 2;
  scene.add(horizontalSeam);
}

// Create UI framework for future features
function createUIFramework() {
  // Score display (top-left)
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
  instructionsElement.style.bottom = '0.0008%';
  instructionsElement.style.left = '20px';
  instructionsElement.style.color = 'white';
  instructionsElement.style.fontSize = '16px';
  instructionsElement.style.fontFamily = 'Arial, sans-serif';
  instructionsElement.style.textAlign = 'left';
  instructionsElement.innerHTML = `
    <h3>Controls:</h3>
    <p>Arrow Keys: Move ball</p>
    <p>W/S: Move forward/backward</p>
    <p>Space: Shoot ball</p>
    <p>R: Reset Ball</p>
    <p>O: Toggle orbit camera</p>
    <p>C: Switch camera presets</p>
  `;
  document.body.appendChild(instructionsElement);
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

// Function to create text on the scoreboard
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

// Create all elements
createBasketballCourt();
createCourtLines();
createCourtBoundary();
createBasketballHoop(HALF_LEN);
createBasketballHoop(-HALF_LEN);
createBasketball();
createUIFramework();
createStadiumEnvironment();

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

// Handle key events
function handleKeyDown(e) {
  if (e.key.toLowerCase() === "o") {
    isOrbitEnabled = !isOrbitEnabled;
    controls.enabled = isOrbitEnabled;
    
    // Update status
    const statusContainer = document.getElementById('status-container');
    if (statusContainer) {
      statusContainer.innerHTML = isOrbitEnabled ? 
        'Status: Orbit controls enabled' : 
        'Status: Orbit controls disabled';
    }
  }
  if (e.key.toLowerCase() === "c") {
    switchCameraPreset();
  }
}

document.addEventListener('keydown', handleKeyDown);

// Animation function
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  if (isOrbitEnabled) {
    controls.update();
  }
  
  renderer.render(scene, camera);
}

animate();