const socket=io();
const $=id=>document.getElementById(id);
const video=$("preview"),statusEl=$("status"),qualityEl=$("quality"),nameEl=$("cameraName"),roomEl=$("room"),resolutionEl=$("resolution"),fpsEl=$("fps");
let stream=null,facingMode="environment";
const peers=new Map();
const pendingCandidates=new Map();

const params=new URLSearchParams(location.search);
if(params.get("room"))roomEl.value=params.get("room");

function size(){
 const h=+resolutionEl.value;
 return h===720?{width:1280,height:720}:h===1080?{width:1920,height:1080}:{width:3840,height:2160};
}
function register(){
 socket.emit("register",{role:"camera",room:roomEl.value.trim()||"STUDIO",cameraName:nameEl.value.trim()||"CAM 01"});
}
function showCameraError(title,message){
 statusEl.textContent="ERROR"; statusEl.className="badge error"; alert(title+"\n\n"+message);
}
function secureCheck(){
 return window.isSecureContext && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia==="function";
}
async function openCamera(){
 if(!secureCheck()){
  showCameraError("ไม่สามารถเปิดกล้องได้","ต้องเปิดเว็บไซต์ผ่าน HTTPS ก่อน\n\nให้ใช้ลิงก์ https://IP-ของคอม:3443/camera.html\nถ้าเห็นหน้าเตือนใบรับรอง ให้ติดตั้งใบรับรอง LAN ก่อน");
  return;
 }
 if(stream)stream.getTracks().forEach(t=>t.stop());
 const s=size(),fps=+fpsEl.value;
 try{
  stream=await navigator.mediaDevices.getUserMedia({
   video:{facingMode,width:{ideal:s.width},height:{ideal:s.height},frameRate:{ideal:fps,max:fps}},
   audio:false
  });
  video.srcObject=stream;
  statusEl.textContent="ONLINE"; statusEl.className="badge online";
  const t=stream.getVideoTracks()[0],x=t.getSettings();
  qualityEl.textContent=`${x.width||"?"}×${x.height||"?"} • ${x.frameRate?Math.round(x.frameRate):"?"} FPS • Video Only`;
  $("previewTitle").textContent=nameEl.value.trim()||"CAM 01";
  register();
  socket.emit("camera-status",{active:true,resolution:`${x.width||""}x${x.height||""}`,fps:x.frameRate?Math.round(x.frameRate):"",audio:false});
  for(const [viewerId,pc] of peers){
   const sender=pc.getSenders().find(x=>x.track&&x.track.kind==="video");
   if(sender&&t) await sender.replaceTrack(t);
  }
 }catch(e){
  let msg="กรุณาอนุญาตการใช้กล้อง แล้วลองใหม่อีกครั้ง";
  if(e.name==="NotAllowedError"||e.name==="PermissionDeniedError")msg="การเข้าถึงกล้องถูกปฏิเสธ กรุณาเปิดสิทธิ์ Camera ให้เบราว์เซอร์";
  else if(e.name==="NotFoundError")msg="ไม่พบกล้องบนอุปกรณ์";
  else if(e.name==="NotReadableError")msg="กล้องกำลังถูกใช้งานโดยแอปอื่น";
  else if(e.name==="OverconstrainedError")msg="ความละเอียดหรือ FPS ที่เลือกไม่รองรับโดยกล้องนี้";
  else if(e.name==="SecurityError")msg="เบราว์เซอร์บล็อกการเข้าถึงกล้อง กรุณาใช้ HTTPS";
  showCameraError("เปิดกล้องไม่ได้",msg+"\n\nรายละเอียด: "+(e.message||e.name));
 }
}
$("connect").onclick=()=>openCamera();
$("switch").onclick=async()=>{facingMode=facingMode==="environment"?"user":"environment";if(stream)await openCamera();};
socket.on("connect",()=>{if(stream)register();});

socket.on("viewer-request",async({viewerId})=>{
 if(!stream)return;
 const old=peers.get(viewerId);
 if(old)old.close();
 const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
 peers.set(viewerId,pc); pendingCandidates.set(viewerId,[]);
 stream.getTracks().forEach(t=>pc.addTrack(t,stream));
 pc.onicecandidate=e=>{if(e.candidate)socket.emit("signal",{to:viewerId,data:{type:"candidate",candidate:e.candidate}})};
 pc.onconnectionstatechange=()=>{
  if(["failed","closed","disconnected"].includes(pc.connectionState)){
   pc.close();peers.delete(viewerId);pendingCandidates.delete(viewerId);
  }
 };
 await pc.setLocalDescription(await pc.createOffer());
 socket.emit("signal",{to:viewerId,data:{type:"offer",sdp:pc.localDescription}});
});
socket.on("signal",async({from,data})=>{
 const pc=peers.get(from);
 if(!pc)return;
 if(data.type==="answer"){
  await pc.setRemoteDescription(data.sdp);
  const q=pendingCandidates.get(from)||[];
  for(const c of q){try{await pc.addIceCandidate(c)}catch{}}
  pendingCandidates.delete(from);
 }else if(data.type==="candidate"&&data.candidate){
  if(pc.remoteDescription)try{await pc.addIceCandidate(data.candidate)}catch{}
  else (pendingCandidates.get(from)||pendingCandidates.set(from,[]).get(from)).push(data.candidate);
 }
});