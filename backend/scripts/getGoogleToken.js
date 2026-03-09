const { google } = require("googleapis");
const http = require("http");
const url = require("url");
const dotenv = require("dotenv");

// Load env from backend/.env (do NOT commit .env to repo)
dotenv.config();

// Read from env
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3001/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment.\n" +
      "Set them in backend/.env or export as environment variables before running this script."
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

async function getRefreshToken() {
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\n" + "=".repeat(70));
  console.log("🔐 LẤY GOOGLE REFRESH TOKEN CHO GOOGLE MEET");
  console.log("=".repeat(70));
  console.log("\n⚠️  TRƯỚC KHI TIẾP TỤC, hãy đảm bảo:");
  console.log("   1. Đã vào Google Cloud Console");
  console.log(`   2. Đã thêm redirect URI: ${REDIRECT_URI}`);
  console.log("   3. Đã Enable Google Calendar API");
  console.log("\n" + "=".repeat(70));
  console.log("\n📋 Mở link này trong trình duyệt:\n");
  console.log("\x1b[36m%s\x1b[0m", authorizeUrl);
  console.log("\n" + "=".repeat(70));
  console.log("⏳ Đang chờ bạn đăng nhập Google...\n");

  return new Promise((resolve, reject) => {
    const server = http
      .createServer(async (req, res) => {
        try {
          const queryParams = new url.URL(req.url, "http://localhost:3001").searchParams;
          const code = queryParams.get("code");
          const error = queryParams.get("error");

          if (error) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`<h1>❌ Lỗi: ${error}</h1>`);
            server.close();
            reject(new Error(error));
            return;
          }

          if (code) {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Thành công!</title>
                <style>
                  body { font-family: 'Segoe UI', Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; margin: 0; }
                  .container { background: white; padding: 40px; border-radius: 15px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
                  h1 { color: #27ae60; margin-bottom: 20px; }
                  p { color: #666; line-height: 1.6; }
                  .icon { font-size: 60px; margin-bottom: 20px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">✅</div>
                  <h1>Lấy Token Thành Công!</h1>
                  <p>Refresh Token đã được hiển thị trong terminal.</p>
                  <p>Bạn có thể <strong>đóng tab này</strong> và quay lại terminal để copy token.</p>
                </div>
              </body>
              </html>
            `);

            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);

            console.log("\n" + "=".repeat(70));
            console.log("✅ LẤY TOKEN THÀNH CÔNG!");
            console.log("=".repeat(70));
            console.log("\n📋 COPY DÒNG SAU VÀO FILE backend/.env (hoặc lưu nơi an toàn):\n");
            console.log("\x1b[32m%s\x1b[0m", `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
            console.log("\n" + "=".repeat(70));
            console.log("\n📝 CÁC BƯỚC TIẾP THEO:");
            console.log("   1. Mở file: D:\\Code\\EXE\\backend\\.env (không commit file này)");
            console.log("   2. Thêm/Thay thế: GOOGLE_REFRESH_TOKEN=<value_above>");
            console.log("   3. Restart backend: npm run dev");
            console.log("\n" + "=".repeat(70) + "\n");

            server.close();
            resolve(tokens);
          }
        } catch (e) {
          console.error("❌ Lỗi:", e.message);
          res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h1>❌ Lỗi: ${e.message}</h1>`);
          server.close();
          reject(e);
        }
      })
      .listen(3001, () => {
        console.log("🖥️  Callback server đang chạy tại http://localhost:3001\n");
      });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.log("\n⏰ Timeout sau 5 phút! Vui lòng chạy lại script.");
      server.close();
      reject(new Error("Timeout"));
    }, 5 * 60 * 1000);
  });
}

// Run
console.clear();
getRefreshToken()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Lỗi:", err.message);
    process.exit(1);
  });