const http=require('http'),WebSocket=require('ws'),fs=require('fs');
const rooms={};
function code(){return Math.random().toString(36).slice(2,8).toUpperCase()}
const server=http.createServer((req,res)=>{
  if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync('index.html','utf8'));return}
  res.writeHead(404);res.end();
});
const wss=new WebSocket.Server({server});
wss.on('connection',ws=>{
  ws.room=null;ws.id=null;
  ws.on('message',buf=>{
    try{const d=JSON.parse(buf);
    if(d.t==='create'){
      const c=code();rooms[c]={players:[ws],monsters:{}};ws.room=c;ws.id=1;
      ws.send(JSON.stringify({t:'code',code:c}));ws.send(JSON.stringify({t:'start',id:1}));
    }else if(d.t==='join'&&d.code){
      const r=rooms[d.code];if(!r){ws.send(JSON.stringify({t:'invalid'}));return}
      if(r.players.length>=2){ws.send(JSON.stringify({t:'full'}));return}
      ws.room=d.code;ws.id=2;r.players.push(ws);
      ws.send(JSON.stringify({t:'start',id:2}));
      r.players.forEach(p=>p.send(JSON.stringify({t:'joined'})));
    }else if(d.t==='monster'&&ws.room&&d.m){
      rooms[ws.room].monsters[ws.id]=d.m;
      const r=rooms[ws.room];
      r.players.forEach(p=>p.send(JSON.stringify({t:'monster',id:ws.id,m:d.m})));
    }}
    catch(e){}
  });
  ws.on('close',()=>{if(ws.room&&rooms[ws.room]){delete rooms[ws.room].monsters[ws.id];if(rooms[ws.room].players){const i=rooms[ws.room].players.indexOf(ws);if(i>=0)rooms[ws.room].players.splice(i,1)}}}});
});
server.listen(process.env.PORT||3000);
