const express = require('express');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MyBotToken2024';
const PORT = process.env.PORT || 10000;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const processedMids = new Set();
const welcomedUsers = new Map();

// 48 ชม. = 48 * 60 * 60 = 172800 วินาที
const MEMORY_SECONDS = 172800;

async function hasWelcomed(senderId) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return welcomedUsers.has(senderId);
  try {
    const res = await fetch(`${UPSTASH_URL}/get/welcomed:${senderId}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const data = await res.json();
    return !!data.result;
  } catch (e) { return welcomedUsers.has(senderId); }
}

async function markWelcomed(senderId) {
  welcomedUsers.set(senderId, Date.now());
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(`${UPSTASH_URL}/set/welcomed:${senderId}/1/EX/${MEMORY_SECONDS}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
  } catch (e) { console.log("Upstash set error:", e.message); }
}

const MSG1 = `ผ้าถุง ราคาส่งผืนละ 23.-💥
เย็บพร้อมนุ่ง ✅
ไม่ลื่น ไม่มัน สีไม่ตก💯💯
#กว้าง 2 หลา ยาว 115 ซม.

10 ผืน 239 ค่าส่ง 50
รวมส่ง 289.-✅

20 ผืน 478.-ค่าส่ง50
รวมส่ง 528.-✅

100 ผืน 2390.-ส่งฟรี💥💥
💢ปลายทางไม่บวกเพิ่ม 💢

ด่วน ❗❗ สินค้ามีจำนวนจำกัด`;

const MSG2 = `💥💥 ผ้าถุง ทางร้านมี 4 ลายค่ะ
💚ลายดอก  💚 ไทย
💚 ลายนกยูง 💚 ไทยมีเชิง

ลูกค้ารับลายไหนจ้ะ❤🥰`;

const MSG3 = `คุณพี่รับกี่ผืนดีจ้ะ😘`;

const BASE_URL = 'https://raw.githubusercontent.com/TonyEthan/facebook-bot-phathung/main/';
const CODES_SINGLE = [
  'thaistyle',
  'thaipattern',
  'flowera',
  'flowerb',
  'flowerc',
  'peacock60',
  'peacock70',
  'peacock80',
  'peacockk1',
  'peacockk2'
];
const GROUP_SINGLE = CODES_SINGLE.map(code => `${BASE_URL}${code}.jpg`);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendMessage(senderId, text) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, message: { text: text } })
    });
    const data = await res.json(); console.log("SendMessage result:", JSON.stringify(data)); return data;
  } catch (e) { console.log("SendMessage error:", e.message); }
}

async function sendImage(senderId, imageUrl) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } } })
    });
    const data = await res.json(); console.log("SendImage result:", JSON.stringify(data)); return data;
  } catch (e) { console.log("SendImage error:", e.message); return null; }
}

async function sendImagesSingle(senderId, images) {
  for (const url of images) { await sendImage(senderId, url); await delay(600); }
}
async function sendAllImages(senderId) {
  await sendImagesSingle(senderId, GROUP_SINGLE);
}

app.get('/', (req, res) => res.send('Bot ผ้าถุง ทำงานอยู่ครับ'));
app.get('/privacy', (req, res) => {
  res.send(`<h1>Privacy Policy - เพจผ้าถุงลายสวย หลากสี ราคาโรงงาน</h1><p>เราเก็บข้อมูลแชทเพื่อตอบคำถามและจัดส่งสินค้าเท่านั้น ไม่ขายข้อมูลให้ใคร หากต้องการลบข้อมูล กรุณาทักแชทเพจ ผ้าถุงลายสวย หลากสี ราคาโรงงาน</p>`);
});
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']; const token = req.query['hub.verify_token']; const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});
app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== 'page') return;
  body.entry?.forEach(entry => {
    entry.messaging?.forEach(event => { handleEvent(event).catch(e => console.log("handleEvent error:", e.message)); });
  });
});
async function handleEvent(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  if (event.message?.is_echo) return;
  const msg = event.message?.text?.trim() || '';
  const attachments = event.message?.attachments || [];
  const imageUrls = attachments.filter(a => a.type === 'image').map(a => a.payload?.url).filter(Boolean);
  const hasAttachment = attachments.length > 0;
  const mid = event.message?.mid;
  if (mid) { if (processedMids.has(mid)) return; processedMids.add(mid); if (processedMids.size > 500) processedMids.clear(); }
  if (!msg && !hasAttachment) return;
  console.log("Received:", msg || "[ส่งรูปมา]", imageUrls.length ? `images:${imageUrls.length}` : "");
  try {
    const already = await hasWelcomed(senderId);
    if (already) {
      await markWelcomed(senderId);
      console.log("Already welcomed within 48h, skip sending images");
      return;
    }
    await markWelcomed(senderId);
    await sendAllImages(senderId);
    await sendMessage(senderId, MSG1);
    await sendMessage(senderId, MSG2);
    await sendMessage(senderId, MSG3);
    console.log("Welcome images sent, 48h memory");
  } catch (e) { console.log("handleEvent error:", e.message); }
}
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
