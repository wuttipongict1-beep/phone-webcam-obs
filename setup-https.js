import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(root, "certs");
fs.mkdirSync(dir, { recursive: true });

const key = path.join(dir, "lan-key.pem");
const cert = path.join(dir, "lan-cert.pem");
const cfg = path.join(dir, "openssl.cnf");

const ips = ["127.0.0.1"];
for (const list of Object.values(os.networkInterfaces())) {
  for (const item of list || []) {
    if (!item.internal && item.family === "IPv4") ips.push(item.address);
  }
}

let san = "DNS.1 = localhost\n";
ips.forEach((ip, i) => { san += `IP.${i + 1} = ${ip}\n`; });

fs.writeFileSync(cfg, `[req]
distinguished_name=req_dn
x509_extensions=v3
prompt=no

[req_dn]
CN=Phone Webcam OBS LAN

[v3]
subjectAltName=@alt
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth

[alt]
${san}`);

try {
  execFileSync("openssl", [
    "req","-x509","-nodes","-newkey","rsa:2048",
    "-keyout",key,"-out",cert,"-days","825",
    "-config",cfg
  ], {stdio:"inherit"});
  console.log("\nHTTPS certificate created:");
  console.log(cert);
} catch {
  console.error("\nไม่พบ OpenSSL หรือสร้าง certificate ไม่สำเร็จ");
  console.error("ติดตั้ง OpenSSL แล้วตรวจสอบด้วย: openssl version");
  process.exit(1);
} finally {
  try { fs.unlinkSync(cfg); } catch {}
}
