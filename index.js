const express = require('express');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MyBotToken2024';
const PORT = process.env.PORT || 10000;

const processedMids = new Set();

const MSG1 = `▶ผ้าถุงเย็บพร้อมนุ่ง
10 ผืน 239 ค่าส่ง 50
รวมส่ง 289.-✅

20 ผืน 478.-ค่าส่ง50
รวมส่ง 528.-✅

100 ผืน 2390.-ส่งฟรี💥💥
💢ปลายทางไม่บวกเพิ่ม`;

// รูป 10 รูป ส่งทีละรูปตามลำดับ
const IMAGE_FILES = [
  'thaistyle.jpg',
  'thaipattern.jpg',
  'flowera.jpg',
  'flowerb.jpg',
  'flowerc.jpg',
  'peacock60.jpg',
  'peacock70.jpg',
  'peacock80.jpg',
  'peacockk1.jpg',
  'peacockk2.jpg'
];
const IMAGES = IMAGE_FILES.map(f => `https://raw.githubusercontent.com/TonyEthan/facebook-bot-phathung/main/${f}`);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendMessage(senderId, text) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, message: { text: text } })
    });
    const data = await res.json();
    console.log('SendMessage result:', JSON.stringify(data));
    return data;
  } catch (e) { console.log('SendMessage error:', e.message); }
}

async function sendImage(senderId, imageUrl) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } } })
    });
    const data = await res.json();
    console.log('SendImage result:', JSON.stringify(data));
    return data;
  } catch (e) { console.log('SendImage error:', e.message); return null; }
}

async function sendAllImages(senderId) {
  for (const url of IMAGES) {
    await sendImage(senderId, url);
    await delay(600);
  }
}

app.get('/', (req, res) => res.send('Bot ทำงานอยู่ครับ'));

app.get(['/privacy', '/privacy/'], (req, res) => {
  res.send(`
    <h1>Privacy Policy - Phathung Bot</h1>
    <p>เราเก็บข้อมูลแชท เช่น ชื่อ และข้อความ เพื่อใช้ตอบคำถามและจัดส่งสินค้าเท่านั้น ไม่ขายข้อมูลให้ใคร</p>
    <h2>การลบข้อมูล / Data Deletion</h2>
    <p>หากต้องการลบข้อมูลแชททั้งหมด สามารถทำได้ 2 วิธี:</p>
    <p>1. ทัก inbox มาที่เพจ แล้วพิมพ์ว่า ขอลบข้อมูล</p>
    <p>2. ส่งอีเมลมาที่ tonyethanroiet@outlook.co.th โดยระบุ Facebook ID ของคุณ</p>
    <p>เราจะลบข้อมูลของคุณภายใน 7 วัน และแจ้งกลับเมื่อลบเสร็จ</p>
  `);
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== 'page') return;
  body.entry?.forEach(entry => {
    entry.messaging?.forEach(event => {
      handleEvent(event).catch(e => console.log('handleEvent error:', e.message));
    });
  });
});

async function handleEvent(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  if (event.message?.is_echo) return;

  const msg = event.message?.text?.trim() || '';
  const hasAttachment = !!event.message?.attachments?.length;
  const isPostback = !!event.postback;
  const mid = event.message?.mid || event.postback?.mid || event.postback?.title;

  if (mid) {
    if (processedMids.has(mid)) return;
    processedMids.add(mid);
    if (processedMids.size > 500) processedMids.clear();
  }

  if (!msg && !hasAttachment && !isPostback) return;
  console.log('Received:', msg || (isPostback ? '[กดปุ่ม]' : '[ส่งรูปมา]'));

  try {
    // ตอบทุกครั้ง ไม่จำ 48 ชม. แล้ว ส่งแค่ข้อความก้อนเดียว
    await sendAllImages(senderId);
    await sendMessage(senderId, MSG1);
    console.log('Sent 1 message');
  } catch (e) {
    console.log('handleEvent error:', e.message);
  }
}

app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
