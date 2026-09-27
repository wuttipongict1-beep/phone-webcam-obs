const socket=io();
const video=document.getElementById("feed");
const params=new URLSearchParams(location.search);
const room=params.get("room")||"STUDIO";
const requestedCamera=params.get("camera")?.trim().toLocaleLowerCase();
let cameras=[];
let peer=null;
let selectedCameraId=null;
let pendingCandidates=[];
let reconnectTimer=null;

video.style.objectFit=params.get("fit")==="cover"?"cover":"contain";

function closePeer(){
 clearTimeout(reconnectTimer);
 reconnectTimer=null;
 const currentPeer=peer;
 peer=null;
 selectedCameraId=null;
 pendingCandidates=[];
 video.srcObject=null;
 if(currentPeer)currentPeer.close();
}

function findCamera(){
 if(requestedCamera){
  return cameras.find(camera=>camera.name.trim().toLocaleLowerCase()===requestedCamera);
 }
 return cameras.find(camera=>camera.active);
}

function syncCamera(){
 const camera=findCamera();
 if(camera?.active){
  connectCamera(camera);
  return;
 }
 if(selectedCameraId&&!cameras.some(item=>item.id===selectedCameraId&&item.active))closePeer();
}

function connectCamera(camera){
 if(peer&&selectedCameraId===camera.id)return;
 closePeer();
 selectedCameraId=camera.id;
 const currentPeer=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
 peer=currentPeer;
 currentPeer.ontrack=event=>{
  if(peer===currentPeer&&event.streams[0])video.srcObject=event.streams[0];
 };
 currentPeer.onicecandidate=event=>{
  if(event.candidate&&peer===currentPeer){
   socket.emit("signal",{to:camera.id,data:{type:"candidate",candidate:event.candidate}});
  }
 };
 currentPeer.onconnectionstatechange=()=>{
  if(peer!==currentPeer)return;
  if(currentPeer.connectionState==="connected")clearTimeout(reconnectTimer);
  if(["failed","disconnected"].includes(currentPeer.connectionState)){
   clearTimeout(reconnectTimer);
   reconnectTimer=setTimeout(()=>{
    if(peer===currentPeer){
     closePeer();
     syncCamera();
    }
   },3000);
  }
 };
 socket.emit("request-camera",{cameraId:camera.id});
}

socket.on("connect",()=>socket.emit("register",{role:"studio",room}));
socket.on("disconnect",closePeer);
socket.on("camera-list",list=>{
 cameras=list;
 syncCamera();
});
socket.on("signal",async({from,data})=>{
 const currentPeer=peer;
 if(!currentPeer||from!==selectedCameraId)return;
 if(data.type==="offer"){
  pendingCandidates=[];
  await currentPeer.setRemoteDescription(data.sdp);
  for(const candidate of pendingCandidates){
   try{await currentPeer.addIceCandidate(candidate)}catch{}
  }
  await currentPeer.setLocalDescription(await currentPeer.createAnswer());
  socket.emit("signal",{to:from,data:{type:"answer",sdp:currentPeer.localDescription}});
 }else if(data.type==="candidate"&&data.candidate){
  if(currentPeer.remoteDescription){
   try{await currentPeer.addIceCandidate(data.candidate)}catch{}
  }else{
   pendingCandidates.push(data.candidate);
  }
 }
});