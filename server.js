const http=require('http'),WebSocket=require('ws'),fs=require('fs');
const rooms={};
const MAX_PLAYERS=6;
const ARENA_W=640,ARENA_H=480;
function code(){var s='';for(var i=0;i<4;i++)s+='ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0];return s}
const server=http.createServer((req,res)=>{
  const u=req.url.split('?')[0];
  if(u==='/'||u==='/index.html'||u.startsWith('/join/')){res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync('index.html','utf8'));return}
  res.writeHead(404);res.end();
});
const wss=new WebSocket.Server({server});
const MAX_HP=150,BASE_SIZE=30;
function startArena(roomCode){
  const r=rooms[roomCode];
  if(!r||r.started)return;
  r.started=true;
  r.monsters={};r.tick=0;r.arenaL=0;r.arenaT=0;r.arenaR=ARENA_W;r.arenaB=ARENA_H;r.lastWallTouch=0;
  const COLORS=['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
  let idx=0;
  for(const pid of Object.keys(r.monsterData)){
    const m=r.monsterData[pid];
    const hp=Math.min(MAX_HP,Math.max(60,Math.floor(m.a/25)));
    r.monsters[pid]={
      x:r.arenaL+80+Math.random()*(ARENA_W-160),y:r.arenaT+60+Math.random()*(ARENA_H-120),
      vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,
      path:m.p,name:m.n||'???',baseSize:BASE_SIZE,size:BASE_SIZE,hp:hp,maxHp:hp,iframes:0,
      spikes:Math.min(m.c,5),stability:Math.min(m.s*3,2),baseSpeed:1+Math.min(m.l*0.3,1.5),speed:0,
      color:COLORS[idx++%6]
    };
    r.monsters[pid].speed=r.monsters[pid].baseSpeed;
  }
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
function tick(roomCode){
  const r=rooms[roomCode];
  if(!r||!r.monsters||r.done)return;
  r.tick=(r.tick||0)+1;
  const logs=[];
  // Speed boost every 6s (75 ticks at 80ms)
  if(r.tick%75===0){
    for(const id of Object.keys(r.monsters))r.monsters[id].baseSpeed+=0.15;
    logs.push('Speed up!');
  }
  // Shrink arena every 10s (125 ticks)
  if(r.tick%125===0&&(r.arenaR-r.arenaL)>200){
    r.arenaL+=5;r.arenaT+=4;r.arenaR-=5;r.arenaB-=4;
    logs.push('Arena shrinks!');
    // Push monsters inward if border crossed them
    for(const id of Object.keys(r.monsters)){
      const m=r.monsters[id],pad=3;
      if(m.x<r.arenaL+pad){m.x=r.arenaL+pad;m.vx=Math.abs(m.vx)}
      if(m.x>r.arenaR-pad){m.x=r.arenaR-pad;m.vx=-Math.abs(m.vx)}
      if(m.y<r.arenaT+pad){m.y=r.arenaT+pad;m.vy=Math.abs(m.vy)}
      if(m.y>r.arenaB-pad){m.y=r.arenaB-pad;m.vy=-Math.abs(m.vy)}
    }
  }
  // Tick down iframes
  for(const id of Object.keys(r.monsters))if(r.monsters[id].iframes>0)r.monsters[id].iframes--;
  for(const id of Object.keys(r.monsters)){
    const m=r.monsters[id];
    m.size=Math.max(8,m.baseSize*(m.hp/m.maxHp));
    m.speed=m.baseSpeed*(1+(1-m.hp/m.maxHp)*2.5);
    m.hp=Math.min(m.hp,m.maxHp);
    m.x+=m.vx*m.speed;m.y+=m.vy*m.speed;
    const pad=3;
    if(m.x<r.arenaL+pad){m.vx=Math.abs(m.vx);m.x=r.arenaL+pad}
    if(m.x>r.arenaR-pad){m.vx=-Math.abs(m.vx);m.x=r.arenaR-pad}
    if(m.y<r.arenaT+pad){m.vy=Math.abs(m.vy);m.y=r.arenaT+pad}
    if(m.y>r.arenaB-pad){m.vy=-Math.abs(m.vy);m.y=r.arenaB-pad}
    // Cap velocity
    const v=Math.hypot(m.vx,m.vy);if(v>6){m.vx=m.vx/v*6;m.vy=m.vy/v*6}
  }
  const ids=Object.keys(r.monsters);
  for(let i=0;i<ids.length;i++){
    for(let j=i+1;j<ids.length;j++){
      const a=r.monsters[ids[i]],b=r.monsters[ids[j]];
      if(!a||!b)continue;
      if(a.iframes>0||b.iframes>0)continue;
      if(!polyOverlap(a,b))continue;
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||0.1;
      const nx=dx/dist,ny=dy/dist;
      const dmgA=Math.min(15,Math.max(1,Math.round((b.spikes-a.stability)*3)));
      const dmgB=Math.min(15,Math.max(1,Math.round((a.spikes-b.stability)*3)));
      a.hp-=dmgA;b.hp-=dmgB;
      a.iframes=8;b.iframes=8;
      logs.push(a.name+' -'+dmgA+' / '+b.name+' -'+dmgB);
      const push=Math.max(0.5,(a.spikes-b.stability+b.spikes-a.stability)*0.3);
      a.vx-=nx*push;a.vy-=ny*push;
      b.vx+=nx*push;b.vy+=ny*push;
      const sep=(a.size+b.size)*0.25;
      a.x-=nx*sep;a.y-=ny*sep;b.x+=nx*sep;b.y+=ny*sep;
    }
  }
  for(const id of Object.keys(r.monsters)){
    if(r.monsters[id].hp<=0){logs.push(r.monsters[id].name+' defeated!');delete r.monsters[id]}
  }
  const alive=Object.keys(r.monsters);
  if(alive.length<=1){
    if(alive.length===1)logs.push(r.monsters[alive[0]].name+' wins!');
    else if(alive.length===0)logs.push('Draw!');
    r.done=true;
  }
  const data=JSON.stringify({t:'arena',m:r.monsters,b:[r.arenaL,r.arenaT,r.arenaR,r.arenaB],log:logs.length?logs:undefined});
  r.players.forEach(p=>{if(p.readyState===1)p.send(data)});
}
wss.on('connection',ws=>{
  ws.room=null;ws.id=null;
  ws.on('message',buf=>{
    try{const d=JSON.parse(buf);
    if(d.t==='create'){
      const c=code();
      rooms[c]={players:[ws],monsterData:{},monsters:null,started:false,nextId:2};
      ws.room=c;ws.id=1;
      ws.send(JSON.stringify({t:'code',code:c}));
      ws.send(JSON.stringify({t:'start',id:1}));
    }else if(d.t==='join'&&d.code){
      const r=rooms[d.code];
      if(!r){ws.send(JSON.stringify({t:'invalid'}));return}
      if(r.players.length>=MAX_PLAYERS){ws.send(JSON.stringify({t:'full'}));return}
      ws.room=d.code;ws.id=r.nextId++;
      r.players.push(ws);
      ws.send(JSON.stringify({t:'start',id:ws.id}));
      r.players.forEach(p=>p.send(JSON.stringify({t:'joined',count:r.players.length})));
    }else if(d.t==='monster'&&ws.room&&d.m){
      const r=rooms[ws.room];
      r.monsterData[ws.id]=d.m;
      const ready=Object.keys(r.monsterData).length;
      r.players.forEach(p=>p.send(JSON.stringify({t:'status',ready:ready,total:r.players.length})));
      if(ready>=2&&ready===r.players.length)startArena(ws.room);
    }else if(d.t==='unready'&&ws.room){
      const r=rooms[ws.room];
      delete r.monsterData[ws.id];
      const ready=Object.keys(r.monsterData).length;
      r.players.forEach(p=>p.send(JSON.stringify({t:'status',ready:ready,total:r.players.length})));
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
setInterval(()=>{for(const c of Object.keys(rooms))tick(c)},80);
server.listen(process.env.PORT||3000);
