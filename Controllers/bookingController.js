const Booking = require("../Models/bookingModel");
const Bus = require("../Models/busModel");
const SeatLock = require("../Models/seatModel");
const mongoose = require("mongoose");

const normalizeStop = (val) => val?.toString().trim().toLowerCase();

const getBusTimings = (bus) => {
    if (Array.isArray(bus.timings) && bus.timings.length) {
        return bus.timings;
    }
    const forward = Array.isArray(bus.forwardTimings) ? bus.forwardTimings : [];
    const reverse = Array.isArray(bus.reverseTimings) ? bus.reverseTimings : [];
    return bus.isTwoWay ? [...forward, ...reverse] : forward;
};

exports.lockSeats = async (req, res) => {
    try {
        const { busId, seats, journeyDate, from, to, routeType } = req.body;

        let userId;

        if (
            req.session.role === "admin" ||
            req.session.role === "owner"
        ) {

            if (!req.body.selectedUser) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a user"
                });
            }

            userId = req.body.selectedUser;

        } else {

            userId = req.session.userId;
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in"
            });
        }

        if (!seats || seats.length === 0) {
            return res.status(400).json({ message: "No seats selected", success: false });
        }

        if(!journeyDate){
            return res.status(400).json({message: "Please select the journey date",
                success: false});
        }
        if(!from || !to){
            return res.status(400).json({message: "Please select boarding and dropping point",
                success: false
            });
        }

        if (normalizeStop(from) === normalizeStop(to)) {
            return res.status(400).json({
                success: false,
                message: "From and To cannot be same"
            });
        }

        const now = new Date();

        // Remove expired locks first
        await SeatLock.deleteMany({
            expiresAt: { $lt: now }
        });

        const uniqueSeats = [...new Set(seats.map(Number))];

        if (uniqueSeats.length !== seats.length) {
            return res.status(400).json({
                success: false,
                message: "Duplicate seats selected"
            });
        }

        const bus = await Bus.findById(busId);
        if (!bus) {
            return res.status(404).json({ message: "Bus not found", success: false });
        }

        const stopTimings = getBusTimings(bus);

        const fromStop = stopTimings.find(
            s => normalizeStop(s.stopName) === normalizeStop(from)
        );

        const toStop = stopTimings.find(
            s => normalizeStop(s.stopName) === normalizeStop(to)
        );

        if (!fromStop || !toStop) {
            return res.status(400).json({ success: false, message: "Invalid stops selected" });
        }

        const fromPrice = Number(fromStop.priceFromStart);
        const toPrice = Number(toStop.priceFromStart);

        // Check already booked Seats
        const bookings = await Booking.find({
            bus: busId,
            date: journeyDate,
            //seats: { $in: seats },
            status: { $ne: "cancelled" }
        });

        let overlappingSeats = [];

        for (let b of bookings) {

            const bFrom = stopTimings.find(
                s => normalizeStop(s.stopName) === normalizeStop(b.from)
            );

            const bTo = stopTimings.find(
                s => normalizeStop(s.stopName) === normalizeStop(b.to)
            );

            if (!bFrom || !bTo) continue;

            const isOverlap =
                !(toPrice <= Number(bFrom.priceFromStart) ||
                    fromPrice >= Number(bTo.priceFromStart));

            if (isOverlap) {
                const commonSeats = (b.seats || []).filter(seat =>
                    uniqueSeats.includes(Number(seat))
                );
                overlappingSeats.push(...commonSeats);
            }
        }

        if (overlappingSeats.length > 0) {
            const bookedSeats = [...new Set(overlappingSeats)];
            return res.status(400).json({
                success: false,
                message: `Seats already booked: ${bookedSeats.join(", ")}`
            });
        }

        // Check locked Seats
        const existingLocks = await SeatLock.find({
            busId,
            seatNumber: { $in: uniqueSeats },
            date: journeyDate,
            expiresAt: { $gt: now }
        });

        let overlappingLockedSeats = [];

        for (let lock of existingLocks) {
            const lockFrom = normalizeStop(lock.from);
            const lockTo = normalizeStop(lock.to);

            const lockFromStop = stopTimings.find(
                s => normalizeStop(s.stopName) === lockFrom
            );

            const lockToStop = stopTimings.find(
                s => normalizeStop(s.stopName) === lockTo
            );
            if (!lockFromStop || !lockToStop) continue;

            if ((lock.routeType || "forward") !== (routeType || "forward")) {
                continue;
            }

            const isOverlap =
                !(toPrice <= Number(lockFromStop.priceFromStart) ||
                    fromPrice >= Number(lockToStop.priceFromStart));

            // if (isOverlap && seats.includes(lock.seatNumber)) {
            //     overlappingLockedSeats.push(lock.seatNumber);
            // }
            if (
                isOverlap &&
                uniqueSeats.includes(lock.seatNumber) &&
                lock.lockedBy.toString() !== userId.toString()
            ) {
                overlappingLockedSeats.push(lock.seatNumber);
            }
        }

        if (overlappingLockedSeats.length > 0) {
            return res.status(400).json({
                message: `Seats locked: ${[...new Set(overlappingLockedSeats)].join(",")}`,
                success: false
            });
        }

        // Create and update locks

        for (const seat of uniqueSeats) {
            const existingLock = await SeatLock.findOne({
                busId,
                seatNumber: seat,
                date: journeyDate,
                expiresAt: { $gt: now },
                lockedBy: { $ne: userId }
            });

            if (existingLock) {
                return res.status(400).json({ message: `Seat ${seat} already locked`, success: false });
            }

            await SeatLock.findOneAndUpdate({
                busId,
                seatNumber: seat,
                journeyDate,
                lockedBy: userId
            },
                {
                    busId,
                    seatNumber: seat,
                    date: journeyDate,
                    from,
                    to,
                    lockedBy: userId,
                    routeType: routeType || "forward",
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
                }, {
                upsert: true,
                new: true
            });
        }
        return res.status(200).json({ message: "Seats locked successfully", success: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "server Error while locking the seats",
            success: false
        });
    }
}

