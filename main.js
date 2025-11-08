// 俄罗斯方块 - 简洁实现
// 网格 10 x 20, 每格大小 24px（canvas 240x480）

const COLS = 10;
const ROWS = 20;
const TILE = 24; // 视觉用，逻辑按格

const COLORS = {
  I: '#65e0ff',
  J: '#6a8dff',
  L: '#ffb15e',
  O: '#ffd95e',
  S: '#64e39f',
  T: '#c47bff',
  Z: '#ff7f7f',
  X: '#2a356f', // 固定块填充色
};

const SHAPES = {
  // 每个形状一组旋转矩阵
  I: [
    [ [0,1],[1,1],[2,1],[3,1] ],
    [ [2,0],[2,1],[2,2],[2,3] ],
    [ [0,2],[1,2],[2,2],[3,2] ],
    [ [1,0],[1,1],[1,2],[1,3] ],
  ],
  J: [
    [ [0,0],[0,1],[1,1],[2,1] ],
    [ [1,0],[2,0],[1,1],[1,2] ],
    [ [0,1],[1,1],[2,1],[2,2] ],
    [ [1,0],[1,1],[0,2],[1,2] ],
  ],
  L: [
    [ [2,0],[0,1],[1,1],[2,1] ],
    [ [1,0],[1,1],[1,2],[2,2] ],
    [ [0,1],[1,1],[2,1],[0,2] ],
    [ [0,0],[1,0],[1,1],[1,2] ],
  ],
  O: [
    [ [1,0],[2,0],[1,1],[2,1] ],
    [ [1,0],[2,0],[1,1],[2,1] ],
    [ [1,0],[2,0],[1,1],[2,1] ],
    [ [1,0],[2,0],[1,1],[2,1] ],
  ],
  S: [
    [ [1,0],[2,0],[0,1],[1,1] ],
    [ [1,0],[1,1],[2,1],[2,2] ],
    [ [1,1],[2,1],[0,2],[1,2] ],
    [ [0,0],[0,1],[1,1],[1,2] ],
  ],
  T: [
    [ [1,0],[0,1],[1,1],[2,1] ],
    [ [1,0],[1,1],[2,1],[1,2] ],
    [ [0,1],[1,1],[2,1],[1,2] ],
    [ [1,0],[0,1],[1,1],[1,2] ],
  ],
  Z: [
    [ [0,0],[1,0],[1,1],[2,1] ],
    [ [2,0],[1,1],[2,1],[1,2] ],
    [ [0,1],[1,1],[1,2],[2,2] ],
    [ [1,0],[0,1],[1,1],[0,2] ],
  ],
};

const PIECES = Object.keys(SHAPES);

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
ctx.scale(TILE/24, TILE/24); // 逻辑 24 基准，缩放适应样式

let grid = createGrid(COLS, ROWS);
let current = null;
let nextDrop = 0;
let dropInterval = 800; // ms, 随等级加速
let running = true;
let score = 0;
let lines = 0;
let level = 1;

const ui = {
  score: document.getElementById('score'),
  lines: document.getElementById('lines'),
  level: document.getElementById('level'),
};

spawn();
update(0);
bindControls();
render();

function createGrid(w, h){
  return Array.from({length: h}, () => Array(w).fill(null));
}

function spawn(){
  const type = PIECES[Math.floor(Math.random()*PIECES.length)];
  current = {
    type,
    rot: 0,
    x: 3,
    y: -2, // 从顶部外生成，便于缓冲
  };
  if (collide(current, grid)) {
    // 游戏结束
    running = false;
    toast('游戏结束，R 重开');
  }
}

function cells(piece){
  return SHAPES[piece.type][piece.rot].map(([cx, cy]) => [piece.x + cx, piece.y + cy]);
}

function within(x,y){ return x>=0 && x<COLS && y<ROWS; }

function collide(piece, g){
  return cells(piece).some(([x,y]) => {
    if (y < 0) return false; // 还在顶部缓冲区
    if (!within(x,y)) return true;
    return g[y][x] !== null;
  });
}

function merge(piece){
  for (const [x,y] of cells(piece)){
    if (y>=0 && y<ROWS && x>=0 && x<COLS) {
      grid[y][x] = piece.type;
    }
  }
}

function rotate(dir){
  if (!running) return;
  const p = {...current, rot: (current.rot + (dir>0?1:3)) % 4};
  // 简单踢墙：尝试左右偏移
  const kicks = [0, -1, 1, -2, 2];
  for (const dx of kicks){
    const t = {...p, x: p.x + dx};
    if (!collide(t, grid)) { current = t; return; }
  }
}

