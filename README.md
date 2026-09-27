# Phone Webcam → OBS v0.3.3

## สิ่งที่แก้
- HTTPS server จริงที่พอร์ต 3443
- สร้าง self-signed LAN certificate พร้อม SAN สำหรับ IP ของคอม
- ตรวจ Secure Context ก่อนเปิดกล้อง
- แจ้งเตือนภาษาไทยเมื่อ HTTP/permission/camera มีปัญหา
- QR ใช้ HTTPS เมื่อ Studio เปิดด้วย HTTPS
- `/health` ตรวจสถานะระบบ
- Video Only และ `audio:false`
- Multi-camera / Room / WebRTC เดิม

## Windows
1. ติดตั้ง Node.js 18+
2. ติดตั้ง OpenSSL และตรวจ `openssl version`
3. `npm install`
4. `npm run setup:https`
5. `npm run start:https`

Studio:
`https://IP-คอม:3443/studio.html`

ตัวอย่าง:
`https://10.25.1.150:3443/studio.html`

Health:
`https://10.25.1.150:3443/health`

ถ้ามือถือเข้าไม่ได้ ให้เปิด TCP 3443 ใน Windows Firewall (Private network)
และติดตั้ง/เชื่อถือ certificate บนมือถือเมื่อเบราว์เซอร์แจ้งเตือนครั้งแรก

OBS Browser Source:
`https://10.25.1.150:3443/studio.html?room=STUDIO`

For a video-only OBS Browser Source, use `/obs.html?room=STUDIO` instead.
It automatically connects to the first active camera in the room. To select a
camera by name, add `&camera=CAM%2001`; use `&fit=cover` to fill the source frame.

หมายเหตุ: QR image ยังใช้บริการ QR ภายนอก แต่ URL ที่อยู่ภายใน QR เป็น HTTPS เมื่อ Studio เปิดผ่าน HTTPS

## Deploy online (Render)
1. Push repository นี้ขึ้น GitHub
2. ใน Render เลือก **New > Blueprint** แล้วเชื่อม repository
3. รอให้ Web Service `phone-webcam-obs` deploy เสร็จ
4. เปิด URL ที่ Render ให้มา ตามด้วย `/studio.html`

Render ให้ HTTPS และกำหนด `PORT` ให้อัตโนมัติ โหมด production จะใช้ HTTP ภายใน
หลัง reverse proxy และไม่สร้าง LAN certificate. ใช้ URL HTTPS ของ Render บนมือถือ
เพื่อให้เบราว์เซอร์อนุญาตกล้อง. แผนฟรีอาจพักบริการเมื่อไม่มีการใช้งาน ทำให้การ
เชื่อมต่อครั้งแรกหลังพักใช้เวลานานขึ้น.