exports.getLockedSeats = async (req, res) => {
    try {

        const { busId, journeyDate, from, to, routeType } = req.query;

        const normalizeStop = (val) =>
            val?.toString().trim().toLowerCase();

        const getStopName = (s) =>
            normalizeStop(
                s.stopName ||
                s.stop ||
                s.name ||
                ""
            );

        const bus = await Bus.findById(busId);

        if (!bus) {
            return res.json({ success: false, message: "Bus not found" });
        }

        const stopTimings = getBusTimings(bus);

        const fromStop = stopTimings.find(
            (s) => getStopName(s) === normalizeStop(from)
        );

        const toStop = stopTimings.find(
            (s) => getStopName(s) === normalizeStop(to)
        );

        if (!fromStop || !toStop) {
            return res.status(400).json({
                success: false,
                message: "Invalid stops selected",
                availableStops: stopTimings.map(
                    (s) => s.stopName || s.stop || s.name
                )
            });
        }

        const fromPrice = Number(fromStop.priceFromStart);
        const toPrice = Number(toStop.priceFromStart);

        if (Number.isNaN(fromPrice) || Number.isNaN(toPrice)) {
            return res.status(400).json({
                success: false,
                message: "Invalid stop pricing data"
            });
        }

        if (fromPrice >= toPrice) {
            return res.status(400).json({
                success: false,
                message: "Invalid route selection"
            });
        }

        const locks = await SeatLock.find({
            busId,
            date: journeyDate,
            expiresAt: { $gt: new Date() }
        });

        let blockedSeats = [];

        for (let lock of locks) {

            const lockFrom = stopTimings.find(
                (s) => getStopName(s) === normalizeStop(lock.from)
            );

            const lockTo = stopTimings.find(
                (s) => getStopName(s) === normalizeStop(lock.to)
            );

            if (!lockFrom || !lockTo) continue;

            if (
                (lock.routeType || "forward") !==
                ((req.query.routeType || "forward"))
            ) {
                continue;
            }

            const lockFromPrice = Number(lockFrom.priceFromStart);
            const lockToPrice = Number(lockTo.priceFromStart);

            const isOverlap =
                !(toPrice <= lockFromPrice || fromPrice >= lockToPrice);

            if (isOverlap) {
                blockedSeats.push(Number(lock.seatNumber));
            }
        }

        return res.status(200).json({
            success: true, data: [...new Set(blockedSeats)]
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: "Error fetching locked seats"
        });
    }
};