function move(dx){
  if (!running) return;
  const t = {...current, x: current.x + dx};
  if (!collide(t, grid)) current = t;
}

function softDrop(){
  if (!running) return;
  const t = {...current, y: current.y + 1};
  if (!collide(t, grid)) {
    current = t;
  } else {
    lockPiece();
  }
}

function hardDrop(){
  if (!running) return;
  let t = {...current};
  while(!collide({...t, y: t.y + 1}, grid)) t.y++;
  current = t;
  lockPiece();
}

function lockPiece(){
  merge(current);
  const cleared = sweepLines();
  if (cleared > 0){
    const scoring = [0, 100, 300, 500, 800];
    score += scoring[cleared] * level;
    lines += cleared;
    const nextLevel = 1 + Math.floor(lines / 10);
    if (nextLevel !== level){
      level = nextLevel;
      dropInterval = Math.max(120, 800 - (level-1) * 60);
    }
    updateHUD();
  }
  spawn();
}

function sweepLines(){
  let removed = 0;
  for (let y = ROWS-1; y >= 0; y--){
    if (grid[y].every(c => c !== null)){
      grid.splice(y,1);
      grid.unshift(Array(COLS).fill(null));
      removed++;
      y++; // 该行下移后再检查同一索引
    }
  }
  return removed;
}

function drawCell(x,y,color){
  const px = x*TILE, py = y*TILE;
  // 方块带一点光影
  ctx.fillStyle = color;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fillRect(px, py, TILE, 4);
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.fillRect(px, py+TILE-4, TILE, 4);
}

function render(){
  // 背景格
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let y=0;y<ROWS;y++){
    for (let x=0;x<COLS;x++){
      ctx.fillStyle = '#0b1130';
      ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
      ctx.strokeStyle = '#11193d';
      ctx.strokeRect(x*TILE+.5, y*TILE+.5, TILE-1, TILE-1);
      const cell = grid[y][x];
      if (cell) drawCell(x,y,COLORS[cell]);
    }
  }
  // 当前下落块
  if (current){
    for (const [x,y] of cells(current)){
      if (y>=0) drawCell(x,y,COLORS[current.type]);
    }
  }
}

function update(t){
  if (running){
    if (t > nextDrop){
      softDrop();
      nextDrop = t + dropInterval;
    }
    render();
  }
  requestAnimationFrame(update);
}

function updateHUD(){
  ui.score.textContent = String(score);
  ui.lines.textContent = String(lines);
  ui.level.textContent = String(level);
}

function reset(){
  grid = createGrid(COLS, ROWS);
  score = 0; lines = 0; level = 1; dropInterval = 800;
  running = true;
  spawn();
  updateHUD();
  toast('新游戏开始');
}

function bindControls(){
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') { e.preventDefault(); move(-1); render(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); move(1); render(); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); softDrop(); render(); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); rotate(1); render(); }
    else if (e.code === 'Space') { e.preventDefault(); hardDrop(); render(); }
    else if (e.code === 'KeyP') { togglePause(); }
    else if (e.code === 'KeyR') { reset(); }
  });

  // 触屏按钮
  const $ = (id) => document.getElementById(id);
  $('#btn-left').onclick = () => { move(-1); render(); };
  $('#btn-right').onclick = () => { move(1); render(); };
  $('#btn-rotate').onclick = () => { rotate(1); render(); };
  $('#btn-down').onclick = () => { softDrop(); render(); };
  $('#btn-hard').onclick = () => { hardDrop(); render(); };
  $('#btn-pause').onclick = () => { togglePause(); };
  $('#btn-restart').onclick = () => { reset(); };
}

function togglePause(){
  running = !running;
  toast(running ? '继续' : '已暂停');
}

// 简单顶部提示
let toastTimer = null;
function toast(text){
  let el = document.getElementById('toast');
  if (!el){
    el = document.createElement('div');
    el.id = 'toast';
    Object.assign(el.style, {
      position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(10,14,32,.9)', color: '#e8ecff', border: '1px solid #2a356f',
      padding: '8px 12px', borderRadius: '8px', zIndex: 99, fontSize: '14px',
      boxShadow: '0 6px 18px rgba(0,0,0,.35)'
    });
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.style.opacity = '0'; }, 1200);
}

updateHUD();
