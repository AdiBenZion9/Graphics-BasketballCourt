# Computer Graphics - Exercise 6 - Interactive Basketball Shooting Game with Physics

## Group Members
- *Adi Ben Zion 322631201*  
- *Noa Benborhoum 322529447*

## How to Run the Implementation

1. *Clone or download this repository* to your local machine  
2. *Make sure you have Node.js installed* on your system  
3. *Navigate to the project directory* in your terminal  
4. *Start the server* by running:  
   ```bash
   node index.js
5. Open your web browser and go to: [http://localhost:8000](http://localhost:8000)  

### **Controls**
- **Arrow Keys**: Move basketball (left/right/forward/backward)  
- **W/S Keys**: Increase or decrease shot power  
- **Spacebar**: Shoot basketball  
- **R Key**: Reset basketball to center court  
- **O Key**: Toggle orbit camera controls  
- **C Key**: Cycle through camera preset positions  

---
## **Note: to watch the videos attached click on 'view raw' option to download it to your computer

## **New Features Implemented**

### 🏀 **Physics-Based Basketball Mechanics**
- Realistic gravity affecting basketball trajectory  
- Proper arc motion for shooting  
- Bouncing physics with energy loss  
- Ground and hoop collision detection  

### 🎮 **Interactive Controls**
- Arrow keys for moving the basketball around the court  
- W/S keys to adjust shot power (0%–100%) with UI indicator  
- Spacebar to shoot toward the hoop based on direction and power  
- R key to reset basketball position and state  

### 🔄 **Realistic Ball Rotation**
- Smooth ball spin during movement and flight  
- Rotation axis aligns with ball direction  
- Speed of spin scales with ball velocity  

### 🧮 **Comprehensive Scoring System**
- Score detection when ball passes through hoop with downward motion  
- 2 points awarded for each successful shot  
- Real-time shot tracking: attempts, made shots, and accuracy %  
- Visual feedback for success or miss  

### 🖥️ **Enhanced User Interface**
- Live score and shot statistics display  
- Shot power indicator bar  
- Control instructions panel  
- Status messages for shot outcome  

---

## **Bonus Features** 

## **Note: Swish detection feature was implemented before implemeting the ball trail effect feature, so the screenshot of the swish is not containing a trail but you can see it in other screenshots!! thanks!**

### ✨ **Enhanced Stadium Environment**
- Individual blue stadium seats and white platforms  
- 5 rows of bleachers on both sides of the court  
- Center-hung professional scoreboard  

### ✨ **Enhanced Lighting System**
- Directional and spotlight stadium lights  
- Realistic shadow casting for immersive visuals  

### ✨ **Multiple Camera Presets**
- 4 camera angles:  
  - Overview (aerial)  
  - Court-Level (ball perspective)  
  - Behind Hoop 2  
  - Top-Down View  
- 'C' key to switch between views  

### ✨ **Realistic Court Details**
- Accurately scaled court (2:1) with full markings  
- Proper three-point arc and center circle  
- Realistic basketball appearance and detailed net  

### ✨ **Professional UI Framework**
- Scoreboard container at the top  
- Control instructions

### ✨ **Multiple Hoops**
- Ability to shoot at both hoops on the court

- Automatic hoop targeting based on ball position and orientation

### ✨ **Swish Detection**
- Bonus points awarded for clean shots that don't touch the rim

- Visual and scoring feedback for swish shots

### ✨ **Combo System**
- Bonus scoring for consecutive successful shots

- Streak counter with escalating reward multiplier

### ✨ **Ball Trail Effect**
- Visual trail follows the basketball during flight

- Enhances shot tracking and aesthetic feedback

### ✨ **Leaderboard**
High score tracking using local storage

Displays top scores across multiple sessions

Encourages replayability and competition
