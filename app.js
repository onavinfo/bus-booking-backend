const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session')
const MongoStore = require('connect-mongo').default;
const User = require('./Models/userModel')

const DB_PATH = "mongodb+srv://puridivya314_db_user:lYYsoCBMYqhyrquy@cluster0.sxtloss.mongodb.net/busData";

const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const rootDir = require('./utils/pathUtil');
const { default: mongoose } = require('mongoose');

const { authRouter } = require('./Routes/authRouter');
const { busRouter } = require('./Routes/busRouter');
const { pathRouter } = require('./Routes/pathRouter');
//const {scheduleRouter} = require('./Routes/scheduleRouter');
const { profileRouter } = require('./Routes/profileRouter');
const { bookRouter } = require('./Routes/bookRouter');
const { revenueRouter } = require("./Routes/revenueRouter");

const app = express();

app.use(express.urlencoded());
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(rootDir, 'public')));

const store = MongoStore.create({
    mongoUrl: DB_PATH,
    collectionName: 'sessions'
});

app.use(session({
    secret: "Bus system",
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.use("/uploads",
    express.static(
        path.join(__dirname, "uploads"))
);

// if (!fs.existsSync(uploadPath)) {
//     fs.mkdirSync(uploadPath, { recursive: true });
// }

app.use(async (req, res, next) => {
    res.locals.isLoggedIn = req.session.isLoggedIn || false;
    if (!req.session.userId) {
        res.user = null;
        return next();
    }
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            res.locals.user = null;
            return next();
        }
        req.user = user || null;
        res.locals.user = user || null;
    } catch (err) {
        console.log(err);
    }
    next();
});


app.use(authRouter);
app.use(busRouter);
app.use(pathRouter);
app.use(profileRouter);
app.use(bookRouter);
app.use(revenueRouter);


const port = 3000;
mongoose.connect(DB_PATH).then(() => {
    console.log("Connected to mongoose");
    app.listen(port, () => {
        console.log(`Server running on address: http://localhost:${port}`);
    });
}).catch((err) => {
    console.log("Error while connecting to mongoose", err);
});

