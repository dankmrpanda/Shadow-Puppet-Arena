const http=require('http'),WebSocket=require('ws'),fs=require('fs');
const rooms={};
const MAX_PLAYERS=6;
const ARENA_W=640,ARENA_H=480;
const MAX_HP=150,BASE_SIZE=30,MIN_SPEED=0.6,MAX_VEL=4;
function code(){var s='';for(var i=0;i<4;i++)s+='ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0];return s}
const server=http.createServer((req,res)=>{
  const u=req.url.split('?')[0];
  if(u==='/'||u==='/index.html'||u.startsWith('/join/')){res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync('index.html','utf8'));return}
  res.writeHead(404);res.end();
});
const wss=new WebSocket.Server({server});

function spawnPack(r){
  var margin=30;
  var x=r.arenaL+margin+Math.random()*(r.arenaR-r.arenaL-margin*2);
  var y=r.arenaT+margin+Math.random()*(r.arenaB-r.arenaT-margin*2);
  var heal=Math.floor(20+Math.random()*31);
  r.packs.push({x:x,y:y,hp:heal});
}

const COLORS=['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
function startArena(roomCode){
  const r=rooms[roomCode];
  if(!r||r.started)return;
  r.started=true;
  r.monsters={};r.tick=0;r.arenaL=0;r.arenaT=0;r.arenaR=ARENA_W;r.arenaB=ARENA_H;
  r.packs=[];r.blasts=[];
  for(const pid of Object.keys(r.monsterData)){
    const m=r.monsterData[pid];
    const hp=Math.min(MAX_HP,Math.max(60,Math.floor(m.a/25)));
    r.monsters[pid]={
      x:r.arenaL+80+Math.random()*(ARENA_W-160),y:r.arenaT+60+Math.random()*(ARENA_H-120),
      vx:(Math.random()-0.5)*1.2,vy:(Math.random()-0.5)*1.2,
      path:m.p,name:m.n||'???',baseSize:BASE_SIZE,size:BASE_SIZE,hp:hp,maxHp:hp,iframes:0,
      spikes:Math.min(m.c,5),stability:Math.min(m.s*3,2),baseSpeed:0.6+Math.min(m.l*0.1,0.4),speed:0,
      color:r.colors[pid]||'#9b59b6'
    };
    r.monsters[pid].speed=Math.max(MIN_SPEED,r.monsters[pid].baseSpeed);
  }
  spawnPack(r);spawnPack(r);
}
function verts(m){
  const s=m.size/40;let cx=0,cy=0;
  for(let i=0;i<m.path.length;i++){cx+=m.path[i][0]*12;cy+=m.path[i][1]*12}
  cx/=m.path.length;cy/=m.path.length;
  const o=[];
  for(let i=0;i<m.path.length;i++)
    o.push([m.x+(m.path[i][0]*12-cx)*s,m.y+(m.path[i][1]*12-cy)*s]);
  return o;
}
function ptInPoly(px,py,v){
  let n=0;
  for(let i=0,j=v.length-1;i<v.length;j=i++){
    if((v[i][1]>py)!==(v[j][1]>py)&&px<(v[j][0]-v[i][0])*(py-v[i][1])/(v[j][1]-v[i][1])+v[i][0])n++;
  }
  return n%2===1;
}
function polyOverlap(a,b){
  const va=verts(a),vb=verts(b);
  for(let i=0;i<va.length;i++)if(ptInPoly(va[i][0],va[i][1],vb))return true;
  for(let i=0;i<vb.length;i++)if(ptInPoly(vb[i][0],vb[i][1],va))return true;
  return false;
}

function clampBounds(m,r){
  const v=verts(m);
  let mnX=Infinity,mxX=-Infinity,mnY=Infinity,mxY=-Infinity;
  for(let i=0;i<v.length;i++){mnX=Math.min(mnX,v[i][0]);mxX=Math.max(mxX,v[i][0]);mnY=Math.min(mnY,v[i][1]);mxY=Math.max(mxY,v[i][1])}
  if(mnX<r.arenaL){m.x+=r.arenaL-mnX;m.vx=Math.abs(m.vx)+0.1}
  if(mxX>r.arenaR){m.x-=mxX-r.arenaR;m.vx=-(Math.abs(m.vx)+0.1)}
  if(mnY<r.arenaT){m.y+=r.arenaT-mnY;m.vy=Math.abs(m.vy)+0.1}
  if(mxY>r.arenaB){m.y-=mxY-r.arenaB;m.vy=-(Math.abs(m.vy)+0.1)}
}

function tick(roomCode){
  const r=rooms[roomCode];
  if(!r||!r.monsters||r.done)return;
  r.tick=(r.tick||0)+1;
  const logs=[];
  // Speed boost every 6s (375 ticks at 16ms)
  if(r.tick%375===0){
    for(const id of Object.keys(r.monsters))r.monsters[id].baseSpeed+=0.03;
    logs.push('Speed up!');
  }
  // Shrink arena - increments grow over time
  if(r.tick%625===0&&(r.arenaR-r.arenaL)>200){
    var phase=Math.floor(r.tick/625);
    var shrinkX=Math.min(15,5+phase);
    var shrinkY=Math.min(12,4+Math.floor(phase*0.8));
    r.arenaL+=shrinkX;r.arenaT+=shrinkY;r.arenaR-=shrinkX;r.arenaB-=shrinkY;
    if(r.arenaR-r.arenaL<200){r.arenaL=(r.arenaL+r.arenaR)/2-100;r.arenaR=r.arenaL+200}
    if(r.arenaB-r.arenaT<150){r.arenaT=(r.arenaT+r.arenaB)/2-75;r.arenaB=r.arenaT+150}
    logs.push('Arena shrinks!');
    for(const id of Object.keys(r.monsters))clampBounds(r.monsters[id],r);
  }
  // Spawn health pack every 15s (935 ticks), max 3 on field
  if(r.tick%935===0&&r.packs.length<3)spawnPack(r);
  // Process blasts
  var blastFx=[];
  if(r.blasts&&r.blasts.length){
    for(const bl of r.blasts){
      blastFx.push({x:bl.x,y:bl.y});
      for(const id of Object.keys(r.monsters)){
        const m=r.monsters[id];
        const dx=m.x-bl.x,dy=m.y-bl.y;
        const dist=Math.hypot(dx,dy)||1;
        if(dist<337){
          const force=Math.max(2,(337-dist)/10);
          m.vx+=dx/dist*force;m.vy+=dy/dist*force;
        }
      }
      logs.push('BLAST!');
    }
    r.blasts=[];
  }
  for(const id of Object.keys(r.monsters))if(r.monsters[id].iframes>0)r.monsters[id].iframes--;
  for(const id of Object.keys(r.monsters)){
    const m=r.monsters[id];
    m.size=Math.max(8,m.baseSize*(m.hp/m.maxHp));
    m.speed=Math.max(MIN_SPEED,m.baseSpeed*(1+(1-m.hp/m.maxHp)*2));
    m.hp=Math.min(m.hp,m.maxHp);
    // Ensure minimum velocity magnitude
    const curV=Math.hypot(m.vx,m.vy);
    if(curV<MIN_SPEED&&curV>0.01){m.vx=m.vx/curV*MIN_SPEED;m.vy=m.vy/curV*MIN_SPEED}
    else if(curV<=0.01){var a=Math.random()*Math.PI*2;m.vx=Math.cos(a)*MIN_SPEED;m.vy=Math.sin(a)*MIN_SPEED}
    m.x+=m.vx*m.speed;m.y+=m.vy*m.speed;
    clampBounds(m,r);
    // Cap velocity
    const v=Math.hypot(m.vx,m.vy);if(v>MAX_VEL){m.vx=m.vx/v*MAX_VEL;m.vy=m.vy/v*MAX_VEL}
  }
  // Health pack pickup
  for(const id of Object.keys(r.monsters)){
    const m=r.monsters[id];
    for(let pi=r.packs.length-1;pi>=0;pi--){
      const pk=r.packs[pi];
      if(Math.hypot(m.x-pk.x,m.y-pk.y)<m.size+25){
        m.hp=Math.min(m.maxHp,m.hp+pk.hp);
        logs.push(m.name+' +'+pk.hp+'hp!');
        r.packs.splice(pi,1);
      }
    }
  }
  // Collision
  const ids=Object.keys(r.monsters);
  for(let i=0;i<ids.length;i++){
    for(let j=i+1;j<ids.length;j++){
      const a=r.monsters[ids[i]],b=r.monsters[ids[j]];
      if(!a||!b)continue;
      if(!polyOverlap(a,b))continue;
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||0.1;
      const nx=dx/dist,ny=dy/dist;
      // Push always happens
      const push=Math.max(0.15,(a.spikes-b.stability+b.spikes-a.stability)*0.08);
      a.vx-=nx*push;a.vy-=ny*push;
      b.vx+=nx*push;b.vy+=ny*push;
      const sep=(a.size+b.size)*0.1;
      a.x-=nx*sep;a.y-=ny*sep;b.x+=nx*sep;b.y+=ny*sep;
      clampBounds(a,r);clampBounds(b,r);
      // Damage only if no iframes
      if(a.iframes<=0&&b.iframes<=0){
        const dmgA=Math.min(15,Math.max(1,Math.round((b.spikes-a.stability)*3)));
        const dmgB=Math.min(15,Math.max(1,Math.round((a.spikes-b.stability)*3)));
        a.hp-=dmgA;b.hp-=dmgB;a.iframes=20;b.iframes=20;
        logs.push(a.name+' -'+dmgA+' / '+b.name+' -'+dmgB);
      }
    }
  }
  for(const id of Object.keys(r.monsters)){
    if(r.monsters[id].hp<=0){logs.push(r.monsters[id].name+' defeated!');delete r.monsters[id]}
  }
  const alive=Object.keys(r.monsters);
  if(alive.length<=1&&!r.done){
    if(alive.length===1)logs.push(r.monsters[alive[0]].name+' wins!');
    else if(alive.length===0)logs.push('Draw!');
    r.done=true;
    // Schedule restart after 4 seconds
    setTimeout(()=>{
      if(!r||!rooms[roomCode])return;
      r.started=false;r.done=false;r.monsters=null;r.packs=[];r.blasts=[];
      // Keep monsterData so shapes are preserved, but clear ready state
      const saved={};for(const pid of Object.keys(r.monsterData))saved[pid]=r.monsterData[pid];
      r.monsterData={};r.savedShapes=saved;
      r.players.forEach(p=>{if(p.readyState===1)p.send(JSON.stringify({t:'restart'}))});
    },4000);
  }
  const data=JSON.stringify({t:'arena',m:r.monsters,b:[r.arenaL,r.arenaT,r.arenaR,r.arenaB],pk:r.packs,bl:blastFx.length?blastFx:undefined,log:logs.length?logs:undefined});
  r.players.forEach(p=>{if(p.readyState===1)p.send(data)});
}
wss.on('connection',ws=>{
  ws.room=null;ws.id=null;
  ws.on('message',buf=>{
    try{const d=JSON.parse(buf);
    if(d.t==='create'){
      const c=code();
      rooms[c]={players:[ws],monsterData:{},monsters:null,started:false,nextId:2,colors:{},colorIdx:0};
      ws.room=c;ws.id=1;
      rooms[c].colors[1]=COLORS[rooms[c].colorIdx++%6];
      ws.send(JSON.stringify({t:'code',code:c}));
      ws.send(JSON.stringify({t:'start',id:1,color:rooms[c].colors[1]}));
    }else if(d.t==='join'&&d.code){
      const r=rooms[d.code];
      if(!r){ws.send(JSON.stringify({t:'invalid'}));return}
      if(r.players.length>=MAX_PLAYERS){ws.send(JSON.stringify({t:'full'}));return}
      ws.room=d.code;ws.id=r.nextId++;
      r.colors[ws.id]=COLORS[r.colorIdx++%6];
      r.players.push(ws);
      ws.send(JSON.stringify({t:'start',id:ws.id,color:r.colors[ws.id]}));
      r.players.forEach(p=>p.send(JSON.stringify({t:'joined',count:r.players.length})));
    }else if(d.t==='monster'&&ws.room){
      const r=rooms[ws.room];
      if(d.m)r.monsterData[ws.id]=d.m;
      else if(d.reuse&&r.savedShapes&&r.savedShapes[ws.id])r.monsterData[ws.id]=r.savedShapes[ws.id];
      else return;
      const ready=Object.keys(r.monsterData).length;
      r.players.forEach(p=>p.send(JSON.stringify({t:'status',ready:ready,total:r.players.length})));
      if(ready>=2&&ready===r.players.length)startArena(ws.room);
    }else if(d.t==='unready'&&ws.room){
      const r=rooms[ws.room];
      delete r.monsterData[ws.id];
      const ready=Object.keys(r.monsterData).length;
      r.players.forEach(p=>p.send(JSON.stringify({t:'status',ready:ready,total:r.players.length})));
    }else if(d.t==='blast'&&ws.room){
      const r=rooms[ws.room];
      if(r&&r.monsters&&!r.done&&r.monsters[ws.id]){
        if(!r.blasts)r.blasts=[];
        const me=r.monsters[ws.id];
        r.blasts.push({x:me.x,y:me.y,by:ws.id});
      }
    }}
    catch(e){}
  });
  ws.on('close',()=>{
    if(ws.room&&rooms[ws.room]){
      delete rooms[ws.room].monsterData[ws.id];
      if(rooms[ws.room].monsters)delete rooms[ws.room].monsters[ws.id];
      const p=rooms[ws.room].players;
      const i=p.indexOf(ws);
      if(i>=0)p.splice(i,1);
      if(p.length===0)delete rooms[ws.room];
    }
  });
});
setInterval(()=>{for(const c of Object.keys(rooms))tick(c)},16);
server.listen(process.env.PORT||3000);
