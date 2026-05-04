const socket = io();
const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;
let state = null;
let showQr = false;

function fitMouse(e){
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

socket.on("state", s => {
  state = s;
  draw();
});

document.getElementById("resetBtn").onclick = () => socket.emit("coach-reset");
document.getElementById("freezeBtn").onclick = () => {
  if (!state) return;
  socket.emit("coach-freeze", !state.frozen);
};
document.getElementById("gridBtn").onclick = () => {
  if (!state) return;
  socket.emit("coach-grid", !state.showGrid);
};
document.getElementById("speed").oninput = e => socket.emit("coach-speed", e.target.value);

canvas.addEventListener("click", e => {
  const p = fitMouse(e);
  socket.emit("coach-ball", p);
});

canvas.addEventListener("dblclick", e => {
  if (!state) return;
  const p = fitMouse(e);
  let closest = null;
  let best = 9999;
  for (const player of Object.values(state.players)) {
    const d = Math.hypot(player.x - p.x, player.y - p.y);
    if (d < best) { best = d; closest = player; }
  }
  if (closest && best < 60) socket.emit("coach-attach-ball", closest.number);
});

document.getElementById("qrBtn").onclick = async () => {
  const modal = document.getElementById("qrModal");
  modal.classList.remove("hidden");
  const res = await fetch("/api/qrs");
  const data = await res.json();
  const grid = document.getElementById("qrGrid");
  grid.innerHTML = "";
  for (let i=1;i<=15;i++){
    const item = document.createElement("div");
    item.className = "qrItem";
    item.innerHTML = `<div>Player ${i}</div><img src="${data.qrs[i]}"><div>${data.baseUrl}/controller.html?p=${i}</div>`;
    grid.appendChild(item);
  }
};
document.getElementById("closeQr").onclick = () => document.getElementById("qrModal").classList.add("hidden");

function pixelText(text,x,y,size=22,align="center",color="white"){
  ctx.save();
  ctx.font = `900 ${size}px Courier New`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.shadowColor = "#000";
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.fillText(text,x,y);
  ctx.restore();
}


function drawPitch(){
  ctx.fillStyle="#6ec65f";
  ctx.fillRect(0,0,W,H);

  const left = 70;
  const right = W - 70;
  const top = 70;
  const bottom = H - 70;
  const pw = right - left;
  const ph = bottom - top;

  // Outer field
  ctx.strokeStyle="#fff";
  ctx.lineWidth=7;
  ctx.strokeRect(left, top, pw, ph);

  // Helper functions: X based on field length %, Y based on width %
  const X = pct => left + pw * pct;
  const Y = pct => top + ph * pct;

  // In-goal / try lines / dead-ball feel
  ctx.lineWidth=5;
  ctx.strokeStyle="#fff";

  // Try lines
  ctx.beginPath(); ctx.moveTo(X(0.06), top); ctx.lineTo(X(0.06), bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.94), top); ctx.lineTo(X(0.94), bottom); ctx.stroke();

  // 5m from try line
  ctx.setLineDash([16,14]);
  ctx.beginPath(); ctx.moveTo(X(0.10), top); ctx.lineTo(X(0.10), bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.90), top); ctx.lineTo(X(0.90), bottom); ctx.stroke();

  // 22m lines
  ctx.setLineDash([]);
  ctx.lineWidth=6;
  ctx.beginPath(); ctx.moveTo(X(0.26), top); ctx.lineTo(X(0.26), bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.74), top); ctx.lineTo(X(0.74), bottom); ctx.stroke();

  // 10m / 40m style dotted lines around halfway
  ctx.setLineDash([20,16]);
  ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(X(0.40), top); ctx.lineTo(X(0.40), bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.60), top); ctx.lineTo(X(0.60), bottom); ctx.stroke();

  // Halfway
  ctx.setLineDash([]);
  ctx.lineWidth=6;
  ctx.beginPath(); ctx.moveTo(X(0.50), top); ctx.lineTo(X(0.50), bottom); ctx.stroke();

  // 5m and 15m channels from touchlines
  ctx.setLineDash([18,16]);
  ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(left, Y(0.08)); ctx.lineTo(right, Y(0.08)); ctx.stroke(); // 5m top
  ctx.beginPath(); ctx.moveTo(left, Y(0.92)); ctx.lineTo(right, Y(0.92)); ctx.stroke(); // 5m bottom

  ctx.beginPath(); ctx.moveTo(left, Y(0.23)); ctx.lineTo(right, Y(0.23)); ctx.stroke(); // 15m top
  ctx.beginPath(); ctx.moveTo(left, Y(0.77)); ctx.lineTo(right, Y(0.77)); ctx.stroke(); // 15m bottom
  ctx.setLineDash([]);

  // Optional tactical grid
  if(state?.showGrid){
    ctx.strokeStyle="rgba(255,255,255,.13)";
    ctx.lineWidth=1;
    for(let x=left;x<=right;x+=70){ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}
    for(let y=top;y<=bottom;y+=70){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
  }

  // Labels
  ctx.save();
  ctx.fillStyle="#fff";
  ctx.font="900 18px Courier New";
  ctx.textAlign="center";
  ctx.shadowColor="#000";
  ctx.shadowOffsetX=3;
  ctx.shadowOffsetY=3;

  [["5m",0.10],["22m",0.26],["40m",0.40],["50m",0.50],["40m",0.60],["22m",0.74],["5m",0.90]].forEach(([label,p])=>{
    ctx.fillText(label, X(p), top-14);
    ctx.fillText(label, X(p), bottom+32);
  });

  ctx.textAlign="left";
  ctx.fillText("5m", left+8, Y(0.08)-8);
  ctx.fillText("15m", left+8, Y(0.23)-8);
  ctx.fillText("15m", left+8, Y(0.77)-8);
  ctx.fillText("5m", left+8, Y(0.92)-8);

  ctx.textAlign="right";
  ctx.fillText("5m", right-8, Y(0.08)-8);
  ctx.fillText("15m", right-8, Y(0.23)-8);
  ctx.fillText("15m", right-8, Y(0.77)-8);
  ctx.fillText("5m", right-8, Y(0.92)-8);
  ctx.restore();

  // Top bar
  ctx.fillStyle="#d71920";
  ctx.fillRect(0,0,W,52);
  ctx.fillStyle="#111";
  ctx.fillRect(0,52,W,8);
  pixelText("ALLUMER LE FEU",W/2,37,30,"center","#fff");

  if(state?.frozen){
    ctx.fillStyle="rgba(0,0,0,.35)";
    ctx.fillRect(0,0,W,H);
    pixelText("FREEZE",W/2,H/2,90,"center","#fff");
  }
}