exports.unlockSeats = async (req, res) => {
    try {
        const { busId, seats, journeyDate } = req.body;
        const userId = req.session?.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        if (!busId || !seats || seats.length === 0 || !journeyDate) {
            return res.status(400).json({ success: false, message: "Missing unlock parameters" });
        }

        await SeatLock.deleteMany({
            busId,
            seatNumber: { $in: seats },
            date: journeyDate,
            lockedBy: userId
        });

        return res.json({ success: true, message: "Seats unlocked" });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Error while unlocking seats" });
    }
};

exports.bookSeats = async (req, res) => {
    try {
        const { busId, seats, journeyDate, from, to, routeType } = req.body;

        // let bookingUser = req.session.userId;

        let bookingUser;

        if (
            req.session.role === "admin" ||
            req.session.role === "owner"
        ) {
            if (!req.body.selectedUser) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a user for booking"
                });
            }
            bookingUser = req.body.selectedUser;
        } else {
            bookingUser = req.session.userId;
        }

        if (!seats || seats.length === 0) {
            return res.status(400).json({
                message: "Please select atleast one seat",
                success: false
            });
        }

        const uniqueSeats = [...new Set(seats.map(Number))];

        if (uniqueSeats.length !== seats.length) {

            return res.status(400).json({
                success: false,
                message: "Duplicate seats selected"
            });
        }

        if (!journeyDate) {
            return res.json({ success: false, message: "Date required" });
        }

        if (!from || !to) {
            return res.json({ message: "Please select boarding and dropping point", success: false });
        }

        if (normalizeStop(from) === normalizeStop(to)) {
            return res.status(400).json({
                success: false,
                message: "From and To cannot be same"
            });
        }
        const now = new Date();

        const locks = await SeatLock.find({
            busId,
            seatNumber: { $in: uniqueSeats },
            lockedBy: bookingUser,
            expiresAt: { $gt: now }
        });

        if (locks.length !== uniqueSeats.length) {
            return res.status(400).json({
                success: false,
                message: "Seats not locked by you or expired"
            });
        }

        const bus = await Bus.findById(busId);

        if (!bus) {
            return res.json({ message: "Bus not found", success: false });
        }

        const stopTimings = getBusTimings(bus);

        const fromStop = stopTimings.find(
            (s) => normalizeStop(s.stopName) === normalizeStop(from)
        );

        const toStop = stopTimings.find(
            (s) => normalizeStop(s.stopName) === normalizeStop(to)
        );

        if (!fromStop || !toStop) {
            return res.json({ message: "Invalid stops selected", success: false });
        }

        const fromPrice = Number(fromStop.priceFromStart);
        const toPrice = Number(toStop.priceFromStart);

        if (Number.isNaN(fromPrice) || Number.isNaN(toPrice)) {
            return res.json({
                success: false,
                message: "Invalid pricing data in bus timings"
            });
        }

        if (fromPrice >= toPrice) {
            return res.json({ message: "Invalid route selection", success: false });
        }

        const farePerSeat = toPrice - fromPrice;
        const totalAmount = farePerSeat * uniqueSeats.length;

        const existingBookings = await Booking.find({
            bus: busId,
            date: journeyDate,
            status: { $ne: "cancelled" }
        });

        const overlappingSeats = [];

        for (let booking of existingBookings) {
            if (!booking.from || !booking.to) continue;

            const bookedFrom = stopTimings.find(
                (s) => normalizeStop(s.stopName) === normalizeStop(booking.from)
            );

            const bookedTo = stopTimings.find(
                (s) => normalizeStop(s.stopName) === normalizeStop(booking.to)
            );

            if (!bookedFrom || !bookedTo) continue;

            const isOverlap =
                !(toPrice <= Number(bookedFrom.priceFromStart) ||
                    fromPrice >= Number(bookedTo.priceFromStart));

            if (isOverlap) {
                const commonSeats = booking.seats.filter((seat) => uniqueSeats.includes(seat));
                overlappingSeats.push(...commonSeats);
            }
        }

        if (overlappingSeats.length > 0) {
            return res.json({
                success: false,
                message: `Seats already booked: ${[...new Set(overlappingSeats)].join(", ")}`
            });
        }

        let booking = await Booking.findOne({
            user: bookingUser,
            bus: busId,
            date: journeyDate,
            from,
            to,
            routeType: routeType || "forward",
            status: { $ne: "cancelled" }
        });

        if (booking) {

            const updatedSeats = [

                ...new Set([
                    ...booking.seats,
                    ...uniqueSeats
                ])
            ];

            booking.seats = updatedSeats;

            booking.totalAmount =
                farePerSeat * updatedSeats.length;

            booking.farePerSeat = farePerSeat;

            booking.paymentStatus = booking.paymentStatus || "pending";

            await booking.save();

        } else {

            booking = await Booking.create({
                user: bookingUser,
                bus: busId,
                seats: uniqueSeats.sort((a, b) => a - b),
                date: journeyDate,
                from,
                to,
                routeType: routeType || "forward",
                farePerSeat,
                totalAmount,
                status: "confirmed",
                paymentStatus: "pending",
                paidAt: null,
            });
        }

        await SeatLock.deleteMany({
            busId,
            seatNumber: { $in: uniqueSeats },
            date: journeyDate,
            lockedBy: bookingUser
        });

        return res.json({ message: "Booking successfully", success: true, data: booking })

    } catch (err) {
        console.log(err);

        return res.status(500).json({
            message: "booking failed", success: false,
            error: err.message
        });
    }
}

