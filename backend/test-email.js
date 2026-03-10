require("dotenv").config();
const nodemailer = require("nodemailer");

async function testEmail() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 KIỂM TRA CẤU HÌNH EMAIL");
  console.log("=".repeat(60));

  console.log("\n📋 Thông tin cấu hình:");
  console.log("   EMAIL_HOST:", process.env.EMAIL_HOST);
  console.log("   EMAIL_PORT:", process.env.EMAIL_PORT);
  console.log("   EMAIL_USER:", process.env.EMAIL_USER);
  console.log(
    "   EMAIL_PASS:",
    process.env.EMAIL_PASS
      ? "✅ Có (" + process.env.EMAIL_PASS.length + " ký tự)"
      : "❌ KHÔNG CÓ"
  );

  const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    debug: true, // Enable debug output
    logger: true, // Log to console
  });

  try {
    console.log("\n🔍 Bước 1: Kiểm tra kết nối SMTP...");
    await transporter.verify();
    console.log("✅ Kết nối SMTP thành công!\n");

    console.log("📨 Bước 2: Gửi email test...");
    const info = await transporter.sendMail({
      from: `Mental Healthcare <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "🧪 Test Email - Mental Healthcare",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1>🧠 Mental Healthcare</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2>Email Test Thành Công! ✅</h2>
            <p>Mã OTP test của bạn là:</p>
            <div style="font-size: 32px; font-weight: bold; color: #667eea; 
                        text-align: center; padding: 20px; background: white; 
                        border-radius: 8px; letter-spacing: 8px;">
              123456
            </div>
            <p style="color: #666; margin-top: 20px;">
              Nếu bạn nhận được email này, cấu hình đã hoạt động đúng!
            </p>
          </div>
        </div>
      `,
    });

    console.log("\n" + "=".repeat(60));
    console.log("✅ GỬI EMAIL THÀNH CÔNG!");
    console.log("=".repeat(60));
    console.log("📬 Message ID:", info.messageId);
    console.log("📧 Gửi đến:", process.env.EMAIL_USER);
    console.log("\n✨ Hãy kiểm tra hộp thư của bạn (kể cả thư mục spam)!\n");
  } catch (error) {
    console.log("\n" + "=".repeat(60));
    console.log("❌ LỖI");
    console.log("=".repeat(60));
    console.error("\n🚨 Lỗi chi tiết:", error);

    console.log("\n🔧 CÁCH KHẮC PHỤC:");
    console.log("1. Đảm bảo 2FA đã bật: https://myaccount.google.com/security");
    console.log(
      "2. Tạo App Password: https://myaccount.google.com/apppasswords"
    );
    console.log("3. Thay EMAIL_PASS bằng App Password (16 ký tự)");
    console.log("4. Xóa hết khoảng trắng trong EMAIL_PASS");
    console.log("5. Khởi động lại server sau khi sửa .env\n");
  }
}

testEmail();
