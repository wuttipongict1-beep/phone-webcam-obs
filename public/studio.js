const socket=io();
const $=id=>document.getElementById(id);
const video=$("remoteVideo"),list=$("cameraList"),roomInput=$("roomInput"),roomLabel=$("roomLabel"),qr=$("qr"),selectedName=$("selectedName"),statsEl=$("stats");
let room=new URLSearchParams(location.search).get("room")||"STUDIO";
let pc=null;
let pendingCandidates=[];
roomInput.value=room;roomLabel.textContent=room;

function cameraBaseUrl(){
 const host=location.hostname;
 const port=location.protocol==="https:"?location.port:"3443";
 return `https://${host}:${port}`;
}
function updateQR(){
 const secure=location.protocol==="https:";
 const u=`${secure?"https:":"http:"}//${location.host}/camera.html?room=${encodeURIComponent(room)}`;
 qr.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(u)}`;
 const n=document.getElementById("qrNote");
 if(n)n.textContent=secure?"🔒 QR พร้อมใช้งานผ่าน HTTPS":"⚠️ Studio เป็น HTTP — ใช้ HTTPS เพื่อเปิดกล้องมือถือ";
}
function register(){socket.emit("register",{role:"studio",room});updateQR();}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function render(cs){
 list.innerHTML="";
 if(!cs.length){list.innerHTML='<div class="empty">ยังไม่มีกล้องใน Room นี้</div>';return;}
 cs.forEach(c=>{
  const b=document.createElement("button");b.className="camera-card";
  b.innerHTML=`<strong>${esc(c.name)}</strong><span>${c.active?"● ONLINE":"○ READY"} • ${c.resolution||"ไม่ทราบความละเอียด"}</span><span>${c.fps?c.fps+" FPS":"—"} • 🔇 Audio OFF</span>`;
  b.onclick=()=>connectCamera(c);list.appendChild(b);
 });
}
async function connectCamera(c){
 if(pc)pc.close();
 pendingCandidates=[];
 selectedName.textContent=c.name;statsEl.textContent="กำลังเชื่อมต่อ...";
 pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
 pc.ontrack=e=>{video.srcObject=e.streams[0];statsEl.textContent="LIVE • Video Only"};
 pc.onicecandidate=e=>{if(e.candidate)socket.emit("signal",{to:c.id,data:{type:"candidate",candidate:e.candidate}})};
 pc.onconnectionstatechange=()=>{if(pc)statsEl.textContent="LIVE • "+pc.connectionState};
 socket.emit("request-camera",{cameraId:c.id});
}
socket.on("camera-list",render);
socket.on("signal",async({from,data})=>{
 if(!pc)return;
 if(data.type==="offer"){
  pendingCandidates=[];
  await pc.setRemoteDescription(data.sdp);
  for(const c of pendingCandidates){try{await pc.addIceCandidate(c)}catch{}}
  await pc.setLocalDescription(await pc.createAnswer());
  socket.emit("signal",{to:from,data:{type:"answer",sdp:pc.localDescription}});
 }else if(data.type==="candidate"&&data.candidate){
  if(pc.remoteDescription)try{await pc.addIceCandidate(data.candidate)}catch{}
  else pendingCandidates.push(data.candidate);
 }
});
$("newRoom").onclick=()=>{room=(roomInput.value.trim()||"STUDIO").toUpperCase();location.href=`/studio.html?room=${encodeURIComponent(room)}`};
socket.on("connect",register);
register();