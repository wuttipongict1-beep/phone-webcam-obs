import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

const root = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(root, "certs");
const keyFile = path.join(certDir, "lan-key.pem");
const certFile = path.join(certDir, "lan-cert.pem");

if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  console.error("ยังไม่มี HTTPS certificate");
  console.error("รันก่อน: npm run setup:https");
  process.exit(1);
}

const app = express();
app.use(express.static(path.join(root, "public")));

const server = https.createServer({
  key: fs.readFileSync(keyFile),
  cert: fs.readFileSync(certFile)
}, app);

const io = new Server(server);
const cameras = new Map();

const list = room => [...cameras.values()].filter(c => c.room === room);
const broadcast = room => io.to(room).emit("camera-list", list(room));

app.get("/health", (_req,res) =>
  res.json({ok:true,version:"0.3.3",secure:true,cameras:cameras.size})
);

io.on("connection", socket => {
  socket.on("register", ({role,room="STUDIO",cameraName=""}={}) => {
    socket.join(room);
    socket.data.room=room;
    socket.data.role=role;
    if(role==="camera"){
      cameras.set(socket.id,{
        id:socket.id,
        name:cameraName || `CAM-${socket.id.slice(0,4).toUpperCase()}`,
        room,active:false,resolution:"",fps:"",audio:false
      });
      broadcast(room);
    }
  });

  socket.on("request-camera", ({cameraId}) => {
    io.sockets.sockets.get(cameraId)?.emit("viewer-request",{viewerId:socket.id});
  });

  socket.on("signal", ({to,data}) => {
    if(to) io.to(to).emit("signal",{from:socket.id,data});
  });

  socket.on("camera-status", status => {
    const c=cameras.get(socket.id);
    if(!c)return;
    Object.assign(c,status,{audio:false});
    broadcast(c.room);
  });

  socket.on("disconnect", () => {
    const c=cameras.get(socket.id);
    if(c){
      cameras.delete(socket.id);
      broadcast(c.room);
    }
  });
});

const PORT=Number(process.env.HTTPS_PORT||3443);
server.listen(PORT,"0.0.0.0",()=> {
  console.log(`HTTPS: https://localhost:${PORT}/studio.html`);
  console.log(`LAN:    https://<IP-คอม>:${PORT}/studio.html`);
  console.log(`Health: https://<IP-คอม>:${PORT}/health`);
});
