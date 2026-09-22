const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

let MsEdgeTTS, OUTPUT_FORMAT;
try {
  const edgeModule = require('msedge-tts');
  MsEdgeTTS = edgeModule.MsEdgeTTS;
  OUTPUT_FORMAT = edgeModule.OUTPUT_FORMAT;
} catch (e) {
  console.warn('msedge-tts not loaded initially:', e.message);
}

const server = http.createServer(async (req, res) => {
  // 全域 CORS 支援 (支援 GitHub Pages 跨域調用)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. 神經語音 TTS API
  if (url.pathname === '/api/tts' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const text = String(data.text || '').trim();
        const voice = data.voice || 'zh-CN-YunjianNeural'; // 預設郎雄老匠人聲線

        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Text is required' }));
          return;
        }

        if (!MsEdgeTTS) {
          const edgeModule = require('msedge-tts');
          MsEdgeTTS = edgeModule.MsEdgeTTS;
          OUTPUT_FORMAT = edgeModule.OUTPUT_FORMAT;
        }

        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = await tts.toStream(text);

        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400'
        });
        audioStream.pipe(res);

      } catch (err) {
        console.error('TTS Synthesis Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. 靜態網頁服務 (index.html)
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = ext === '.html' ? 'text/html; charset=utf-8' :
                      ext === '.js' ? 'application/javascript' :
                      ext === '.css' ? 'text/css' :
                      ext === '.mp3' ? 'audio/mpeg' : 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`⚡ 賈維斯伺服器（含郎雄神經語音 API）已啟動於通訊埠 ${PORT}`);
});
