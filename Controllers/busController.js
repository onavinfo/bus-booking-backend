const busDetail = require('../Models/busModel');
const Booking = require('../Models/bookingModel');
const mongoose = require("mongoose");


//======== Middleware =====//
exports.pre = async (req, res, next) => {
    try {
        const { forwardTimings = [], reverseTimings = [], isTwoWay } = req.body;
        const twoWay = req.body.isTwoWay === true || req.body.isTwoWay === 'true' || isTwoWay === true;

        if (!Array.isArray(forwardTimings) || forwardTimings.length === 0) {
            return res.status(400).json({ message: "Forward timings required", success: false });
        }

        const validateSegment = (segment, segmentName) => {
            for (let i = 0; i < segment.length; i++) {
                const t = segment[i];

                if (!t?.stopName) {
                    return `Stop name missing at ${segmentName} index ${i}`;
                }

                const price = Number(t.priceFromStart ?? 0);
                if (i === 0 && Number.isNaN(price)) {
                    segment[i].priceFromStart = 0;
                }

                if (Number.isNaN(price)) {
                    return `Invalid price at ${t.stopName}`;
                }

                if (i > 0 && price < Number(segment[i - 1].priceFromStart ?? 0)) {
                    return `Prices must increase in ${segmentName} at ${t.stopName}`;
                }

                segment[i].priceFromStart = price;
            }
            return null;
        };

        const forwardError = validateSegment(forwardTimings, 'forwardTimings');
        if (forwardError) {
            return res.status(400).json({ message: forwardError, success: false });
        }

        if (twoWay) {
            const reverseArray = Array.isArray(reverseTimings) ? reverseTimings : [];
            const reverseError = validateSegment(reverseArray, 'reverseTimings');
            if (reverseError) {
                return res.status(400).json({ message: reverseError, success: false });
            }
            req.body.timings = [...forwardTimings, ...reverseArray];
            req.body.reverseTimings = reverseArray;
        } else {
            req.body.timings = [...forwardTimings];
            req.body.reverseTimings = [];
        }

        req.body.basePrice = forwardTimings[0]?.priceFromStart ?? 0;
        req.body.maxPrice = forwardTimings[forwardTimings.length - 1]?.priceFromStart ?? 0;
        req.body.departureTime = forwardTimings[0]?.departure || "";
        req.body.isTwoWay = twoWay;

        next();
    } catch (err) {
        console.log("Pre middleware error: ", err);
        return res.status(500).json({ success: false });
    }
};