exports.getBookedSeats = async (req, res) => {
    try {

        const busId = req.params.busId;
        const { date, from, to } = req.query;

        const bus = await Bus.findById(busId);
        if (!bus) {
            return res.json({ message: "Bus not found", success: false });
        }

        const stopTimings = getBusTimings(bus);

        const fromStop = stopTimings.find(
            s => normalizeStop(s.stopName) === normalizeStop(from)
        );
        const toStop = stopTimings.find(
            s => normalizeStop(s.stopName) === normalizeStop(to)
        );

        if (!fromStop || !toStop) {
            return res.json({ message: "Invalid route(from/to) not found", success: false });
        }

        // if ((b.routeType || "forward") !== (routeType || "forward")) {
        //     continue;
        // }

        const fromPrice = Number(fromStop.priceFromStart);
        const toPrice = Number(toStop.priceFromStart);

        const bookings = await Booking.find({ bus: busId, date: date, status: { $ne: "cancelled" } });

        let blockedSeats = [];

        for (let b of bookings) {
            if (!b.from || !b.to) continue;

            const bFrom = stopTimings.find(
                s => normalizeStop(s.stopName) === normalizeStop(b.from)
            );
            const bTo = stopTimings.find(
                s => normalizeStop(s.stopName) === normalizeStop(b.to)
            );

            if (!bFrom || !bTo) continue;

            if (typeof bFrom.priceFromStart !== "number" ||
                typeof bTo.priceFromStart !== "number") continue;

            const isOverlap = !(toStop.priceFromStart <= bFrom.priceFromStart ||
                fromStop.priceFromStart >= bTo.priceFromStart);

            if (isOverlap) {

                blockedSeats.push(
                    ...new Set(
                        (b.seats || []).map(Number)
                    )
                );
            }
        }
        return res.json({
            success: true, data: [...new Set(blockedSeats)], message: "blocked seats fetched"
        });
    } catch (err) {
        console.log("Error fetching seats: ", err);
        res.json({ message: "Error fetching seats", data: [], success: false });
    }
};

