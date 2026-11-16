const express = require('express');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MyBotToken2024';
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PORT = process.env.PORT || 10000;
const MEMORY_SECONDS = 172800; // 48 ชม.

const processedMids = new Set();

const MSG1 = `ผ้าถุงลายสวย หลากสี ราคาโรงงาน ✅
ผ้านิ่ม ใส่สบาย สีไม่ตก

▶ ลายไทย / ลายดอก / ลายนกยูง มีครบ
▶ ผ้าถุงเย็บสำเร็จ ใส่ได้เลย
▶ มีหลายสีให้เลือก`;

const MSG2 = `ราคาโรงงานตรงจากโรงงานเลยจ้า
คละลาย คละสีได้เลยนะจ้ะ❤❤

สั่งเยอะมีราคาส่งให้ด้วยจ้า`;

const MSG3 = `คุณพี่รับกี่ผืนดีจ้ะ😘`;

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

async function upstashGet(key) {
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const data = await res.json();
    return data.result;
  } catch (e) { console.log('Upstash get error:', e.message); return null; }
}

async function upstashSet(key, value) {
  try {
    await fetch(`${UPSTASH_URL}/set/${key}/${value}?EX=${MEMORY_SECONDS}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
  } catch (e) { console.log('Upstash set error:', e.message); }
}

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
app.get('/privacy', (req, res) => {
  res.send(`<h1>Privacy Policy</h1><p>เราเก็บข้อมูลแชทเพื่อตอบคำถามและจัดส่งสินค้าเท่านั้น ไม่ขายข้อมูลให้ใคร</p>`);
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

  // แก้ตรงนี้ครับ - ตอบเมื่อส่งอะไรมาก็ได้ เหมือนบอทชุดนอน
  // ถ้าไม่มีทั้งข้อความ และไม่มีทั้งรูป และไม่ได้กดปุ่ม ถึงจะไม่ตอบ
  if (!msg && !hasAttachment && !isPostback) return;
  console.log('Received:', msg || (isPostback ? '[กดปุ่ม]' : '[ส่งรูปมา]'));

  try {
    // จำ 48 ชม. ด้วย Upstash
    const key = `welcomed:${senderId}`;
    const already = await upstashGet(key);
    if (already) {
      console.log('Already welcomed within 48h, skip - let admin reply');
      return;
    }

    await upstashSet(key, '1');
    await sendAllImages(senderId);
    await sendMessage(senderId, MSG1);
    await sendMessage(senderId, MSG2);
    await sendMessage(senderId, MSG3);
    console.log('Welcome sent, waiting for admin');
  } catch (e) {
    console.log('handleEvent error:', e.message);
  }
}

app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