// ========== create Bus ======
exports.createBus = async (req, res, next) => {
    try {

        if (!req.session || !req.session.userId) {
            return res.json({ message: "Unauthorized", success: false });
        }

        const { pathId, busName, busNumber, totalSeats, forwardTimings, reverseTimings = [], isTwoWay, isAC } = req.body;

        // Validation
        const seatCount = Number(totalSeats);
        if (!busName || busName.trim().length < 2) {
            return res.json({ message: "Bus Name is required", success: false });
        }

        if (!busNumber || busNumber.trim().length < 3 || busNumber.length > 12) {
            return res.json({ message: "Bus Number must be between 3 and 12 characters", success: false });
        }

        if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 60) {
            return res.json({ message: "Total Seats must be between 1 and 60", success: false });
        }

        if (!Array.isArray(forwardTimings) || forwardTimings.length === 0) {
            return res.json({ message: "Forward timings required", success: false });
        }

        // Forward Timings
        for (let i = 0; i < forwardTimings.length; i++) {

            const t = forwardTimings[i];

            const isFirst = i === 0;

            const isLast = i === forwardTimings.length - 1;

            const arrival = t?.arrival?.trim() || "";

            const departure = t?.departure?.trim() || "";

            if (!t?.stopName) {
                return res.json({
                    message: `Stop name missing at index ${i}`,
                    success: false
                });
            }

            // First stop
            if (isFirst) {

                if (!departure) {
                    return res.json({
                        message: `Departure required at forward stop ${t.stopName}`,
                        success: false
                    });
                }

                t.priceFromStart = 0;
            }

            // Last stop
            else if (isLast) {

                if (!arrival) {
                    return res.json({
                        message: `Arrival required at forward stop ${t.stopName}`,
                        success: false
                    });
                }
            }

            // Middle stops
            else {

                if (!arrival || !departure) {
                    return res.json({
                        message: `Arrival and departure required at forward stop ${t.stopName}`,
                        success: false
                    });
                }
            }

            const price = Number(t.priceFromStart);

            if (!Number.isFinite(price) || price < 0) {
                return res.json({
                    success: false,
                    message: `Invalid price at stop ${t.stopName}`
                });
            }

            t.priceFromStart = price;

            // Increasing price validation
            if (
                i > 0 &&
                t.priceFromStart <
                Number(forwardTimings[i - 1].priceFromStart)
            ) {
                return res.json({
                    success: false,
                    message: "Prices must be in increasing order"
                });
            }

            // Arrival should be before departure
            if (
                arrival &&
                departure &&
                arrival > departure
            ) {
                return res.json({
                    success: false,
                    message: `Departure must be after arrival at ${t.stopName}`
                });
            }
        }

        // Reverse Timing Validation
        // Reverse Timing Validation
        if (isTwoWay) {

            if (
                !Array.isArray(reverseTimings) ||
                reverseTimings.length === 0
            ) {
                return res.json({
                    message: "Reverse timings required",
                    success: false
                });
            }

            for (let i = 0; i < reverseTimings.length; i++) {

                const t = reverseTimings[i];

                const isFirst = i === 0;

                const isLast =
                    i === reverseTimings.length - 1;

                const arrival = t?.arrival?.trim() || "";

                const departure =
                    t?.departure?.trim() || "";

                if (!t?.stopName) {
                    return res.json({
                        message: `Return stop name missing at index ${i}`,
                        success: false
                    });
                }

                // First stop
                if (isFirst) {

                    if (!departure) {
                        return res.json({
                            message: `Departure required at return stop ${t.stopName}`,
                            success: false
                        });
                    }
                }

                // Last stop
                else if (isLast) {

                    if (!arrival) {
                        return res.json({
                            message: `Arrival required at return stop ${t.stopName}`,
                            success: false
                        });
                    }
                }

                // Middle stops
                else {

                    if (!arrival || !departure) {
                        return res.json({
                            message: `Arrival and departure required at return stop ${t.stopName}`,
                            success: false
                        });
                    }
                }

                const price = Number(t.priceFromStart);

                if (!Number.isFinite(price) || price < 0) {
                    return res.json({
                        success: false,
                        message: `Invalid return price at stop ${t.stopName}`
                    });
                }

                t.priceFromStart = price;

                if (
                    i > 0 &&
                    price <
                    Number(reverseTimings[i - 1].priceFromStart)
                ) {
                    return res.json({
                        success: false,
                        message: "Return prices must increase"
                    });
                }

                if (
                    arrival &&
                    departure &&
                    arrival > departure
                ) {
                    return res.json({
                        success: false,
                        message: `Departure must be after arrival at ${t.stopName}`
                    });
                }
            }
        }

        const timings = isTwoWay ? [...forwardTimings, ...reverseTimings] : [...forwardTimings];

        const basePrice = Number(forwardTimings[0].priceFromStart);
        const maxPrice = Number(forwardTimings[forwardTimings.length - 1].priceFromStart || 0);
        const departureTime = forwardTimings[0]?.departure || "";

        // Create Bus
        const newBus = await busDetail.create({
            owner: req.session.userId,
            pathId,
            busName: busName.trim(),
            busNumber: busNumber.trim().toUpperCase(),
            totalSeats: seatCount,
            forwardTimings,
            reverseTimings: isTwoWay ? reverseTimings : [],
            timings,
            isTwoWay: !!isTwoWay,
            isAC: !!isAC,
            basePrice,
            maxPrice,
            departureTime
        });

        return res.json({ message: "Bus added successfully", success: true, data: newBus });

    } catch (err) {
        console.log("Create Bus Error:", err);

        if (err.code === 11000) {
            return res.json({ message: "Bus number already exist", success: false });
        }
        return res.status(500).json({
            message: "Failed to add bus",
            success: false
        });
    }
}

