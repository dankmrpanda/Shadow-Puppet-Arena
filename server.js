const http=require('http'),WebSocket=require('ws'),fs=require('fs');
const rooms={};
const MAX_PLAYERS=6;
const ARENA_W=640,ARENA_H=480;
function code(){return Math.random().toString(36).slice(2,8).toUpperCase()}
const server=http.createServer((req,res)=>{
  if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync('index.html','utf8'));return}
  res.writeHead(404);res.end();
});
const wss=new WebSocket.Server({server});
function startArena(roomCode){
  const r=rooms[roomCode];
  if(!r||r.started)return;
  r.started=true;
  r.monsters={};
  const COLORS=['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
  let idx=0;
  for(const pid of Object.keys(r.monsterData)){
    const m=r.monsterData[pid];
    const baseSize=20+Math.min(m.a/60,30);
    r.monsters[pid]={
      x:100+Math.random()*440,y:80+Math.random()*320,
      vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,
      path:m.p,baseSize:baseSize,size:baseSize,hp:Math.max(50,Math.floor(m.a/30)),maxHp:0,
      spikes:Math.min(m.c,5),stability:Math.min(m.s*3,2),baseSpeed:1+Math.min(m.l*0.3,1.5),speed:0,
      color:COLORS[idx++%6]
    };
    r.monsters[pid].maxHp=r.monsters[pid].hp;
    r.monsters[pid].speed=r.monsters[pid].baseSpeed;
  }
}
function verts(m){
  const s=m.size/40,o=[];
  for(let i=0;i<m.path.length;i++)
    o.push([m.x+(m.path[i][0]*12-120)*s,m.y+(m.path[i][1]*12-120)*s]);
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
  if(!r||!r.monsters)return;
  for(const id of Object.keys(r.monsters)){
    const m=r.monsters[id];
    m.size=Math.max(5,m.baseSize*(m.hp/m.maxHp));
    m.speed=m.baseSpeed*(1+(1-m.hp/m.maxHp)*0.8);
    m.x+=m.vx*m.speed;m.y+=m.vy*m.speed;
    const b=m.size*2;
    if(m.x<b||m.x>ARENA_W-b)m.vx*=-1;
    if(m.y<b||m.y>ARENA_H-b)m.vy*=-1;
    m.x=Math.max(b,Math.min(ARENA_W-b,m.x));
    m.y=Math.max(b,Math.min(ARENA_H-b,m.y));
  }
  for(const id1 of Object.keys(r.monsters)){
    for(const id2 of Object.keys(r.monsters)){
      if(id1>=id2)continue;
      const a=r.monsters[id1],b=r.monsters[id2];
      if(!polyOverlap(a,b))continue;
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||0.1;
      const nx=dx/dist,ny=dy/dist;
      const dmg=Math.max(2,(a.spikes-b.stability)*3);
      a.hp-=dmg;b.hp-=Math.max(2,(b.spikes-a.stability)*3);
      const push=(a.spikes-b.stability)*0.4+(b.spikes-a.stability)*0.4;
      a.vx-=nx*push;a.vy-=ny*push;
      b.vx+=nx*push;b.vy+=ny*push;
      const sep=(a.size+b.size)*0.15;
      a.x-=nx*sep;a.y-=ny*sep;b.x+=nx*sep;b.y+=ny*sep;
    }
  }
  for(const id of Object.keys(r.monsters))
    if(r.monsters[id].hp<=0)delete r.monsters[id];
  const data=JSON.stringify({t:'arena',m:r.monsters});
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
      r.players.forEach(p=>p.send(JSON.stringify({t:'monster',id:ws.id,m:d.m})));
      const ready=Object.keys(r.monsterData).length;
      if(ready>=2&&ready===r.players.length)startArena(ws.room);
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
