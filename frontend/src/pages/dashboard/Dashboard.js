import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Skeleton,
  Chip,
} from "@mui/material";
import {
  CalendarMonth,
  Book,
  SelfImprovement,
  SmartToy,
  AccountBalanceWallet,
  TrendingUp,
  Schedule,
  SentimentSatisfiedAlt,
  SentimentDissatisfied,
  SentimentNeutral,
} from "@mui/icons-material";
import { format, isToday, isTomorrow } from "date-fns";
import { vi } from "date-fns/locale";
import appointmentService from "../../services/appointment.service";
import journalService from "../../services/journal.service";

const quickActions = [
  {
    icon: <CalendarMonth />,
    title: "Đặt lịch hẹn",
    path: "/doctors",
    color: "#667eea",
  },
  {
    icon: <Book />,
    title: "Viết nhật ký",
    path: "/journal/create",
    color: "#764ba2",
  },
  {
    icon: <SelfImprovement />,
    title: "Thiền định",
    path: "/meditation",
    color: "#11998e",
  },
  {
    icon: <SmartToy />,
    title: "Chat với AI",
    path: "/chatbot",
    color: "#f093fb",
  },
];

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);

  // States for dashboard data
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    upcomingAppointments: 0,
    totalJournals: 0,
    moodScore: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [recentJournals, setRecentJournals] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [appointmentsRes, journalsRes] = await Promise.all([
        appointmentService.getMyAppointments({ limit: 20 }).catch((err) => {
          console.error("Appointments API error:", err);
          return { data: { success: false, data: [] } };
        }),
        journalService.getMyJournals({ limit: 10 }).catch((err) => {
          console.error("Journals API error:", err);
          return { data: { success: false, data: [] } };
        }),
      ]);

      // Debug logs
      console.log("=== DASHBOARD DEBUG ===");
      console.log("Appointments Response:", appointmentsRes?.data);
      console.log("Journals Response:", journalsRes?.data);

      // Process appointments - handle different response formats
      let appointments = [];
      const aptData = appointmentsRes?.data;

      if (aptData?.success && aptData?.data) {
        // Format: { success: true, data: { appointments: [...] } }
        if (
          aptData.data.appointments &&
          Array.isArray(aptData.data.appointments)
        ) {
          appointments = aptData.data.appointments;
        }
        // Format: { success: true, data: [...] }
        else if (Array.isArray(aptData.data)) {
          appointments = aptData.data;
        }
      } else if (Array.isArray(aptData?.data)) {
        appointments = aptData.data;
      } else if (Array.isArray(aptData)) {
        appointments = aptData;
      }

      console.log("Processed appointments:", appointments);
      console.log("First appointment sample:", appointments[0]);

      // Filter upcoming appointments (confirmed/pending and future date)
      // Sử dụng scheduledDate thay vì date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcomingAppointments = appointments.filter((apt) => {
        // Sử dụng scheduledDate (field đúng theo schema)
        const dateField = apt.scheduledDate || apt.date;
        if (!dateField) {
          console.log("Appointment missing date:", apt);
          return false;
        }

        const aptDate = new Date(dateField);
        aptDate.setHours(0, 0, 0, 0);

        const isUpcoming =
          ["confirmed", "pending"].includes(apt.status) && aptDate >= today;
        console.log(
          `Appointment ${apt._id}: status=${apt.status}, date=${dateField}, isUpcoming=${isUpcoming}`
        );

        return isUpcoming;
      });

      console.log("Upcoming appointments count:", upcomingAppointments.length);
      console.log("Upcoming appointments:", upcomingAppointments);

      // Process journals - handle different response formats
      let journals = [];
      let totalJournals = 0;
      const journalData = journalsRes?.data;

      if (journalData?.success && journalData?.data) {
        const data = journalData.data;

        // Format: { success: true, data: { journals: [...], pagination: {...} } }
        if (data.journals && Array.isArray(data.journals)) {
          journals = data.journals;
          totalJournals = data.pagination?.total || journals.length;
        }
        // Format: { success: true, data: [...] }
        else if (Array.isArray(data)) {
          journals = data;
          totalJournals = journals.length;
        }
      } else if (Array.isArray(journalData?.data)) {
        journals = journalData.data;
        totalJournals = journals.length;
      } else if (Array.isArray(journalData)) {
        journals = journalData;
        totalJournals = journals.length;
      }

      // Calculate mood score from recent journals (last 7 days)
      const moodScore = calculateMoodScore(journals);

      setStats({
        upcomingAppointments: upcomingAppointments.length,
        totalJournals: totalJournals,
        moodScore: moodScore,
      });

      // Sort appointments by date and time - sử dụng scheduledDate và scheduledTime
      const sortedAppointments = upcomingAppointments.sort((a, b) => {
        const dateA = new Date(a.scheduledDate || a.date);
        const dateB = new Date(b.scheduledDate || b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA - dateB;
        }
        // So sánh thời gian nếu cùng ngày
        const timeA = a.scheduledTime || a.startTime || "";
        const timeB = b.scheduledTime || b.startTime || "";
        return timeA.localeCompare(timeB);
      });

      setRecentAppointments(sortedAppointments.slice(0, 3));
      setRecentJournals(journals.slice(0, 3));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  // Calculate average mood score from journals
  const calculateMoodScore = (journals) => {
    if (!journals || journals.length === 0) return 0;

    // Filter journals with mood data from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentJournals = journals.filter((j) => {
      const journalDate = new Date(j.createdAt);
      return journalDate >= sevenDaysAgo && j.mood;
    });

    if (recentJournals.length === 0) return 0;

    // Map mood to score
    const moodScores = {
      very_happy: 10,
      happy: 8,
      neutral: 6,
      sad: 4,
      very_sad: 2,
      anxious: 3,
      angry: 3,
      stressed: 4,
      calm: 7,
      excited: 9,
    };

    const totalScore = recentJournals.reduce((sum, j) => {
      return sum + (moodScores[j.mood] || 5);
    }, 0);

    return Math.round((totalScore / recentJournals.length) * 10) / 10;
  };

  // Format appointment date/time - sử dụng scheduledDate và scheduledTime
  const formatAppointmentTime = (apt) => {
    const dateField = apt.scheduledDate || apt.date;
    const timeField = apt.scheduledTime || apt.startTime || "";

    if (!dateField) return "Chưa xác định";

    const appointmentDate = new Date(dateField);
    let dateStr = "";

    if (isToday(appointmentDate)) {
      dateStr = "Hôm nay";
    } else if (isTomorrow(appointmentDate)) {
      dateStr = "Ngày mai";
    } else {
      dateStr = format(appointmentDate, "EEEE, dd/MM", { locale: vi });
    }

    return `${dateStr}, ${timeField}`;
  };

  // Get doctor/provider name from appointment - handle multiple formats
  const getProviderName = (apt) => {
    // Format 1: apt.provider.fullName (most common based on other files)
    if (apt.provider?.fullName) {
      return apt.provider.fullName;
    }
    // Format 2: apt.provider.user.fullName
    if (apt.provider?.user?.fullName) {
      return apt.provider.user.fullName;
    }
    // Format 3: apt.doctor.fullName
    if (apt.doctor?.fullName) {
      return apt.doctor.fullName;
    }
    // Format 4: apt.doctor.user.fullName
    if (apt.doctor?.user?.fullName) {
      return apt.doctor.user.fullName;
    }
    // Format 5: apt.doctorName (direct field)
    if (apt.doctorName) {
      return apt.doctorName;
    }
    return "Chuyên gia";
  };

  // Get doctor/provider avatar from appointment
  const getProviderAvatar = (apt) => {
    return (
      apt.provider?.avatar ||
      apt.provider?.user?.avatar ||
      apt.doctor?.avatar ||
      apt.doctor?.user?.avatar ||
      null
    );
  };

  // Get provider role
  const getProviderRole = (apt) => {
    return apt.provider?.role || apt.doctor?.role || "doctor";
  };

  // Get appointment type label
  const getAppointmentTypeLabel = (apt) => {
    const type = apt.appointmentType || apt.type;
    return type === "online" ? "Trực tuyến" : "Trực tiếp";
  };

  // Get mood icon
  const getMoodIcon = (mood) => {
    const moodIcons = {
      very_happy: "😄",
      happy: "😊",
      neutral: "😐",
      sad: "😢",
      very_sad: "😭",
      anxious: "😰",
      angry: "😠",
      stressed: "😫",
      calm: "😌",
      excited: "🤩",
    };
    return moodIcons[mood] || "📝";
  };

  // Get mood color
  const getMoodColor = (mood) => {
    const moodColors = {
      very_happy: "#4caf50",
      happy: "#8bc34a",
      neutral: "#ff9800",
      sad: "#f44336",
      very_sad: "#d32f2f",
      anxious: "#9c27b0",
      angry: "#e91e63",
      stressed: "#ff5722",
      calm: "#00bcd4",
      excited: "#ffeb3b",
    };
    return moodColors[mood] || "#9e9e9e";
  };

  // Get mood score color
  const getMoodScoreColor = (score) => {
    if (score >= 8) return "#4caf50";
    if (score >= 6) return "#8bc34a";
    if (score >= 4) return "#ff9800";
    return "#f44336";
  };

  // Get mood score icon
  const getMoodScoreIcon = (score) => {
    if (score >= 7) return <SentimentSatisfiedAlt />;
    if (score >= 4) return <SentimentNeutral />;
    return <SentimentDissatisfied />;
  };

  return (
    <Box>
      {/* Welcome Section */}
      <Card
        sx={{
          mb: 3,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
        }}
      >
        <CardContent sx={{ py: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Xin chào, {user?.fullName}! 👋
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Chào mừng bạn trở lại. Hôm nay bạn cảm thấy thế nào?
          </Typography>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Thao tác nhanh
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {quickActions.map((action, index) => (
          <Grid item xs={6} md={3} key={index}>
            <Card
              component={Link}
              to={action.path}
              sx={{
                textDecoration: "none",
                transition: "transform 0.3s",
                "&:hover": { transform: "translateY(-4px)" },
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 3 }}>
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: `${action.color}20`,
                    color: action.color,
                    mx: "auto",
                    mb: 1,
                  }}
                >
                  {action.icon}
                </Avatar>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {action.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Lịch hẹn sắp tới
                  </Typography>
                  {loading ? (
                    <Skeleton width={60} height={40} />
                  ) : (
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats.upcomingAppointments}
                    </Typography>
                  )}
                </Box>
                <Avatar sx={{ bgcolor: "#667eea20", color: "#667eea" }}>
                  <CalendarMonth />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Nhật ký
                  </Typography>
                  {loading ? (
                    <Skeleton width={60} height={40} />
                  ) : (
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats.totalJournals}
                    </Typography>
                  )}
                </Box>
                <Avatar sx={{ bgcolor: "#764ba220", color: "#764ba2" }}>
                  <Book />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Điểm tâm trạng
                  </Typography>
                  {loading ? (
                    <Skeleton width={60} height={40} />
                  ) : (
                    <Box
                      sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 700,
                          color:
                            stats.moodScore > 0
                              ? getMoodScoreColor(stats.moodScore)
                              : "text.primary",
                        }}
                      >
                        {stats.moodScore > 0 ? stats.moodScore : "-"}
                      </Typography>
                      {stats.moodScore > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          /10
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
                <Avatar
                  sx={{
                    bgcolor:
                      stats.moodScore > 0
                        ? `${getMoodScoreColor(stats.moodScore)}20`
                        : "#11998e20",
                    color:
                      stats.moodScore > 0
                        ? getMoodScoreColor(stats.moodScore)
                        : "#11998e",
                  }}
                >
                  {stats.moodScore > 0 ? (
                    getMoodScoreIcon(stats.moodScore)
                  ) : (
                    <TrendingUp />
                  )}
                </Avatar>
              </Box>
              {!loading && stats.moodScore === 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: "block" }}
                >
                  Viết nhật ký để theo dõi tâm trạng
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Số dư
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    (user?.balance || 0).toLocaleString("vi-VN")
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: "#ff980020", color: "#ff9800" }}>
                  <AccountBalanceWallet />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        {/* Upcoming Appointments */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Lịch hẹn sắp tới
              </Typography>
              {loading ? (
                <Box>
                  {[1, 2].map((i) => (
                    <Box key={i} sx={{ display: "flex", gap: 2, mb: 2 }}>
                      <Skeleton variant="circular" width={40} height={40} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="60%" />
                        <Skeleton width="40%" />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : recentAppointments.length > 0 ? (
                <List sx={{ py: 0 }}>
                  {recentAppointments.map((apt) => (
                    <ListItem key={apt._id} sx={{ px: 0, py: 1 }}>
                      <ListItemAvatar>
                        <Avatar
                          src={getProviderAvatar(apt)}
                          sx={{ bgcolor: "primary.main" }}
                        >
                          {getProviderName(apt).charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography variant="subtitle2">
                              {getProviderRole(apt) === "doctor" ? "BS. " : ""}
                              {getProviderName(apt)}
                            </Typography>
                            <Chip
                              label={
                                apt.status === "confirmed"
                                  ? "Đã xác nhận"
                                  : "Chờ duyệt"
                              }
                              size="small"
                              color={
                                apt.status === "confirmed"
                                  ? "success"
                                  : "warning"
                              }
                              sx={{ height: 20, fontSize: "0.7rem" }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              mt: 0.5,
                            }}
                          >
                            <Schedule
                              sx={{ fontSize: 14, color: "text.secondary" }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {formatAppointmentTime(apt)} -{" "}
                              {getAppointmentTypeLabel(apt)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: "center", py: 3 }}>
                  <CalendarMonth
                    sx={{ fontSize: 48, color: "text.disabled", mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Chưa có lịch hẹn nào
                  </Typography>
                  <Button
                    component={Link}
                    to="/doctors"
                    variant="contained"
                    size="small"
                    sx={{ mt: 2 }}
                  >
                    Đặt lịch ngay
                  </Button>
                </Box>
              )}
              {recentAppointments.length > 0 && (
                <Button
                  component={Link}
                  to="/appointments"
                  fullWidth
                  variant="outlined"
                  sx={{ mt: 2 }}
                >
                  Xem tất cả
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Journals */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Nhật ký gần đây
              </Typography>
              {loading ? (
                <Box>
                  {[1, 2].map((i) => (
                    <Box key={i} sx={{ display: "flex", gap: 2, mb: 2 }}>
                      <Skeleton variant="circular" width={40} height={40} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="60%" />
                        <Skeleton width="40%" />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : recentJournals.length > 0 ? (
                <List sx={{ py: 0 }}>
                  {recentJournals.map((journal) => (
                    <ListItem
                      key={journal._id}
                      sx={{ px: 0, py: 1 }}
                      component={Link}
                      to={`/journal/${journal._id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: getMoodColor(journal.mood) }}>
                          {getMoodIcon(journal.mood)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography
                            variant="subtitle2"
                            noWrap
                            sx={{ maxWidth: 200 }}
                          >
                            {journal.title || "Nhật ký không tiêu đề"}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {format(
                              new Date(journal.createdAt),
                              "dd/MM/yyyy, HH:mm",
                              { locale: vi }
                            )}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: "center", py: 3 }}>
                  <Book sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Chưa có nhật ký nào
                  </Typography>
                  <Button
                    component={Link}
                    to="/journal/create"
                    variant="contained"
                    size="small"
                    sx={{ mt: 2 }}
                  >
                    Viết nhật ký
                  </Button>
                </Box>
              )}
              {recentJournals.length > 0 && (
                <Button
                  component={Link}
                  to="/journal"
                  fullWidth
                  variant="outlined"
                  sx={{ mt: 2 }}
                >
                  Xem tất cả
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