// ======= Get All buses ======= //
exports.allBus = async (req, res) => {
    try {
        const { price, ac, from, to } = req.query;

        let filter = {};

        const userId = req.session?.userId;
        const role = req.session?.role;

        if (role === "owner") {
            filter.owner = userId;
        }

        if (ac !== undefined && ac !== "") {
            filter.isAC = ac === "true";
        }

        if (price) {
            filter.basePrice = { $lte: Number(price) };
        }

        let buses = await busDetail.find(filter)
            .populate("owner")
            .populate("pathId");

        if (from && to) {
            buses = buses.filter((bus) => {
                const stops = getBusTimings(bus).map((t) => normalizeStop(t.stopName));
                const source = normalizeStop(from);
                const destination = normalizeStop(to);

                const sourceIndex = stops.indexOf(source);
                const destinationIndex = stops.indexOf(destination);

                return sourceIndex !== -1 && destinationIndex !== -1 && sourceIndex < destinationIndex;
            });
        }

        const busesWithBookingCount = await Promise.all(
            buses.map(async (bus) => {
                const count = await Booking.countDocuments({ bus: bus._id });

                return {
                    ...bus.toObject(),
                    bookingCount: count
                };
            })
        );

        return res.json({
            message: "Buses fetched", success: true, data: busesWithBookingCount
        });

    } catch (err) {
        console.log("Error fetching bus: ", err);
        return res.json({
            success: false,
            message: "Error while fetching buses"
        });
    }
};

//  ===== Single bus by id ==== //
exports.busById = async (req, res, next) => {
    try {
        const busId = req.params.busId;

        const bus = await busDetail.findById(busId)
            .populate("pathId").populate('owner');

        if (!bus) {
            console.log("Bus is not found");
            return res.json({ message: "failed to get bus for update", success: false });
        }
        if (req.session.role === "owner" && bus.owner._id.toString() !== req.session.userId) {
            return res.json({ message: "Unauthorized aceess", success: false });
        }

        const bookings = await Booking.find({
            bus: busId, status: { $ne: "cancelled" }
        });

        const busData = bus.toObject();

        busData.bookings = bookings;

        res.json({ message: "Bus fetched successfully", success: true, data: busData });
    } catch (error) {
        console.log(error);
        res.json({ message: "server error", success: false });
    }
}

// ===== Update bus ====
exports.updateBus = async (req, res) => {
    try {
        const { busId } = req.params;
        const userId = req.session?.userId;
        const role = req.session?.role;

        if (!userId) {
            return res.json({ message: "unauthorized", success: false });
        }

        const bus = await busDetail.findById(busId);

        if (!bus) {
            return res.json({ message: "Bus not found", success: false });
        }

        if (role == "owner" && bus.owner.toString() !== userId) {
            return res.json({ message: "You can update only your buses", success: false });
        }

        const validateTimings = (timings) => {
            for (let i = 0; i < timings.length; i++) {
                const t = timings[i];

                const price = Number(t.priceFromStart || 0);

                if (isNaN(price)) {
                    return `Invalid price at ${t.stopName}`;
                }

                if (i > 0 && price < Number(timings[i - 1].priceFromStart || 0)) {
                    return `Prices must increase at ${t.stopName}`;
                }

                // assign cleaned value
                t.priceFromStart = price;
            }
            return null;
        };
        const forward = Array.isArray(req.body.forwardTimings) ? req.body.forwardTimings : [];
        const reverse = Array.isArray(req.body.reverseTimings) ? req.body.reverseTimings : [];
        const isTwoWay = req.body.isTwoWay === true || req.body.isTwoWay === 'true';

        const forwardError = validateTimings(forward);
        if (forwardError) {
            return res.json({ success: false, message: forwardError });
        }

        if (isTwoWay) {
            const reverseError = validateTimings(reverse);
            if (reverseError) {
                return res.json({ success: false, message: reverseError });
            }
        }

        const timings = isTwoWay ? [...forward, ...reverse] : forward;
        //const busDate = req.body.date ? new Date(req.body.date) : undefined;

        // if (req.body.date && (!busDate || Number.isNaN(busDate.getTime()))) {
        //     return res.json({ message: "Invalid date", success: false });
        // }

        // req.body.date = busDate || req.body.date;
        req.body.timings = timings;
        req.body.forwardTimings = forward;
        req.body.reverseTimings = isTwoWay ? reverse : [];
        req.body.isTwoWay = isTwoWay;
        req.body.basePrice = timings[0]?.priceFromStart || 0;
        req.body.maxPrice = timings.length ? timings[timings.length - 1].priceFromStart : 0;
        req.body.departureTime = timings[0]?.departure || "";

        const updateBus = await busDetail.findByIdAndUpdate(
            busId, req.body, { new: true }
        );

        if (!updateBus) {
            return res.json({ message: "Bus not found", success: false });
        }
        return res.json({ message: "bus updated successfully", success: true, data: updateBus });
    } catch (error) {
        console.log("Update error", error);
        res.json({ message: "Server error while updating", success: false });
    }
}

