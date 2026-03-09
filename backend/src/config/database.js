const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/mental_healthcare";

    const conn = await mongoose.connect(uri, {
      // mongoose 6+ uses sensible defaults; keep options here if needed
    });

    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    // Do NOT attach process.on('SIGINT') here to avoid duplicate handlers.
    // The server process should handle graceful shutdown.
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // exit so platform (Render) marks the service as failed and you can see logs
    process.exit(1);
  }
};

module.exports = connectDB;
