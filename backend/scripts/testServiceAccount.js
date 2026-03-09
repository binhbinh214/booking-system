require("dotenv").config();
const googleCalendarService = require("../src/services/googleCalendar.service");

async function testServiceAccount() {
  console.log("=== TESTING GOOGLE SERVICE ACCOUNT ===");

  if (!googleCalendarService.initialized) {
    console.log("❌ Service not initialized");
    return;
  }

  try {
    const result = await googleCalendarService.createMeetingEvent({
      patientEmail: "binhhu21974@gmail.com",
      patientName: "Nguyễn Văn A",
      providerEmail: "binhhu21974@gmail.com",
      providerName: "BS. Nguyễn Thị B",
      scheduledDate: new Date(Date.now() + 60 * 60 * 1000), // 1 tiếng sau
      scheduledTime: "14:30",
      duration: 60,
      reasonForVisit: "Test appointment",
    });

    console.log("✅ Test successful!");
    console.log("📞 Meet Link:", result.meetLink);
    console.log("🔗 Calendar Link:", result.calendarLink);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testServiceAccount();
