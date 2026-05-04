# ALLUMER LE FEU — 8-bit rugby clarity meeting tool

This is a local multiplayer meeting tool.

## What it does

- Coach opens a full-field 8-bit rugby screen on laptop/projector.
- 15 players are shown with numbers 1–15.
- Players scan QR codes with their phones.
- Each phone becomes a joystick controller for one player.
- Coach controls the ball:
  - Click on the field = move ball
  - Double click a player = attach ball to that player
- Coach can freeze, reset, show/hide grid, and change speed.

## How to run

1. Install Node.js from https://nodejs.org
2. Open Terminal / Command Prompt in this folder.
3. Run:

npm install

4. Then run:

npm start

5. Open the coach screen shown in the terminal, for example:

http://192.168.1.20:3000

6. Project that screen.
7. Click QR Codes.
8. Players scan their number.

## Important

All devices must be on the same Wi-Fi network.

## Coach controls

- Click field: move ball
- Double click player: ball follows that player
- Freeze: freeze/unfreeze all movement
- Reset: reset all players
- Speed slider: change player movement speed

## Recommended meeting use

- 15 players each control one avatar.
- Coach gives a scenario.
- Players must self-organise their spacing.
- Coach freezes and asks questions.
- Coach moves/attaches ball to simulate phase changes.

## Updated pitch version

This version includes a fuller rugby pitch layout with visible 5m, 15m, 22m, 40m and 50m lines. Player sprites are smaller and numbers are clearer.


## QR FIXED VERSION

This version forces QR codes to use the laptop's Wi-Fi IP address instead of localhost.

Phones cannot open localhost from your laptop.
Phones need a link like:
http://10.x.x.x:3000/controller.html?p=1

If phones still cannot connect:
- Make sure laptop and phones are on the same Wi-Fi
- Turn off VPN
- Allow incoming connections for Node if Mac asks
- Club Wi-Fi may block device-to-device connections; use a phone hotspot if needed.
