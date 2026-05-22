const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
require("dotenv").config();

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const rootDir = require("./utils/pathUtil");
const User = require("./Models/userModel");

const { authRouter } = require("./Routes/authRouter");
const { busRouter } = require("./Routes/busRouter");
const { pathRouter } = require("./Routes/pathRouter");
const { profileRouter } = require("./Routes/profileRouter");
const { bookRouter } = require("./Routes/bookRouter");
const { revenueRouter } = require("./Routes/revenueRouter");

const app = express();

// ======================
// MIDDLEWARE
// ======================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  cors({
    origin: "https://bus-booking-frontend-bice.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(rootDir, "public")));

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ======================
// DATABASE
// ======================

const db = process.env.DB_PATH;

if (!db) {
  console.log("❌ DB_PATH is missing in Vercel Environment Variables");
}

// ======================
// MONGODB CONNECTION
// ======================

mongoose
  .connect(db)
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((err) => {
    console.log("❌ MongoDB Connection Error:", err);
  });

// ======================
// SESSION CONFIG
// ======================

app.use(
  session({
    secret: "Bus system",
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: db,
      collectionName: "sessions",
    }),

    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// ======================
// USER AUTH MIDDLEWARE
// ======================

app.use(async (req, res, next) => {
  res.locals.isLoggedIn = req.session.isLoggedIn || false;

  if (!req.session.userId) {
    req.user = null;
    return next();
  }

  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      req.user = null;
      return next();
    }

    req.user = user;
    res.locals.user = user;
  } catch (err) {
    console.log(err);
  }

  next();
});

// ======================
// TEST ROUTE
// ======================

app.get("/", (req, res) => {
  res.send("✅ Backend running successfully");
});

// ======================
// ROUTES
// ======================

app.use(authRouter);
app.use(busRouter);
app.use(pathRouter);
app.use(profileRouter);
app.use(bookRouter);
app.use(revenueRouter);

// ======================
// EXPORT APP
// ======================

module.exports = app;