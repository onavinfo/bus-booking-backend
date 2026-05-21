const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const profileRouter = express.Router();

const profileController = require('../Controllers/profileController');
const { isAuthenticated } = require('../Middlewares/auth');

const uploadPath = path.join(__dirname, "../uploads/profile");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// // Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;

    cb(null, uniqueName);
  }
});

// // File Filter
const fileFilter = (req, file, cb) => {

  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/webp"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image files allowed"), false);
  }
};

// // Upload Middleware
const upload = multer({
  storage,
  fileFilter
});

profileRouter.get('/profile', isAuthenticated, profileController.profile);

profileRouter.put('/profile', isAuthenticated, profileController.updateOwnProfile);

profileRouter.get('/users', isAuthenticated, profileController.allUsers);

profileRouter.get('/owners', isAuthenticated, profileController.allUsers);

profileRouter.get('/onlyUsers', isAuthenticated, profileController.onlyUsers);

profileRouter.delete('/users/:userId', isAuthenticated, profileController.deleteUser);

profileRouter.post('/addUser', isAuthenticated, profileController.addUser);

profileRouter.get('/users/:userID', isAuthenticated, profileController.getSingleUser);

profileRouter.put('/users/:userId', isAuthenticated, profileController.updateUserProfile);

profileRouter.put("/upload-profile", isAuthenticated, upload.single("profileImage"),
  profileController.uploadProfilePhoto);

exports.profileRouter = profileRouter;