function drawBall(ball){
  ctx.save();
  ctx.translate(ball.x,ball.y);
  ctx.rotate(-0.35);
  ctx.fillStyle="#4b2a1b";ctx.fillRect(-22,-10,44,20);ctx.fillRect(-16,-15,32,30);ctx.fillRect(-8,-19,16,38);
  ctx.fillStyle="#9b552f";ctx.fillRect(-16,-8,32,16);ctx.fillRect(-10,-12,20,24);
  ctx.fillStyle="#fff";ctx.fillRect(-18,-6,5,12);ctx.fillRect(13,-6,5,12);ctx.fillRect(-2,-10,4,20);ctx.fillRect(-10,-2,20,4);
  ctx.restore();
}


function drawPlayer(p){
  ctx.save();
  ctx.translate(p.x,p.y);

  // 50% smaller player sprite, but large clear number
  const s = 0.55;
  ctx.scale(s,s);

  ctx.fillStyle="rgba(0,0,0,.25)";
  ctx.fillRect(-24,30,48,8);

  // Body
  ctx.fillStyle=p.color;
  ctx.fillRect(-22,-24,44,50);

  // LOU stripes
  ctx.fillStyle="#fff";
  ctx.fillRect(-15,-11,30,5);
  ctx.fillRect(-15,2,30,5);

  // Legs
  ctx.fillStyle="#111";
  ctx.fillRect(-16,22,11,26);
  ctx.fillRect(5,22,11,26);

  // Head
  ctx.fillStyle="#c88b62";
  ctx.fillRect(-18,-56,36,34);

  // Hair
  ctx.fillStyle="#15100c";
  if(p.number <= 8){
    ctx.fillRect(-27,-66,54,14);
    ctx.fillRect(-31,-54,12,22);
    ctx.fillRect(19,-54,12,22);
  } else {
    ctx.fillRect(-20,-66,40,12);
  }

  // Face/beard
  ctx.fillStyle="#2a1a12";
  ctx.fillRect(-11,-37,22,8);
  ctx.fillRect(-7,-30,14,5);
  ctx.fillStyle="#000";
  ctx.fillRect(-9,-48,5,5);
  ctx.fillRect(5,-48,5,5);

  // Big visible number plate on back/chest
  ctx.fillStyle="#fff";
  ctx.fillRect(-18,-20,36,34);
  ctx.strokeStyle="#111";
  ctx.lineWidth=3;
  ctx.strokeRect(-18,-20,36,34);

  ctx.fillStyle="#111";
  ctx.font="900 28px Courier New";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(p.number,0,-2);

  ctx.restore();

  // Connection status dot + number label below
  ctx.fillStyle = p.connected ? "#00ff7f" : "#ffdf4d";
  ctx.beginPath();
  ctx.arc(p.x+18,p.y-30,7,0,Math.PI*2);
  ctx.fill();

  pixelText(String(p.number), p.x, p.y+45, 18, "center", "#fff");
}

function draw(){
  if(!state) return;
  drawPitch();
  Object.values(state.players).forEach(drawPlayer);
  drawBall(state.ball);
  pixelText("Click field = move ball | Double click player = attach ball | QR Codes = phones",W/2,H-18,20,"center","#fff");
}