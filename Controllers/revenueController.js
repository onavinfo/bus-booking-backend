const Booking = require("../Models/bookingModel");
const busDetail = require("../Models/busModel");
const mongoose = require("mongoose");
const paths = require("../Models/pathModel");

// ================================
// TOTAL REVENUE + STATS
// ================================
exports.getRevenueDashboard = async (req, res) => {
    try {
        const role = req.session.role;
        const userId = req.session.userId;

        let matchStage = {};

        // OWNER => only own buses
        if (role === "owner") {

            const ownerBuses = await busDetail.find({
                owner: userId
            }).select("_id");

            const busIds = ownerBuses.map(bus => bus._id);

            matchStage.bus = {
                $in: busIds
            };
        }

        // ADMIN => all data

        // ================================
        // TOTAL REVENUE
        // ================================
        const totalRevenueResult = await Booking.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: "$totalAmount"
                    },
                    totalBookings: {
                        $sum: 1
                    },
                    totalSeatsBooked: {
                        $sum: {
                            $size: "$seats"
                        }
                    }
                }
            }
        ]);

        // ================================
        // MONTHLY REVENUE
        // ================================
        const monthlyRevenue = await Booking.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: {
                        month: {
                            $month: "$createdAt"
                        }
                    },
                    revenue: {
                        $sum: "$totalAmount"
                    }
                }
            },
            {
                $sort: {
                    "_id.month": 1
                }
            }
        ]);

        // ================================
        // TOP BUSES
        // ================================
        const topBuses = await Booking.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: "$bus",
                    revenue: {
                        $sum: "$totalAmount"
                    },
                    bookings: {
                        $sum: 1
                    }
                }
            },
            {
                $sort: {
                    revenue: -1
                }
            },
            {
                $limit: 5
            },
            {
                $lookup: {
                    from: "buses",
                    localField: "_id",
                    foreignField: "_id",
                    as: "bus"
                }
            },
            {
                $unwind: "$bus"
            }, {
                $project: {
                    revenue: 1,
                    bookings: 1,
                    busName: "$bus.busName",
                }
            }
        ]);

        //=======
        //Top routes
        //=======
        const popularRoutes = await Booking.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: {
                        from: "$from",
                        to: "$to",
                    },
                    bookings: {
                        $sum: 1
                    },
                    revenue: {
                        $sum: "$totalAmount"
                    },
                    seats: {
                        $sum:{
                            $size: "$seats"
                        }
                    }
                }
            },
            {
                $sort: {
                    bookings: -1
                }
            },
            {
                $limit: 5
            }
        ])

        // ================================
        // TODAY REVENUE
        // ================================
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const todayRevenue = await Booking.aggregate([
            {
                $match: {
                    ...matchStage,
                    createdAt: {
                        $gte: start,
                        $lte: end
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    revenue: {
                        $sum: "$totalAmount"
                    }
                }
            }
        ]);

        return res.json({
            success: true,

            stats: totalRevenueResult[0] || {
                totalRevenue: 0,
                totalBookings: 0,
                totalSeatsBooked: 0
            },

            todayRevenue:
                todayRevenue[0]?.revenue || 0,

            monthlyRevenue,

            topBuses,
            popularRoutes
        });

    } catch (error) {

        console.log(error);

        return res.json({
            success: false,
            message: "Failed to fetch revenue dashboard"
        });
    }
};