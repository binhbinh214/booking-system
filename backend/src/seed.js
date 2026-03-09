const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const User = require("./models/User.model");
const Content = require("./models/Content.model");

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/mental_healthcare",
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
const seedUsers = async () => {
  try {
    await mongoose.connection.db.dropCollection("users");
  } catch (e) {
    // ignore if not exists
  }

  const users = [
    // Admin
    {
      email: "admin@mentalhealthcare.com",
      password: await bcrypt.hash("admin123", 12),
      fullName: "Admin",
      role: "admin",
      status: "active",
      isVerified: true,
      balance: 0,
    },

    // 10 Bác sĩ (Doctors)
    {
      email: "doctor1@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Nguyễn Văn Minh",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tâm lý học lâm sàng",
      bio: "Bác sĩ chuyên khoa tâm thần với hơn 15 năm kinh nghiệm điều trị trầm cảm, lo âu và rối loạn lưỡng cực. Tốt nghiệp Đại học Y khoa Hà Nội, từng công tác tại Bệnh viện Bạch Mai.",
      experienceYears: 15,
      consultationFee: 800000,
      rating: 4.9,
      totalRatings: 245,
      phone: "0901234567",
      avatar:
        "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "08:00", end: "17:00", available: true },
        tuesday: { start: "08:00", end: "17:00", available: true },
        wednesday: { start: "08:00", end: "17:00", available: true },
        thursday: { start: "08:00", end: "17:00", available: true },
        friday: { start: "08:00", end: "17:00", available: true },
        saturday: { start: "08:00", end: "12:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: [
        "Bác sĩ Y khoa - ĐH Y Hà Nội",
        "Thạc sĩ Tâm thần học - ĐH Y Dược TPHCM",
      ],
      certifications: ["Chứng chỉ CBT", "Chứng chỉ Tâm lý trị liệu"],
      languages: ["Tiếng Việt", "English"],
      balance: 2500000,
    },
    {
      email: "doctor2@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Trần Thị Hương",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tâm lý trẻ em và vô niên",
      bio: "Bác sĩ chuyên về tâm lý trẻ em với 12 năm kinh nghiệm. Chuyên điều trị tự kỷ, ADHD, và các vấn đề hành vi ở trẻ. Tốt nghiệp ĐH Y Dược TPHCM, có chứng chỉ Play Therapy.",
      experienceYears: 12,
      consultationFee: 750000,
      rating: 4.8,
      totalRatings: 189,
      phone: "0902345678",
      avatar:
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "09:00", end: "18:00", available: true },
        tuesday: { start: "09:00", end: "18:00", available: true },
        wednesday: { start: "09:00", end: "18:00", available: true },
        thursday: { start: "09:00", end: "18:00", available: true },
        friday: { start: "09:00", end: "18:00", available: true },
        saturday: { start: "09:00", end: "15:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: ["Bác sĩ Y khoa - ĐH Y Dược TPHCM", "Chuyên khoa I Tâm thần"],
      certifications: [
        "Play Therapy Certificate",
        "Child Psychology Specialist",
      ],
      languages: ["Tiếng Việt", "English"],
      balance: 1800000,
    },
    {
      email: "doctor3@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Lê Hoàng Dũng",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Rối loạn lo âu và hoảng sợ",
      bio: "Bác sĩ chuyên điều trị các rối loạn lo âu, hoảng sợ và stress sau chấn thương (PTSD). 10 năm kinh nghiệm tại các bệnh viện tâm thần hàng đầu. Áp dụng liệu pháp nhận thức hành vi (CBT).",
      experienceYears: 10,
      consultationFee: 700000,
      rating: 4.7,
      totalRatings: 156,
      phone: "0903456789",
      avatar:
        "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "07:30", end: "16:30", available: true },
        tuesday: { start: "07:30", end: "16:30", available: true },
        wednesday: { start: "07:30", end: "16:30", available: true },
        thursday: { start: "07:30", end: "16:30", available: true },
        friday: { start: "07:30", end: "16:30", available: true },
        saturday: { start: "08:00", end: "12:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: ["Bác sĩ Y khoa - ĐH Y Huế", "Thạc sĩ Tâm lý lâm sàng"],
      certifications: ["CBT Practitioner", "PTSD Treatment Specialist"],
      languages: ["Tiếng Việt", "English", "中文"],
      balance: 1650000,
    },
    {
      email: "doctor4@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Phạm Thị Lan",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tâm thần người cao tuổi",
      bio: "Bác sĩ chuyên về tâm thần học người cao tuổi với 14 năm kinh nghiệm. Chuyên điều trị sa sút trí tuệ, Alzheimer, và các vấn đề tâm lý ở người già. Từng làm việc tại Singapore 3 năm.",
      experienceYears: 14,
      consultationFee: 850000,
      rating: 4.9,
      totalRatings: 203,
      phone: "0904567890",
      avatar:
        "https://plus.unsplash.com/premium_photo-1661606252774-a8798fd93307?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8cG9ydHJhaXQlMjBkb2N0b3J8ZW58MHx8MHx8fDA%3D",
      workingHours: {
        monday: { start: "08:00", end: "17:00", available: true },
        tuesday: { start: "08:00", end: "17:00", available: true },
        wednesday: { start: "08:00", end: "17:00", available: true },
        thursday: { start: "08:00", end: "17:00", available: true },
        friday: { start: "08:00", end: "17:00", available: true },
        saturday: { start: "", end: "", available: false },
        sunday: { start: "", end: "", available: false },
      },
      education: [
        "Bác sĩ Y khoa - ĐH Y Dược TPHCM",
        "Fellowship Geriatric Psychiatry - Singapore",
      ],
      certifications: [
        "Geriatric Psychiatry Specialist",
        "Dementia Care Certificate",
      ],
      languages: ["Tiếng Việt", "English"],
      balance: 2100000,
    },
    {
      email: "doctor5@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Vũ Minh Tuấn",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Nghiện chất và rối loạn ăn uống",
      bio: "Bác sĩ chuyên điều trị nghiện chất, rối loạn ăn uống và các hành vi gây hại bản thân. 11 năm kinh nghiệm, đã giúp hàng trăm bệnh nhân vượt qua nghiện ngập và phục hồi cuộc sống.",
      experienceYears: 11,
      consultationFee: 780000,
      rating: 4.8,
      totalRatings: 167,
      phone: "0905678901",
      avatar:
        "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "13:00", end: "21:00", available: true },
        tuesday: { start: "13:00", end: "21:00", available: true },
        wednesday: { start: "13:00", end: "21:00", available: true },
        thursday: { start: "13:00", end: "21:00", available: true },
        friday: { start: "13:00", end: "21:00", available: true },
        saturday: { start: "08:00", end: "16:00", available: true },
        sunday: { start: "08:00", end: "16:00", available: true },
      },
      education: ["Bác sĩ Y khoa - ĐH Y Cần Thơ", "Thạc sĩ Nghiện học"],
      certifications: [
        "Addiction Medicine Specialist",
        "Eating Disorder Treatment",
      ],
      languages: ["Tiếng Việt", "English"],
      balance: 1950000,
    },
    {
      email: "doctor6@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Đặng Thị Thu",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tâm lý phụ nữ và hậu sinh",
      bio: "Bác sĩ chuyên về tâm lý phụ nữ, trầm cảm sau sinh và các vấn đề tâm lý trong thai kỳ. 9 năm kinh nghiệm, hiểu rõ những thay đổi tâm lý của phụ nữ qua các giai đoạn cuộc đời.",
      experienceYears: 9,
      consultationFee: 720000,
      rating: 4.9,
      totalRatings: 198,
      phone: "0906789012",
      avatar:
        "https://plus.unsplash.com/premium_photo-1667520580687-a85c9080a9bc?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8cG9ydHJhaXQlMjBkb2N0b3J8ZW58MHx8MHx8fDA%3D",
      workingHours: {
        monday: { start: "08:30", end: "17:30", available: true },
        tuesday: { start: "08:30", end: "17:30", available: true },
        wednesday: { start: "08:30", end: "17:30", available: true },
        thursday: { start: "08:30", end: "17:30", available: true },
        friday: { start: "08:30", end: "17:30", available: true },
        saturday: { start: "08:30", end: "12:30", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: [
        "Bác sĩ Y khoa - ĐH Y Dược TPHCM",
        "Chuyên khoa I Sản phụ khoa",
      ],
      certifications: [
        "Perinatal Mental Health Specialist",
        "Women's Health Psychology",
      ],
      languages: ["Tiếng Việt", "English"],
      balance: 1750000,
    },
    {
      email: "doctor7@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Ngô Văn Hải",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Rối loạn tâm thần nặng",
      bio: "Bác sĩ chuyên điều trị các rối loạn tâm thần nặng như tâm thần phân liệt, rối loạn lưỡng cực và các bệnh tâm thần khác. 13 năm kinh nghiệm tại các bệnh viện tâm thần chuyên khoa.",
      experienceYears: 13,
      consultationFee: 900000,
      rating: 4.7,
      totalRatings: 134,
      phone: "0907890123",
      avatar:
        "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "07:00", end: "16:00", available: true },
        tuesday: { start: "07:00", end: "16:00", available: true },
        wednesday: { start: "07:00", end: "16:00", available: true },
        thursday: { start: "07:00", end: "16:00", available: true },
        friday: { start: "07:00", end: "16:00", available: true },
        saturday: { start: "07:00", end: "11:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: ["Bác sĩ Y khoa - ĐH Y Hà Nội", "Tiến sĩ Tâm thần học"],
      certifications: [
        "Specialist in Severe Mental Disorders",
        "Psychopharmacology Expert",
      ],
      languages: ["Tiếng Việt", "English", "Français"],
      balance: 2300000,
    },
    {
      email: "doctor8@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Bùi Thị Mai",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tâm lý học tình dục",
      bio: "Bác sĩ chuyên về tâm lý học tình dục, tư vấn các vấn đề về tình dục và hôn nhân. 8 năm kinh nghiệm giúp các cặp đôi và cá nhân giải quyết những khó khăn trong đời sống tình dục.",
      experienceYears: 8,
      consultationFee: 650000,
      rating: 4.6,
      totalRatings: 112,
      phone: "0908901234",
      avatar:
        "https://images.unsplash.com/photo-1734002886107-168181bcd6a1?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTR8fGRvY3RvciUyMHZpZXRuYW18ZW58MHx8MHx8fDA%3D",
      workingHours: {
        monday: { start: "14:00", end: "20:00", available: true },
        tuesday: { start: "14:00", end: "20:00", available: true },
        wednesday: { start: "14:00", end: "20:00", available: true },
        thursday: { start: "14:00", end: "20:00", available: true },
        friday: { start: "14:00", end: "20:00", available: true },
        saturday: { start: "09:00", end: "17:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: ["Bác sĩ Y khoa - ĐH Y Dược TPHCM", "Thạc sĩ Tình dục học"],
      certifications: ["Sex Therapy Specialist", "Couples Therapy Certificate"],
      languages: ["Tiếng Việt", "English"],
      balance: 1450000,
    },
    {
      email: "doctor9@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Hoàng Minh Đức",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tâm lý thể thao và hiệu suất",
      bio: "Bác sĩ tâm lý chuyên về thể thao và nâng cao hiệu suất. Giúp vận động viên và các chuyên gia vượt qua áp lực, tăng cường tập trung và đạt được mục tiêu cao nhất. 7 năm kinh nghiệm.",
      experienceYears: 7,
      consultationFee: 680000,
      rating: 4.8,
      totalRatings: 89,
      phone: "0909012345",
      avatar:
        "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "06:00", end: "14:00", available: true },
        tuesday: { start: "06:00", end: "14:00", available: true },
        wednesday: { start: "06:00", end: "14:00", available: true },
        thursday: { start: "06:00", end: "14:00", available: true },
        friday: { start: "06:00", end: "14:00", available: true },
        saturday: { start: "06:00", end: "12:00", available: true },
        sunday: { start: "06:00", end: "12:00", available: true },
      },
      education: [
        "Bác sĩ Y khoa - ĐH Thể dục Thể thao",
        "Thạc sĩ Tâm lý Thể thao",
      ],
      certifications: [
        "Sports Psychology Specialist",
        "Performance Enhancement Coach",
      ],
      languages: ["Tiếng Việt", "English", "日本語"],
      balance: 1580000,
    },
    {
      email: "doctor10@mentalhealthcare.com",
      password: await bcrypt.hash("doctor123", 12),
      fullName: "BS. Lý Thị Bình",
      role: "doctor",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tâm lý pháp y và tội phạm",
      bio: "Bác sĩ chuyên về tâm lý pháp y, thẩm định tâm thần và tư vấn cho hệ thống tư pháp. 12 năm kinh nghiệm, từng tham gia nhiều vụ án quan trọng và nghiên cứu về tâm lý tội phạm.",
      experienceYears: 12,
      consultationFee: 950000,
      rating: 4.7,
      totalRatings: 95,
      phone: "0910123456",
      avatar:
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "09:00", end: "17:00", available: true },
        tuesday: { start: "09:00", end: "17:00", available: true },
        wednesday: { start: "09:00", end: "17:00", available: true },
        thursday: { start: "09:00", end: "17:00", available: true },
        friday: { start: "09:00", end: "17:00", available: true },
        saturday: { start: "", end: "", available: false },
        sunday: { start: "", end: "", available: false },
      },
      education: [
        "Bác sĩ Y khoa - ĐH Y Hà Nội",
        "Thạc sĩ Tâm lý Pháp y",
        "Tiến sĩ Tội phạm học",
      ],
      certifications: [
        "Forensic Psychology Expert",
        "Criminal Psychology Analyst",
      ],
      languages: ["Tiếng Việt", "English", "Русский"],
      balance: 2150000,
    },

    // 10 Chuyên gia tâm lý (Healers)
    {
      email: "healer1@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Nguyễn Thị Hoa",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tư vấn tâm lý cá nhân",
      bio: "Chuyên gia tâm lý với 8 năm kinh nghiệm trong tư vấn cá nhân. Chuyên về stress, lo âu và phát triển bản thân. Tốt nghiệp Thạc sĩ Tâm lý học, có chứng chỉ tư vấn tâm lý quốc tế.",
      experienceYears: 8,
      consultationFee: 400000,
      chatRatePerMinute: 8000,
      rating: 4.8,
      totalRatings: 145,
      phone: "0911234567",
      avatar:
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "09:00", end: "18:00", available: true },
        tuesday: { start: "09:00", end: "18:00", available: true },
        wednesday: { start: "09:00", end: "18:00", available: true },
        thursday: { start: "09:00", end: "18:00", available: true },
        friday: { start: "09:00", end: "18:00", available: true },
        saturday: { start: "09:00", end: "15:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: ["Cử nhân Tâm lý học - ĐH KHXH&NV", "Thạc sĩ Tâm lý Tư vấn"],
      certifications: ["Certified Professional Counselor", "CBT Practitioner"],
      languages: ["Tiếng Việt", "English"],
      balance: 950000,
    },
    {
      email: "healer2@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Trần Văn Nam",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tư vấn gia đình và hôn nhân",
      bio: "Chuyên gia tư vấn hôn nhân và gia đình với 10 năm kinh nghiệm. Đã giúp hàng trăm cặp đôi cải thiện mối quan hệ và xây dựng gia đình hạnh phúc. Áp dụng liệu pháp gia đình hệ thống.",
      experienceYears: 10,
      consultationFee: 450000,
      chatRatePerMinute: 9000,
      rating: 4.9,
      totalRatings: 167,
      phone: "0912345678",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "14:00", end: "21:00", available: true },
        tuesday: { start: "14:00", end: "21:00", available: true },
        wednesday: { start: "14:00", end: "21:00", available: true },
        thursday: { start: "14:00", end: "21:00", available: true },
        friday: { start: "14:00", end: "21:00", available: true },
        saturday: { start: "08:00", end: "16:00", available: true },
        sunday: { start: "08:00", end: "16:00", available: true },
      },
      education: [
        "Cử nhân Tâm lý học - ĐH Sư phạm Hà Nội",
        "Thạc sĩ Tư vấn Hôn nhân",
      ],
      certifications: [
        "Family Therapy Specialist",
        "Couples Counseling Expert",
      ],
      languages: ["Tiếng Việt", "English"],
      balance: 1150000,
    },
    {
      email: "healer3@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Lê Thị Phương",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tâm lý trẻ em và thanh thiếu niên",
      bio: "Chuyên gia tâm lý trẻ em với 7 năm kinh nghiệm. Giúp trẻ vượt qua khó khăn học tập, vấn đề hành vi và phát triển kỹ năng xã hội. Sử dụng liệu pháp chơi và nghệ thuật.",
      experienceYears: 7,
      consultationFee: 380000,
      chatRatePerMinute: 7500,
      rating: 4.8,
      totalRatings: 134,
      phone: "0913456789",
      avatar:
        "https://images.unsplash.com/photo-1740153204545-ac8320c44a86?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8ZG9jdG9yJTIwdmlldG5hbXxlbnwwfHwwfHx8MA%3D%3D",
      workingHours: {
        monday: { start: "08:00", end: "17:00", available: true },
        tuesday: { start: "08:00", end: "17:00", available: true },
        wednesday: { start: "08:00", end: "17:00", available: true },
        thursday: { start: "08:00", end: "17:00", available: true },
        friday: { start: "08:00", end: "17:00", available: true },
        saturday: { start: "08:00", end: "12:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: [
        "Cử nhân Tâm lý học - ĐH Sư phạm TPHCM",
        "Chứng chỉ Tâm lý Trẻ em",
      ],
      certifications: [
        "Child Psychology Specialist",
        "Play Therapy Certificate",
      ],
      languages: ["Tiếng Việt", "English"],
      balance: 850000,
    },
    {
      email: "healer4@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Phạm Minh Quang",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tư vấn nghề nghiệp và phát triển sự nghiệp",
      bio: "Coach nghề nghiệp với 9 năm kinh nghiệm giúp khách hàng định hướng sự nghiệp, tìm kiếm công việc phù hợp và phát triển kỹ năng lãnh đạo. Có nền tảng vững về tâm lý tích cực.",
      experienceYears: 9,
      consultationFee: 420000,
      chatRatePerMinute: 8500,
      rating: 4.7,
      totalRatings: 156,
      phone: "0914567890",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "08:30", end: "17:30", available: true },
        tuesday: { start: "08:30", end: "17:30", available: true },
        wednesday: { start: "08:30", end: "17:30", available: true },
        thursday: { start: "08:30", end: "17:30", available: true },
        friday: { start: "08:30", end: "17:30", available: true },
        saturday: { start: "09:00", end: "15:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: [
        "Cử nhân Quản trị Nhân lực - ĐH Kinh tế TPHCM",
        "Thạc sĩ Tâm lý Tổ chức",
      ],
      certifications: [
        "Career Coach Certificate",
        "Leadership Development Expert",
      ],
      languages: ["Tiếng Việt", "English", "中文"],
      balance: 1050000,
    },
    {
      email: "healer5@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Võ Thị Lan Anh",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Mindfulness và thiền định",
      bio: "Chuyên gia mindfulness và thiền định với 6 năm kinh nghiệm. Hướng dẫn các kỹ thuật thiền, yoga tâm linh và sống chánh niệm. Đã đào tạo tại Ấn Độ và Thái Lan về các phương pháp thiền cổ truyền.",
      experienceYears: 6,
      consultationFee: 350000,
      chatRatePerMinute: 7000,
      rating: 4.9,
      totalRatings: 189,
      phone: "0915678901",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "06:00", end: "10:00", available: true },
        tuesday: { start: "06:00", end: "10:00", available: true },
        wednesday: { start: "06:00", end: "10:00", available: true },
        thursday: { start: "06:00", end: "10:00", available: true },
        friday: { start: "06:00", end: "10:00", available: true },
        saturday: { start: "06:00", end: "12:00", available: true },
        sunday: { start: "06:00", end: "12:00", available: true },
      },
      education: [
        "Cử nhân Triết học - ĐH KHXH&NV",
        "Chứng chỉ Mindfulness Teacher",
      ],
      certifications: [
        "Certified Mindfulness Instructor",
        "Meditation Teacher",
      ],
      languages: ["Tiếng Việt", "English", "हिन्दी"],
      balance: 780000,
    },
    {
      email: "healer6@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Đỗ Văn Bình",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Coaching cuộc sống và hạnh phúc",
      bio: "Life Coach chuyên về hạnh phúc và ý nghĩa cuộc sống. 8 năm kinh nghiệm giúp mọi người tìm thấy mục đích sống, xây dựng thói quen tích cực và đạt được sự cân bằng trong cuộc sống.",
      experienceYears: 8,
      consultationFee: 390000,
      chatRatePerMinute: 8000,
      rating: 4.8,
      totalRatings: 123,
      phone: "0916789012",
      avatar:
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "19:00", end: "22:00", available: true },
        tuesday: { start: "19:00", end: "22:00", available: true },
        wednesday: { start: "19:00", end: "22:00", available: true },
        thursday: { start: "19:00", end: "22:00", available: true },
        friday: { start: "19:00", end: "22:00", available: true },
        saturday: { start: "08:00", end: "18:00", available: true },
        sunday: { start: "08:00", end: "18:00", available: true },
      },
      education: ["Cử nhân Tâm lý học - ĐH Hà Nội", "Chứng chỉ Life Coach"],
      certifications: ["Certified Life Coach", "Happiness Studies Certificate"],
      languages: ["Tiếng Việt", "English"],
      balance: 920000,
    },
    {
      email: "healer7@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Ngô Thị Thu Thảo",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Liệu pháp nghệ thuật và sáng tạo",
      bio: "Chuyên gia liệu pháp nghệ thuật với 5 năm kinh nghiệm. Sử dụng vẽ, nhạc, viết và các hình thức nghệ thuật khác để giúp khách hàng khám phá cảm xúc và chữa lành tâm hồn.",
      experienceYears: 5,
      consultationFee: 320000,
      chatRatePerMinute: 6500,
      rating: 4.6,
      totalRatings: 98,
      phone: "0917890123",
      avatar:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "10:00", end: "18:00", available: true },
        tuesday: { start: "10:00", end: "18:00", available: true },
        wednesday: { start: "10:00", end: "18:00", available: true },
        thursday: { start: "10:00", end: "18:00", available: true },
        friday: { start: "10:00", end: "18:00", available: true },
        saturday: { start: "10:00", end: "16:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: ["Cử nhân Mỹ thuật - ĐH Mỹ thuật", "Chứng chỉ Art Therapy"],
      certifications: [
        "Art Therapy Specialist",
        "Creative Expression Facilitator",
      ],
      languages: ["Tiếng Việt", "English"],
      balance: 680000,
    },
    {
      email: "healer8@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Huỳnh Minh Tâm",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Quản lý cơn giận và kiểm soát cảm xúc",
      bio: "Chuyên gia quản lý cơn giận và kiểm soát cảm xúc. 7 năm kinh nghiệm giúp mọi người học cách điều chỉnh cảm xúc tiêu cực, xử lý xung đột và cải thiện giao tiếp.",
      experienceYears: 7,
      consultationFee: 360000,
      chatRatePerMinute: 7200,
      rating: 4.7,
      totalRatings: 112,
      phone: "0918901234",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "13:00", end: "20:00", available: true },
        tuesday: { start: "13:00", end: "20:00", available: true },
        wednesday: { start: "13:00", end: "20:00", available: true },
        thursday: { start: "13:00", end: "20:00", available: true },
        friday: { start: "13:00", end: "20:00", available: true },
        saturday: { start: "09:00", end: "17:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: [
        "Cử nhân Tâm lý học - ĐH Sư phạm Huế",
        "Chứng chỉ Anger Management",
      ],
      certifications: [
        "Anger Management Specialist",
        "Emotion Regulation Therapist",
      ],
      languages: ["Tiếng Việt", "English"],
      balance: 810000,
    },
    {
      email: "healer9@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Cao Thị Minh Châu",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Tư vấn tình yêu và mối quan hệ",
      bio: "Chuyên gia tư vấn tình yêu và mối quan hệ. 6 năm kinh nghiệm giúp các cá nhân và cặp đôi xây dựng mối quan hệ lành mạnh, giải quyết xung đột và tăng cường gắn kết tình cảm.",
      experienceYears: 6,
      consultationFee: 330000,
      chatRatePerMinute: 6800,
      rating: 4.8,
      totalRatings: 145,
      phone: "0919012345",
      avatar:
        "https://images.unsplash.com/photo-1757125736482-328a3cdd9743?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGRvY3RvciUyMHZpZXRuYW18ZW58MHx8MHx8fDA%3D",
      workingHours: {
        monday: { start: "18:00", end: "22:00", available: true },
        tuesday: { start: "18:00", end: "22:00", available: true },
        wednesday: { start: "18:00", end: "22:00", available: true },
        thursday: { start: "18:00", end: "22:00", available: true },
        friday: { start: "18:00", end: "22:00", available: true },
        saturday: { start: "14:00", end: "20:00", available: true },
        sunday: { start: "14:00", end: "20:00", available: true },
      },
      education: [
        "Cử nhân Tâm lý học - ĐH KHXH&NV TPHCM",
        "Chứng chỉ Relationship Counseling",
      ],
      certifications: ["Relationship Counselor", "Dating Coach Certificate"],
      languages: ["Tiếng Việt", "English"],
      balance: 745000,
    },
    {
      email: "healer10@mentalhealthcare.com",
      password: await bcrypt.hash("healer123", 12),
      fullName: "Phan Văn Đức",
      role: "healer",
      status: "active",
      isVerified: true,
      isProfileVerified: true,
      specialization: "Phục hồi sau chấn thương tâm lý",
      bio: "Chuyên gia phục hồi chấn thương tâm lý với 9 năm kinh nghiệm. Giúp nạn nhân của bạo lực, tai nạn, thảm họa tự nhiên và các sự kiện traumatic khác lấy lại cân bằng cuộc sống.",
      experienceYears: 9,
      consultationFee: 480000,
      chatRatePerMinute: 9500,
      rating: 4.9,
      totalRatings: 187,
      phone: "0920123456",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
      workingHours: {
        monday: { start: "08:00", end: "16:00", available: true },
        tuesday: { start: "08:00", end: "16:00", available: true },
        wednesday: { start: "08:00", end: "16:00", available: true },
        thursday: { start: "08:00", end: "16:00", available: true },
        friday: { start: "08:00", end: "16:00", available: true },
        saturday: { start: "08:00", end: "12:00", available: true },
        sunday: { start: "", end: "", available: false },
      },
      education: [
        "Cử nhân Tâm lý học - ĐH Sư phạm Hà Nội",
        "Thạc sĩ Trauma Psychology",
      ],
      certifications: ["PTSD Treatment Specialist", "Trauma Recovery Expert"],
      languages: ["Tiếng Việt", "English", "한국어"],
      balance: 1280000,
    },

    // User mẫu
    {
      email: "user@mentalhealthcare.com",
      password: await bcrypt.hash("user123", 12),
      fullName: "Lê Văn Minh",
      role: "customer",
      status: "active",
      isVerified: true,
      balance: 2000000,
      phone: "0987654321",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    },
    {
      email: "user2@mentalhealthcare.com",
      password: await bcrypt.hash("user123", 12),
      fullName: "Trần Thị Hương",
      role: "customer",
      status: "active",
      isVerified: true,
      balance: 1500000,
      phone: "0976543210",
      avatar:
        "https://images.unsplash.com/photo-1494790108755-2616c95359a4?w=400&h=400&fit=crop&crop=face",
    },
  ];

  await User.insertMany(users);
  console.log("✅ Users seeded successfully");
  console.log(`   - 1 Admin`);
  console.log(`   - 10 Doctors (Bác sĩ)`);
  console.log(`   - 10 Healers (Chuyên gia tâm lý)`);
  console.log(`   - 2 Customers (Bệnh nhân)`);
};

