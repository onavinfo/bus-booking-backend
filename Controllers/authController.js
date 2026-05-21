const { check, validationResult } = require('express-validator');
const User = require('../Models/userModel')
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");
const client = new OAuth2Client(
    "699901512901-393ccifl61peo24kpbb1jt74fp19lk29.apps.googleusercontent.com"
);



const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",   // ✅ correct
    port: 587,
    secure: false,
    auth: {
        user: "puridivya314@gmail.com",
        pass: "cnkpjklcqosodqyf", // ❗ remove spaces
    },
});
exports.googleAuth = async (req, res) => {
    try {
        const { credential, mode } = req.body;

        if (!credential) {
            return res.status(400).json({ message: "No credential provided", success: false });
        }
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: "699901512901-393ccifl61peo24kpbb1jt74fp19lk29.apps.googleusercontent.com"
        });
        const payload = ticket.getPayload();
        const { email, name, sub } = payload;

        let user = await User.findOne({ email });

        if (mode === "signup" && user) {
            return res.status(400).json({ message: "User already exist. Please Login", success: false });
        }

        if (mode === "login" && !user) {
            return res.status(404).json({ message: "User not found.  please first signup", success: false });
        }

        if (!user) {
            user = await User.create({
                name, email, googleId: sub, role: "user"
            })
        }

        req.session.userId = user._id;
        req.session.role = user.role;

        return res.json({ message: "Google auth success", success: true, data: user });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Google auth failed", success: false });
    }
};

exports.signIn = async (req, res, next) => {
    const { email, password } = req.body
    //console.log("post login:", req.body);
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(422).json({
            message: "login error",
            isLoggedIn: false,
            success: false,
            errors: ["User does not exist"],
            user: {}
        })
    }

    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) {
        return res.status(422).json({
            message: "login error",
            isLoggedIn: false,
            success: false,
            errors: ["Incorrect password"],
            oldInput: { email },
            user: {}
        });
    }
    req.session.isLoggedIn = true;
    req.session.userId = user._id.toString();
    req.session.role = user.role;

    //console.log("Session after login:", req.session);
    req.session.save(err => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: "Error in save", success: false });
        }

        //console.log("user info:", user);
        return res.json({
            message: "login successful",
            success: true,
            isLoggedIn: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phnNo: user.phnNo,
                DOB: user.DOB,
                role: user.role,
                address: user.address,

            }
        });
    });
}


exports.signOut = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.json({ message: "Log Out failed", success: false })
        }
        res.clearCookie('connect.sid');
        // console.log("Sign out successfully");
        res.json({ message: "Logged Out successfully", success: true });
    });
}

exports.signUp = (req, res, next) => {
    res.json({
        message: "Signup Page", isLoggedIn: false, errors: [],
        oldInput: {
            name: "", email: "", password: "", phnNo: "", DOB: "", role: "",
            address: {
                street: "",
                city: "",
                state: "",
                zipCode: "",
                country: ""
            }
        },
        user: {}
    })
}

exports.signUpValidation = [
    check('name')
        .trim()
        .matches(/^[A-Za-z\s]+$/)
        .withMessage("Name should contain only characters."),

    check('email')
        .trim()
        .isEmail()
        .withMessage("Please enter a valid email")
        .normalizeEmail(),

    check('password')
        .isLength({ min: 4 })
        .withMessage("Password must be atleast 4 characters.")
        .matches(/[a-z]/)
        .withMessage("password should contain atleast one lowercase"),

    check('phnNo')
        .trim()
        .isLength({ min: 10, max: 10 })
        .withMessage("Phone number must be exactly 10 digits.")
        .bail()
        .matches(/^[0-9]+$/)
        .withMessage("Phone number should contain only digits."),

    check('role')
        .isIn(['user', 'admin', 'owner'])
        .withMessage("Invalid role selected"),

    check('address.street')
        .notEmpty()
        .withMessage("Street is required"),

    check('address.city')
        .notEmpty()
        .withMessage("City is required"),

    check('address.state')
        .notEmpty()
        .withMessage("State is required"),

    check('address.zipCode')
        .isLength({ min: 6, max: 6 })
        .withMessage("Zip code should be 6 digits"),

    check('address.country')
        .notEmpty()
        .withMessage("Country is required"),

]

exports.signUp = async (req, res, next) => {
    const { name, email, password, phnNo, DOB, role, address } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            message: "Validation failed",
            isLoggedIn: false, errors: errors.array().map(err => err.msg),
            oldInput: { name, email, password, phnNo, DOB, role, address },
            user: {}
        });
    };

    await bcrypt.hash(password, 12).then(hashedPassword => {
        const user = new User({
            name, email, password: hashedPassword, phnNo, DOB, role,
            address: {
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
                country: address.country
            }
        });
        return user.save();
    })
    return res.json({
        message: "signup successful",
        data: { name, email, phnNo, DOB, role, address },
        succcess: true
    });
}

// ====== forgot Password ====
// exports.forgotPassword = async (req, res) => {
//     try {
//         const { email } = req.body;

//         const user = await User.findOne({ email });

//         if (!user) {
//             return res.json({ success: false, message: "User not found" });
//         }

//         // create token
//         const token = crypto.randomBytes(32).toString("hex");

//         user.resetPasswordToken = token;
//         user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 min

//         await user.save();

//         // ⚠️ Instead of email, just return link (for now)
//         const resetLink = `http://localhost:5173/reset-password/${token}`;

//         res.json({
//             success: true,
//             message: "Reset link generated",
//             resetLink
//         });

//     } catch (err) {
//         res.json({ success: false, message: "Error in forgot password" });
//     }
// };



exports.forgotPassword = async (req, res) => {

    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Generate otp
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        user.otp = otp;
        user.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 min

        await user.save();

        await transporter.sendMail({
            to: email,
            subject: "Password Reset OTP",
            html:` <h1>${otp}</h1>`
        })

        res.json({
            success: true,
            message: "OTP sent to email"
        });

    } catch (err) {
        console.log(err);
        res.json({ success: false, message: "Error in sending OTP" });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ message: "User not found", succcess: false });
        }

        if (user.otp !== String(otp)) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        if (user.otpExpiry < Date.now()) {
            return res.json({ success: false, message: "OTP expired" });
        }

        return res.json({ success: true, message: "OTP verified" });
    } catch (err) {
        return res.json({ message: "OTP verification failed", success: false });
    }
};

// ==== reset Password === 
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ message: "User not found", success: false });
        }

        if (user.otp !== String(otp)) {
            return res.json({ success: false, message: "Invalid otp for reset" });
        }

        if (user.otpExpiry < Date.now()) {
            return res.json({ message: "Expired otp", success: false });
        }

        if (!newPassword || newPassword.length < 4) {
            return res.json({
                success: false,
                message: "Password must be atleast 4 characters"
            });
        }

        user.password = await bcrypt.hash(newPassword, 12);

        user.otp = null;
        user.otpExpiry = null;

        await user.save();

        res.json({ success: true, message: "Password reset successful" });

    } catch (err) {
        return res.json({ success: false, message: "Reset failed" });
    }
};