//  ======= Delete bus ======//
const getTodayStart = () => {
    const now = new Date();
    return new Date(Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    ));
};

exports.deleteBus = async (req, res, next) => {
    try {
        const busId = req.params.busId;

        if (!mongoose.Types.ObjectId.isValid(busId)) {
            return res.json({ message: "Invalid bus id", success: false });
        }

        const bus = await busDetail.findById(busId);

        if (!bus) {
            return res.json({ message: "Bus not found", success: false });
        }

        if (req.session.role === "owner" && bus.owner.toString() !== req.session.userId) {
            return res.json({ message: "You can only delete your own buses", success: false });
        }
        // Check only future bookings
        const todayStart = getTodayStart();

        const futureBookings = await Booking.countDocuments({
            bus: bus._id,
            date: { $gte: todayStart }
        });

        if (futureBookings > 0) {
            return res.json({
                message: "Cannot delete bus with upcoming bookings.",
                success: false
            });
        }

        const deletedBus = await busDetail.findByIdAndDelete(busId);

        if (!deletedBus) {
            return res.json({ message: "Bus not found for deletion", success: false });
        }
        res.json({ message: "bus deleted successfully", success: true });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Deletion failed", success: false });
    }
}

// ===== Helpers ===== //

const normalizeStop = (val = "") =>
    val.toString().trim().toLowerCase().replace(/\s+/g, " ");

const createDayRange = (dateString) => {
    const d = new Date(dateString);

    return {
        start: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)),
        end: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999))
    };
};

// Match route + calculate fare
const matchRoute = (timings = [], source, destination) => {

    const stops = timings.map(t => normalizeStop(t.stopName));

    const normalizedSource = normalizeStop(source);

    const normalizedDestination = normalizeStop(destination);

    const srcIndex = stops.findIndex( s => s === normalizedSource
    );

    const destIndex = stops.findIndex( s => s === normalizedDestination
    );

    if (srcIndex === -1 || destIndex === -1 || srcIndex >= destIndex) {
        return null;
    }

    const fare =
        (timings[destIndex].priceFromStart || 0) -
        (timings[srcIndex].priceFromStart || 0);

    return {
        fromIndex: srcIndex,
        toIndex: destIndex,
        fare
    };
};

// ===== CONTROLLER ===== //

exports.searchBus = async (req, res) => {
    try {
        let { source, destination, date } = req.body;

        if (!source || !destination || !date) {
            return res.json({
                success: false,
                message: "Source, destination and date required"
            });
        }

        source = normalizeStop(source);
        destination = normalizeStop(destination);

        const buses = await busDetail.find()
            .select("busName busNumber totalSeats forwardTimings reverseTimings isTwoWay isAC")
            .lean();

        const { start, end } = createDayRange(date);

        const bookings = await Booking.find({
            journeyDate: { $gte: start, $lte: end }
        }).lean();

        const result = [];

        for (const bus of buses) {

            // Try forward route
            let match = matchRoute(bus.forwardTimings, source, destination);
            let routeType = "forward";

            // Try reverse if not found
            if (!match && bus.isTwoWay) {
                match = matchRoute(bus.reverseTimings, source, destination);
                routeType = "reverse";
            }

            if (!match) continue;

            const bookedSeats = bookings
                .filter(b => b.bus.toString() === bus._id.toString())
                .flatMap(b => b.seats);

            const uniqueBookedSeats = [...new Set(bookedSeats)];

            const availableSeats = bus.totalSeats - uniqueBookedSeats.length;

            result.push({
                ...bus,
                routeType,
                fare: match.fare,
                fromIndex: match.fromIndex,
                toIndex: match.toIndex,
                bookedSeats: uniqueBookedSeats,
                availableSeats
            });
        }

        return res.json({
            success: result.length ? true : false,
            message: result.length ? "Bus search successful" : "No buses found",
            count: result.length,
            data: result
        });

    } catch (err) {
        console.error("SearchBus error:", err);
        return res.json({
            success: false,
            message: "Server error"
        });
    }
};


