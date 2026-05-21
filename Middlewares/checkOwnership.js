const Bus = require('../Models/busModel');
const mongoose = require('mongoose');

exports.checkBusOwnership = async (req, res, next) => {
    try {
        const busId = req.params.busId;

        if (!busId) {
            return res.json({ mesasge: "busId is undefined", success: false });
        }

        if (!mongoose.Types.ObjectId.isValid(busId)) {
            return res.status(400).json({ message: "Invalid Bus ID",success:false});
        }

        const bus = await Bus.findById(busId);

        if (!bus) {
            return res.status(404).json({ message: "Bus not found" ,success: false});
        }

        if (req.session.role === 'admin') {
            return next();
        }

        if (req.session.role === 'owner' &&
            bus.owner.toString() === req.session.userId) {
            return next();
        }

        return res.status(403).json({
            message: "You are not allowed to update or delete this bus",succss:false
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error",success:false });
    }
};