const seedContent = async () => {
  try {
    await mongoose.connection.db.dropCollection("contents");
  } catch (e) {
    // ignore if not exists
  }

  const contents = [
    {
      title: "Thiền buổi sáng: 10 phút khởi động tập trung",
      description:
        "Bài thiền hướng dẫn 10 phút giúp thiết lập tinh thần tỉnh táo và định hướng cho một ngày hiệu quả.",
      type: "meditation",
      category: "mindfulness",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/pHKnAQuw67A?si=OcE7MxoWbZyne2ub",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200",
      duration: 600,
      difficulty: "beginner",
      tags: ["morning", "focus", "breath"],
      authorName: "Mental Health Team",
      status: "published",
      publishedAt: new Date(),
      views: 1500,
      completions: 980,
      likes: 140,
      rating: { average: 4.7, count: 78 },
      isFeatured: true,
    },
    {
      title: "Thở 4-7-8: Kỹ thuật làm dịu thần kinh",
      description:
        "Hướng dẫn video từng bước kỹ thuật thở 4-7-8 để giảm stress và hạ nhịp tim trong vài phút.",
      type: "breathing",
      category: "stress",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/VTclyNrXETw?si=eEOBDfsCFlYVkxAv",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1200",
      duration: 240,
      difficulty: "beginner",
      tags: ["breathing", "stress-relief"],
      authorName: "Breath Coach VN",
      status: "published",
      publishedAt: new Date(),
      views: 980,
      completions: 710,
      likes: 92,
      rating: { average: 4.6, count: 41 },
    },
    {
      title: "Quét thân (Body Scan) - Thư giãn sâu",
      description:
        "Video thiền quét thân giúp thả lỏng từng phần cơ thể, phù hợp trước khi ngủ hoặc sau ngày dài.",
      type: "meditation",
      category: "sleep",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/fOCfXhGQTW0?si=EhHw9pfBu8KtGSc4",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200",
      duration: 1080,
      difficulty: "intermediate",
      tags: ["body-scan", "relaxation", "sleep"],
      authorName: "Calm Guidance",
      status: "published",
      publishedAt: new Date(),
      views: 860,
      completions: 620,
      likes: 76,
      rating: { average: 4.8, count: 62 },
    },
    {
      title: "Metta (Lòng từ bi) - 12 phút nuôi dưỡng tâm",
      description:
        "Thực hành Metta để tăng lòng tử tế với bản thân và người khác, giảm tiêu cực và cô lập nội tâm.",
      type: "meditation",
      category: "self-care",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/LEhAE71brEY?si=ZgCAY8me_K4DbsVl",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200",
      duration: 720,
      difficulty: "beginner",
      tags: ["metta", "compassion", "wellbeing"],
      authorName: "Heartful Practice",
      status: "published",
      publishedAt: new Date(),
      views: 540,
      completions: 380,
      likes: 51,
      rating: { average: 4.5, count: 29 },
    },

    {
      title: "Reset 3 phút: Thiền ngắn cho người bận rộn",
      description:
        "Video 3 phút tập trung vào hơi thở giúp làm mới tâm trí giữa giờ làm việc.",
      type: "meditation",
      category: "focus",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/QXH_CPSyatI?si=EFYFkKcZC1BMtCLV",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1516387938699-a93567ec168e?w=1200",
      duration: 180,
      difficulty: "beginner",
      tags: ["quick", "reset"],
      authorName: "MicroMeditate",
      status: "published",
      publishedAt: new Date(),
      views: 410,
      completions: 380,
      likes: 36,
      rating: { average: 4.3, count: 22 },
    },
    {
      title: "Thiền âm thanh: Mưa & Sóng 14 phút",
      description:
        "Sử dụng âm thanh tự nhiên làm điểm neo để đạt trạng thái tĩnh lặng nội tâm.",
      type: "meditation",
      category: "general",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/bXyPSlZPDiY?si=LYf_xRs0ctrWyVxW",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200",
      duration: 840,
      difficulty: "beginner",
      tags: ["sound", "nature"],
      authorName: "SoundBath Collective",
      status: "published",
      publishedAt: new Date(),
      views: 370,
      completions: 260,
      likes: 33,
      rating: { average: 4.5, count: 20 },
    },
    {
      title: "Giấc ngủ sâu: Hướng dẫn 20 phút",
      description:
        "Video dẫn dắt vào trạng thái thư giãn sâu, tối ưu cho giấc ngủ và phục hồi tinh thần.",
      type: "meditation",
      category: "sleep",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/ZOn3fneDkxU?si=icLnhg-Tl9LLX-p2",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1506812574058-fc75fa93fead?w=1200",
      duration: 1200,
      difficulty: "intermediate",
      tags: ["sleep", "night"],
      authorName: "NightCalm",
      status: "published",
      publishedAt: new Date(),
      views: 2200,
      completions: 1680,
      likes: 190,
      rating: { average: 4.9, count: 150 },
      isFeatured: true,
    },
    {
      title: "Thiền sáng tạo: 16 phút mở tư duy",
      description:
        "Kỹ thuật thiền để kích hoạt tư duy sáng tạo, phù hợp trước khi lên ý tưởng hoặc viết lách.",
      type: "guide",
      category: "general",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/2ZSW6vPbEjo?si=XKSitOtYPUp9XHL7",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?w=1200",
      duration: 960,
      difficulty: "intermediate",
      tags: ["creativity", "flow"],
      authorName: "CreativeMind",
      status: "published",
      publishedAt: new Date(),
      views: 560,
      completions: 360,
      likes: 60,
      rating: { average: 4.6, count: 38 },
    },
    {
      title: "Cân bằng cảm xúc sau xung đột - 10 phút",
      description:
        "Hướng dẫn thực hành giúp hạ nhiệt cảm xúc và tìm lại bình tĩnh sau mâu thuẫn.",
      type: "meditation",
      category: "self-care",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/WQXoUj7FXI4?si=bCnx3tixxaVx0PFu",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200",
      duration: 600,
      difficulty: "intermediate",
      tags: ["emotions", "regulation"],
      authorName: "Emotional Health Lab",
      status: "published",
      publishedAt: new Date(),
      views: 410,
      completions: 280,
      likes: 45,
      rating: { average: 4.4, count: 27 },
    },
    {
      title: "Ăn chánh niệm: Video hướng dẫn bữa ăn 7 phút",
      description:
        "Thực hành chánh niệm khi ăn để tăng nhận thức và giảm ăn theo cảm xúc.",
      type: "guide",
      category: "mindfulness",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/2ZSW6vPbEjo?si=fM6WgeqTjH_WnpBt",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200",
      duration: 420,
      difficulty: "beginner",
      tags: ["eating", "mindful"],
      authorName: "Nutrition & Mind",
      status: "published",
      publishedAt: new Date(),
      views: 290,
      completions: 180,
      likes: 25,
      rating: { average: 4.3, count: 12 },
    },
    {
      title: "PMR: Thư giãn cơ tiến bộ 12 phút",
      description:
        "Progressive Muscle Relaxation (PMR) giúp giảm căng cứng cơ bắp và lo âu.",
      type: "relaxation",
      category: "anxiety",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/yMjadsm5f4o?si=pSDHx5tSD-LcJokQ",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?w=1200",
      duration: 720,
      difficulty: "beginner",
      tags: ["pmr", "relaxation"],
      authorName: "RelaxPro",
      status: "published",
      publishedAt: new Date(),
      views: 475,
      completions: 320,
      likes: 48,
      rating: { average: 4.5, count: 34 },
    },
    {
      title: "Thiền giảm lo âu: 14 phút quán chiếu nhẹ",
      description:
        "Kết hợp thở và quán chiếu để giảm lo âu, tăng cảm giác an toàn nội tại.",
      type: "meditation",
      category: "anxiety",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/6kC62Fz10wA?si=Yj8r8uzdoO_Z9Oj5",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200",
      duration: 840,
      difficulty: "beginner",
      tags: ["anxiety", "calm"],
      authorName: "AnxietyRelief",
      status: "published",
      publishedAt: new Date(),
      views: 680,
      completions: 450,
      likes: 70,
      rating: { average: 4.6, count: 50 },
    },
    {
      title: "Thiền tập trung: 20 phút nâng cao sự chú ý",
      description:
        "Bài thiền dài hơn dành cho phát triển khả năng chú ý và giảm phân tâm.",
      type: "meditation",
      category: "focus",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/4LGr8VgF2Hg?si=fyeBRoGe9HoAESZ0",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1559595500-e15296bdbb48?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8bWVkaXRhdGlvbnxlbnwwfHwwfHx8MA%3D%3D",
      duration: 1200,
      difficulty: "advanced",
      tags: ["focus", "attention"],
      authorName: "FocusLab",
      status: "published",
      publishedAt: new Date(),
      views: 420,
      completions: 200,
      likes: 47,
      rating: { average: 4.4, count: 18 },
    },
    {
      title: "Thiền lòng biết ơn: 10 phút hạnh phúc",
      description:
        "Thực hành thiền lòng biết ơn để nâng cao mức độ hài lòng và sức khoẻ tinh thần.",
      type: "meditation",
      category: "self-care",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/S5ATNvANWvY?si=Le1QYIjngJa1-wvl",
      thumbnailUrl:
        "https://plus.unsplash.com/premium_photo-1666946131242-b2c5cc73892a?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8bWVkaXRhdGlvbnxlbnwwfHwwfHx8MA%3D%3D",
      duration: 600,
      difficulty: "beginner",
      tags: ["gratitude", "wellbeing"],
      authorName: "Gratitude Sessions",
      status: "published",
      publishedAt: new Date(),
      views: 910,
      completions: 610,
      likes: 102,
      rating: { average: 4.7, count: 84 },
    },
    {
      title: "Thiền chữa lành: 18 phút tập trung nội tâm",
      description:
        "Một bài thiền sâu để nhận diện và chữa lành cảm xúc bị ức chế.",
      type: "meditation",
      category: "depression",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/VlFdjXLVPqE?si=dhfuT7hJ7mEvpnwT",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1593811167562-9cef47bfc4d7?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG1lZGl0YXRpb258ZW58MHx8MHx8fDA%3D",
      duration: 1080,
      difficulty: "intermediate",
      tags: ["healing", "inner-work"],
      authorName: "Healing Path",
      status: "published",
      publishedAt: new Date(),
      views: 620,
      completions: 380,
      likes: 55,
      rating: { average: 4.5, count: 31 },
    },
    {
      title: "Thiền năng lượng: 12 phút khởi tạo động lực",
      description:
        "Bài thiền kích hoạt năng lượng, phù hợp khi cảm thấy trì trệ hoặc thiếu động lực.",
      type: "exercise",
      category: "general",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/pHKnAQuw67A?si=M1splFK6nHibYWdu",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1602192509154-0b900ee1f851?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fG1lZGl0YXRpb258ZW58MHx8MHx8fDA%3D",
      duration: 720,
      difficulty: "beginner",
      tags: ["energy", "motivation"],
      authorName: "Energy Studio",
      status: "published",
      publishedAt: new Date(),
      views: 480,
      completions: 300,
      likes: 39,
      rating: { average: 4.4, count: 20 },
    },
    {
      title: "Hướng dẫn thư giãn trước họp - 6 phút",
      description:
        "Video ngắn giúp lấy lại bình tĩnh và tập trung ngay trước cuộc họp quan trọng.",
      type: "guide",
      category: "work",
      mediaType: "video",
      mediaUrl: "https://www.youtube.com/embed/umWXkgsVMmk?si=zMSECHdbwRG8uapp",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200",
      duration: 360,
      difficulty: "beginner",
      tags: ["work", "preparation"],
      authorName: "Office Calm",
      status: "published",
      publishedAt: new Date(),
      views: 290,
      completions: 200,
      likes: 35,
      rating: { average: 4.3, count: 14 },
    },
  ];

  // Validate and insert with ordered:false
  try {
    console.log("🔎 Validating content items before insert...");
    const invalids = [];
    for (let i = 0; i < contents.length; i++) {
      const doc = new Content(contents[i]);
      const err = doc.validateSync();
      if (err) {
        invalids.push({
          index: i,
          message: err.message,
          fields: Object.keys(err.errors || {}),
        });
      }
    }
    if (invalids.length) {
      console.warn("⚠️ Content validation warnings:", invalids);
    }

    const result = await Content.insertMany(contents, { ordered: false });
    console.log(
      `✅ Content inserted: ${Array.isArray(result) ? result.length : 0}`
    );
  } catch (err) {
    console.error("❌ Error inserting content:", err);
    if (err.writeErrors) {
      err.writeErrors.forEach((we, i) => {
        console.error(`WriteError[${i}]:`, we && we.err ? we.err.message : we);
      });
    }
    throw err;
  }

  console.log("Content seeded successfully");
};

const seed = async () => {
  await connectDB();

  try {
    await seedUsers();
    await seedContent();
    console.log("Database seeded successfully!");
    console.log("\n--- Test Accounts ---");
    console.log("Admin: admin@mentalhealthcare.com / admin123");
    console.log("Doctor: doctor@mentalhealthcare.com / doctor123");
    console.log("Healer: healer@mentalhealthcare.com / healer123");
    console.log("User: user@mentalhealthcare.com / user123");
  } catch (error) {
    console.error("Seed error:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seed();