exports.allBookings = async (req, res, next) => {
    try {
        let bookings;

        if (req.session.role === 'admin') {

            bookings = await Booking.find().populate("user", "name email DOB")
                .populate({
                    path: "bus", select: "busName busNumber isTwoWay totalSeats forwardTimings reverseTimings owner pathId",
                    populate: { path: "pathId", select: "source destination" }
                });
        } else if (req.session.role === 'owner') {
            bookings = await Booking.find()
                .populate("user", "name email DOB").populate({
                    path: "bus",
                    select: "busName busNumber owner totalSeats isTwoWay forwardTimings reverseTimings pathId",
                    match: { owner: req.session.userId },
                    populate: { path: "pathId", select: "source destination" }
                });

            bookings = bookings.filter(b => b.bus);

        } else if (req.session.role === 'user') {
            bookings = await Booking.find({ user: req.session.userId })
                .populate("user", "name email DOB").populate({
                    path: "bus",
                    select: "busName busNumber totalSeats isTwoWay forwardTimings reverseTimings pathId",
                    populate: { path: "pathId", select: "source destination" }
                });
        } else {
            return res.json({ message: "Unauthorized access", success: false });
        }

        const bookingMap = new Map();

        bookings.forEach((booking) => {

            const busId =
                booking.bus?._id?.toString();

            if (!busId) return;

            const journeyDate =
                booking.date
                    ? new Date(booking.date)
                        .toISOString()
                        .split("T")[0]
                    : "unknown-date";

            const bookingKey =
                `${busId}-${journeyDate}-${booking.from}-${booking.to}-${booking.routeType}`;

            if (!bookingMap.has(bookingKey)) {

                bookingMap.set(
                    bookingKey,
                    []
                );
            }

            bookingMap
                .get(bookingKey)
                .push(booking);
        });

        const formattedBookings = Array.from(
            bookingMap.values()).map((sameBookings) => {

                const firstBooking = sameBookings[0];

                const activeBookings = sameBookings.filter(
                    (b) => b.status !== "cancelled"
                );

                const uniqueUsers = new Set(
                    activeBookings
                        .filter(b => b.user?._id)
                        .map(b => b.user._id.toString())
                );
                const totalBookings = activeBookings.length;

                const totalUsers = uniqueUsers.size;

                const totalRevenue = activeBookings.reduce(
                    (acc, curr) =>
                        acc + (curr.totalAmount || 0),
                    0
                );

                const uniqueSeats = new Set();

                activeBookings.forEach((booking) => {
                    if (Array.isArray(booking.seats)) {
                        booking.seats.forEach((seat) => {
                            uniqueSeats.add(seat);
                        });
                    }
                });

                const totalSeatsBooked = uniqueSeats.size;

                const bookedUsersMap = new Map();

                activeBookings.forEach((b) => {

                    if (!b.user || !b.bus) return;

                    const userId = b.user?._id?.toString();

                    if (!userId) return;

                    const userKey =
                        `${b.user?._id?.toString()}-${b.from}-${b.to}-${b.routeType || "forward"}`;

                    if (!userKey) return;

                    const seats = [
                        ...new Set(
                            Array.isArray(b.seats)
                                ? b.seats.map(Number)
                                : []
                        )
                    ];

                    if (!bookedUsersMap.has(userKey)) {

                        bookedUsersMap.set(userKey, {
                            _id: b.user?._id,
                            name: b.user?.name,
                            email: b.user?.email,
                            DOB: b.user?.DOB,
                            seats: [...new Set(seats)].sort((a, b) => a - b),
                            bookingId: b._id,
                            from: b.from,
                            to: b.to,
                            isTwoWay: b.bus.isTwoWay,
                            routeType: b.routeType || "forward",
                            totalAmount: b.totalAmount,
                            status: b.status,
                            paymentStatus: b.paymentStatus,
                            paidAt: b.paidAt,
                        });
                    } else {
                        const existing =
                            bookedUsersMap.get(userKey);

                        existing.seats = [
                            ...new Set([
                                ...existing.seats.map(Number),
                                ...seats.map(Number)
                            ])
                        ].sort((a, b) => a - b);
                    }
                });

                const bookedUsers =
                    Array.from(
                        bookedUsersMap.values()
                    );

                const today = new Date();

                today.setHours(0, 0, 0, 0);

                const bookingDate = new Date(firstBooking.date);

                bookingDate.setHours(0, 0, 0, 0);

                let bookingStatus = "confirmed";

                if (firstBooking.status === "cancelled") {

                    bookingStatus = "cancelled";

                } else if (bookingDate < today) {

                    bookingStatus = "completed";
                }

                return {
                    id: firstBooking._id,
                    bus: firstBooking.bus,
                    journeyDate: firstBooking.date,
                    from: firstBooking.from,
                    to: firstBooking.to,

                    routeType:
                        firstBooking.routeType ||
                        "forward",

                    status: bookingStatus,

                    analytics: {
                        totalBookings,
                        totalUsers,
                        totalSeatsBooked,
                        totalRevenue
                    },
                    bookedUsers
                };
            });

        return res.json({ message: "bookings fetched", success: true, data: formattedBookings });

    } catch (err) {
        console.log("All Bookings error", err);
        return res.json({ message: " get bookings failed", success: false });
    }
}

