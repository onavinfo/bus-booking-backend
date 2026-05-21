const User = require('../Models/userModel');
const bcrypt = require('bcrypt');
const BusDetail = require('../Models/busModel');
const Booking = require('../Models/bookingModel');


exports.profile = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ message: "Please login first", success: false });
        }
        const userDetails = await User.findById(userId).select("-password");
        if (!userDetails) {
            return res.json({ message: "Failed to get user", success: false, data: userDetails });
        }
        return res.json({ message: "User fetched successfully", success: true, data: userDetails });
    } catch (error) {
        console.log(error);
        res.json({ message: "server error", success: false });
    }
}

exports.updateOwnProfile = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.json({ message: "User not found", success: false });
        }
        const { name, email, phnNo, DOB, address } = req.body;

        const updateUser = await User.findByIdAndUpdate(userId, req.body, { new: true });

        res.json({ message: "Profile updated successfully", success: true, data: updateUser });
    } catch (err) {
        console.log(err);
        res.json({ message: "failed to update profile", success: false });
    }
}

exports.allUsers = async (req, res, next) => {
    try {
        let userList;

        if (req.session.role === 'admin') {
            userList = await User.find();
        } else if (req.session.role === 'owner') {
            // Find buses
            const buses = await BusDetail.find({
                owner: req.session.userId
            }).select('_id');

            // find bus ids
            const busIds = buses.map(bus => bus._id);

            // find bookings
            const bookings = await Booking.find({
                bus: { $in: busIds }
            }).populate("user", "name email DOB phnNo role address");

            const uniqueUsersMap = new Map();

            bookings.forEach((booking) => {
                if (booking.user) {
                    uniqueUsersMap.set(
                        booking.user._id.toString(),
                        booking.user
                    );
                }
            });

            userList = Array.from(uniqueUsersMap.values());
        }

        res.json({ message: "User List is here", success: true, data: userList });
    } catch (error) {
        res.json({ message: "server error to fetch userList", success: false });
    }
}

exports.onlyUsers = async (req, res) => {
    try {
        if(req.session.role !== "admin" && req.session.role !== "owner"){
            return res.status(403).json({message: "Unauthorized", success: false});
        }
        const userList = await User.find({
            role: "user"
        }).select("name email, phnNo DOB");

        return res.json({ message: "Only Users fetched", success: true, data: userList });
    } catch (err) {
        console.log("Only user fecthed error", err);
        return res.status(500).json({ message: "Only User fetched servver error", success: false });
    }
}

exports.deleteUser = async (req, res, next) => {
    try {
        const userId = req.params.userId;

        const deletedUser = await User.findByIdAndDelete(userId);

        if (!deletedUser) {
            return res.json({ message: "User not found for deletion", success: false });
        }
        res.json({ message: "User deleted successfully", success: true });
    } catch (err) {
        res.json({ message: "server error while deleting user", success: false });
    }
}

exports.addUser = async (req, res, next) => {
    try {
        const { name, email, password, phnNo, role, DOB, address } = req.body;

        if (req.session.role !== "admin") {
            return res.json({ message: "Only admin can add users", success: false });
        }

        if (!name || !email || !password || !phnNo || !role) {
            return res.json({ message: "All required fields must be filled", success: false });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.json({ message: "user already exist", success: false });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = await User.create({
            name, email, password: hashedPassword, phnNo, role: role || "user", DOB,
            address: {
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
                country: address.country
            }
        });

        return res.json({
            message: `${role === "owner" ? " Owner" : "User"} created successfully`,
            success: true, data: newUser
        });

    } catch (err) {
        console.log("Add user error", err);
        return res.json({ message: "Failed to add user", success: false });
    }
}

exports.getSingleUser = async (req, res) => {
    try {
        const userID = req.params.userID;
        const user = await User.findById(userID);

        if (!user) {
            return res.json({ message: "User not found", success: false, });
        }

        return res.json({ message: "User found", success: true, data: user });

    } catch (err) {
        res.json({ success: false, message: "Error fetching user" });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.params.userId;

        const updateData = { ...req.body };

        if (updateData.role && req.session.role !== "admin") {
            delete updateData.role;
        }

        if (updateData.password && updateData.password.trim() !== "") {
            updateData.password = await bcrypt.hash(updateData.password, 12);
        } else {
            delete updateData.password;
        }

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

        if (!user) {
            return res.json({ message: "User is not found", success: false });
        }
        return res.json({ message: "Profile updated", success: true, data: user });
    } catch (err) {
        return res.json({ message: "failed to update user", success: false });
    }
}

exports.uploadProfilePhoto = async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!req.file) {

            return res.json({ success: false, message: "No image uploaded" });
        }

        const imagePath = `/uploads/profile/${req.file.filename}`;

        const updatedUser =
            await User.findByIdAndUpdate(userId,
                { profileImage: imagePath },
                { new: true }
            );

        return res.json({
            success: true, message: "Profile image uploaded",
            data: updatedUser
        });

    } catch (err) {

        console.log(err);

        return res.json({
            success: false,
            message: "Upload failed"
        });
    }
};
