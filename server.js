import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import selfsigned from "selfsigned";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const app=express();
const cameras=new Map();

function getLanIPv4(){
  const nets=os.networkInterfaces();
  for(const name of Object.keys(nets)){
    for(const n of nets[name]||[]){
      if(n.family==="IPv4" && !n.internal && !n.address.startsWith("127.")) return n.address;
    }
  }
  return "127.0.0.1";
}

const LAN_IP=process.env.LAN_IP||getLanIPv4();
const HTTP_PORT=Number(process.env.PORT||3000);
const HTTPS_PORT=Number(process.env.HTTPS_PORT||3443);
const isProduction=process.env.NODE_ENV==="production";
const certDir=path.join(__dirname,"certs");
const keyPath=path.join(certDir,"lan-key.pem");
const certPath=path.join(certDir,"lan-cert.pem");

function ensureCertificate(){
  fs.mkdirSync(certDir,{recursive:true});
  if(fs.existsSync(keyPath)&&fs.existsSync(certPath)) return;
  const attrs=[{name:"commonName",value:LAN_IP}];
  const altNames=[
    {type:2,value:"localhost"},
    {type:7,ip:"127.0.0.1"},
    {type:7,ip:LAN_IP}
  ];
  const pems=selfsigned.generate(attrs,{
    keySize:2048,
    algorithm:"sha256",
    days:825,
    extensions:[
      {name:"basicConstraints",cA:true},
      {name:"keyUsage",keyUsage:["keyCertSign","digitalSignature","keyEncipherment"]},
      {name:"subjectAltName",altNames}
    ]
  });
  fs.writeFileSync(keyPath,pems.private);
  fs.writeFileSync(certPath,pems.cert);
}

if(!isProduction) ensureCertificate();

app.use(express.static(path.join(__dirname,"public")));
app.get("/health",(_req,res)=>res.json({ok:true,version:"0.3.3"}));
app.get("/cert.pem",(req,res)=>{
  res.type("application/x-pem-file");
  res.download(certPath,"phone-webcam-lan-cert.pem");
});

function makeIo(server){
  const io=new Server(server);
  function emitCameraList(room){
    io.to(room).emit("camera-list",[...cameras.values()].filter(c=>c.room===room));
  }
  io.on("connection",socket=>{
    socket.on("register",({role,room="STUDIO",cameraName=""}={})=>{
      socket.join(room);
      socket.data.role=role;
      socket.data.room=room;
      if(role==="camera"){
        cameras.set(socket.id,{
          id:socket.id,name:cameraName||`CAM-${socket.id.slice(0,4).toUpperCase()}`,
          room,active:false,resolution:"",fps:"",audio:false
        });
        emitCameraList(room);
      }
    });
    socket.on("request-camera",({cameraId})=>{
      const c=io.sockets.sockets.get(cameraId);
      if(c)c.emit("viewer-request",{viewerId:socket.id});
    });
    socket.on("signal",({to,data})=>{
      if(to)io.to(to).emit("signal",{from:socket.id,data});
    });
    socket.on("camera-status",status=>{
      const c=cameras.get(socket.id);
      if(c){Object.assign(c,status,{audio:false});emitCameraList(c.room);}
    });
    socket.on("disconnect",()=>{
      const c=cameras.get(socket.id);
      if(c){cameras.delete(socket.id);emitCameraList(c.room);}
    });
  });
  return io;
}

const httpServer=http.createServer(app);
makeIo(httpServer);
httpServer.listen(HTTP_PORT,"0.0.0.0",()=>{
  console.log(`HTTP  : http://${LAN_IP}:${HTTP_PORT}`);
});

if(!isProduction){
const httpsServer=https.createServer({
  key:fs.readFileSync(keyPath),
  cert:fs.readFileSync(certPath)
},app);
makeIo(httpsServer);
httpsServer.listen(HTTPS_PORT,"0.0.0.0",()=>{
  console.log(`HTTPS : https://${LAN_IP}:${HTTPS_PORT}`);
  console.log(`Cert  : https://${LAN_IP}:${HTTPS_PORT}/cert.pem`);
});
}