exports.cancelBooking = async (req, res, next) => {
    try {
        const bookId = req.params.bookId;
        const userId = req.session.userId;
        const role = req.session.role;

        if (!userId) {
            return res.status(401).json({ message: "User not logged in", success: false });
        }

        const booking = await Booking.findById(bookId);

        if (!booking) {
            return res.json({ message: "Unable to find booking", success: false });
        }

        if (role === "admin") {

        } else if (role === "owner") {
            const bus = await Bus.findById(booking.bus);

            if (!bus || bus.owner.toString() !== userId) {
                return res.json({ messsage: "You can only cancel bookings of your buses", success: false });
            }
        } else {
            if (booking.user.toString() !== userId) {
                return res.json({ message: "You can only cancel your own bookings", success: false });
            }
        }
        if (booking.status === "cancelled") {
            return res.json({ message: "Booking already cancelled", success: false });
        }

        booking.status = "cancelled";
        await booking.save();

        await SeatLock.deleteMany({
            busId: booking.bus,
            date: booking.date,
            from: booking.from,
            to: booking.to,
            seatNumber: { $in: booking.seats }
        });

        return res.json({ message: "Booking cancelled successfully", success: true });

    } catch (err) {
        return res.status(500).json({ message: "Server error while cancel booking", success: false });
    }
}

exports.bookingById = async (req, res) => {
    try {
        const bookId = req.params.bookId;

        if (!bookId || bookId === undefined || !mongoose.Types.ObjectId.isValid(bookId)) {
            return res.status(400).json({ message: "invalid booking Id", success: false });
        }
        const booking = await Booking.findById(bookId).populate('user', 'name email DOB')
            .populate({
                path: "bus",
                populate: { path: "pathId", select: "source destination" }
            });

        if (!booking) {
            return res.status(404).json({ message: "Unable to find booking", success: false });
        }

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const bookingDate = new Date(booking.date);

        bookingDate.setHours(0, 0, 0, 0);

        let bookingStatus = "confirmed";

        if (booking.status === "cancelled") {

            bookingStatus = "cancelled";

        } else if (bookingDate < today) {

            bookingStatus = "completed";
        }

        const formattedBooking = {
            ...booking.toObject(),
            status: bookingStatus
        };

        return res.status(200).json({
            message: "Booking found", success: true,
            data: formattedBooking
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Error while getting bookingById", success: false });
    }
}

exports.markAsPaid = async (req, res) => {
    try {
        const bookId = req.params.bookId;

        const booking = await Booking.findById(bookId);

        if (!booking) {
            return res.json({ message: "Unable to find booking", success: false });
        }

        booking.paymentStatus = "paid";

        booking.paidAt = new Date();

        await booking.save();

        return res.json({ message: "Payment mark as paid", success: true, data: booking });
    } catch (err) {
        console.log("Mark as paid issue", err);
        return res.json({ message: "server error while markAsPaid", success: false });
    }
}