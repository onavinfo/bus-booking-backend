const express = require('express');

const authRouter = express.Router();

const authController = require('../Controllers/authController');
const { auth } = require('google-auth-library');

authRouter.post('/signup', authController.signUpValidation, authController.signUp);

authRouter.post('/signin', authController.signIn);

authRouter.post('/google', authController.googleAuth);

authRouter.post('/signout', authController.signOut);

authRouter.post("/forgot-password", authController.forgotPassword);

authRouter.post("/verify-otp",authController.verifyOtp);

authRouter.post("/reset-password", authController.resetPassword);

exports.authRouter = authRouter;