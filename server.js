const http=require('http'),WebSocket=require('ws'),fs=require('fs');
const rooms={};
const MAX_PLAYERS=6;
const ARENA_W=400,ARENA_H=300;
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
    const size=15+Math.min(m.a/80,25);
    r.monsters[pid]={
      x:80+Math.random()*240,y:60+Math.random()*180,
      vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,
      path:m.p,size:size,
      spikes:Math.min(m.c,5),stability:Math.min(m.s*3,2),speed:1+Math.min(m.l*0.3,1.5),
      color:COLORS[idx++%6]
    };
  }
}
function tick(roomCode){
  const r=rooms[roomCode];
  if(!r||!r.monsters)return;
  for(const id of Object.keys(r.monsters)){
    const m=r.monsters[id];
    m.x+=m.vx*m.speed;m.y+=m.vy*m.speed;
    if(m.x<m.size||m.x>ARENA_W-m.size)m.vx*=-1;
    if(m.y<m.size||m.y>ARENA_H-m.size)m.vy*=-1;
    m.x=Math.max(m.size,Math.min(ARENA_W-m.size,m.x));
    m.y=Math.max(m.size,Math.min(ARENA_H-m.size,m.y));
  }
  for(const id1 of Object.keys(r.monsters)){
    for(const id2 of Object.keys(r.monsters)){
      if(id1>=id2)continue;
      const a=r.monsters[id1],b=r.monsters[id2];
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
      if(dist<a.size+b.size+5){
        const nx=dx/dist,ny=dy/dist;
        const push=(a.spikes-b.stability)*0.5+(b.spikes-a.stability)*0.5;
        a.vx-=nx*push;a.vy-=ny*push;
        b.vx+=nx*push;b.vy+=ny*push;
        const overlap=(a.size+b.size)-dist;
        a.x-=nx*overlap/2;a.y-=ny*overlap/2;
        b.x+=nx*overlap/2;b.y+=ny*overlap/2;
      }
    }
  }
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
