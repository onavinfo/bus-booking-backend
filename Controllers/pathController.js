const pathDetail = require('../Models/pathModel');
const busDetail = require('../Models/busModel');
const Booking = require("../Models/bookingModel");

exports.createPath = async (req, res) => {
    try {
        if (req.session.role !== "admin") {
            return res.json({
                message: "Only admin can add paths",
                success: false
            });
        }

        const { source, destination, stops, distance } = req.body;

        if (!source || !destination) {
            return res.json({ message: "Source and destination are required", success: false });
        }

        if (!Array.isArray(stops) || stops.length === 0) {
            return res.json({ message: "Stops are required", success: false });
        }

        const normalizedSource = source.trim().toLowerCase();

        const normalizedDestination = destination.trim().toLowerCase();

        const normalizedStops = stops.map((stop, index) => ({
            stopName: stop.stopName.trim().toLowerCase(),
            order: index + 1
        }));

        const stopNamesString = normalizedStops.map(stop => stop.stopName)
            .join(",");

        const existingPaths = await pathDetail.findOne({
            source: normalizedSource,
            destination: normalizedDestination
        }) || [];

        // const duplicateStops = existingPaths.find(path => {
        //     const existingStopString = path.stops.map(stop =>
        //         stop.stopName.trim.toLowerCase()).join(",");

        //     return existingStopString === stopNamesString;
        // });

        const duplicatePath = existingPaths.find(path => {

            const existingStopsString = Array.isArray(path.stops)
                ? path.stops
                    .map(stop => stop.stopName.trim().toLowerCase())
                    .join(",")
                : "";

            return existingStopsString === stopNamesString;
        });

        if (duplicatePath) {
            return res.json({ message: "This path or route is already exists", success: false });
        }

        const newPath = await pathDetail.create({
            source: normalizedSource,
            destination: normalizedDestination,
            stops: normalizedStops,
            distance
        });

        return res.json({ message: "Path added successfully", success: true, data: newPath });

    } catch (err) {
        console.log(err);
        return res.json({ message: "Server error while adding path", success: false });
    }
}

exports.getPath = async (req, res) => {
    try {
        if (req.session.role === "admin") {
            const path = await pathDetail.find();
            return res.json({ message: "Path fetched successfully", success: true, data: path });
        }

        if (req.session.role === "owner") {
            const buses = await busDetail.find({
                owner: req.session.userId
            });

            const pathIds = [
                ...new Set(
                    buses.map(bus => bus.pathId.toString())
                )
            ];

            const ownerPaths = await pathDetail.find({
                _id: { $in: pathIds }
            });

            return res.json({ message: "Owner paths fetched", success: true, data: ownerPaths });
        }
        return res.json({ message: "Unauthorized", success: false });

    } catch (err) {
        console.log(err);
        return res.json({ message: "Server error while fectching all paths", success: false });
    }
}

exports.pathById = async (req, res) => {
    try {
        const pathId = req.params.pathId;

        const path = await pathDetail.findById(pathId);

        if (!path) {
            return res.json({ message: "path not found", success: false });
        }

        if (req.session.role === "owner") {
            const bus = await busDetail.findOne({
                owner: req.session.userId,
                pathId
            });

            if (!bus) {
                return res.json({ message: "Access denied", success: false });
            }
        }

        return res.json({ message: "Path fetched successfully", success: true, data: path });
    } catch (error) {
        console.log(error);
        return res.json({ message: "server error", success: false });
    }
}

exports.updatePath = async (req, res) => {
    try {
        if (req.session.role !== "admin") {
            return res.json({ message: "Only admin can update paths", success: false });
        }

        const pathId = req.params.pathId;

        const updatePath = await pathDetail.findByIdAndUpdate(
            pathId, req.body, { new: true }
        );

        if (!updatePath) {
            return res.json({ message: "Path not found", success: false });
        }
        return res.json({ message: "Path updated successfully", success: true, data: updatePath });
    } catch (error) {
        console.log(err);
        return res.json({ message: "Update failed", success: false });
    }
}

const getTodayStart = () => {
    const now = new Date();
    return new Date(Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    ));
};

exports.deletePath = async (req, res) => {
    try {
        if (req.session.role !== "admin") {
            return res.json({ message: "Only admin can delete paths", success: false });
        }
        const pathId = req.params.pathId;

        const path = await pathDetail.findById(pathId);

        if (!path) {
            return res.json({ message: "Path not found", success: false });
        }

        const todayStart = getTodayStart();

        const futureBookings = await Booking.countDocuments({
            pathId: pathId,
            date: { $gte: todayStart }
        });

        if (futureBookings > 0) {
            return res.json({ message: "Cannot delete path with upcoming bookings", success: false });
        }
        const deletedPath = await pathDetail.findByIdAndDelete(pathId);

        if (!deletedPath) {
            return res.json({ message: "Path not found for deletion", success: false });
        }
        return res.json({ message: "Path deleted successfully", success: true });
    } catch (error) {
        console.log("Deletion error", error);
        return res.json({ message: "Deletion failed", success: false });
    }
}