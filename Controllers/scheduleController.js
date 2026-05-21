const scheduleDetails = require('../Models/scheduleModel');
const busDetails = require('../Models/busModel');

exports.createSchedule = async (req, res, next) => {
    try {
         const ownerId = req.session.userId;
        if(!ownerId) {
            return res.json({message: "Unauthorized : Login required", success:false});
        }
        const {busId,pathId,departureTime, arrivalTime, boardingPoints, droppingPoints, baseFare } = req.body;
        //console.log("Schedule: ", req.body);

        const bus = await busDetails.findById(busId);
        if (!bus) {
            return res.status(404).json({ message: "Bus not found" });
        }
        console.log("Session user id in schedule: ",ownerId);

        const newSchedule = await scheduleDetails.create({
            owner: ownerId,
            busId,
            pathId, 
            busName:bus.busName,
            busNumber: bus.busNumber,
            departureTime, arrivalTime, boardingPoints, droppingPoints, baseFare
        });
        console.log("New Schedule: ",newSchedule);
        res.json({ message: "Schedule added successfully", success: true, data: newSchedule })
    } catch (err) {
        console.log("Error in creating schedule", err);
        return res.status(500).json({
            message: "Failed to add schedule",
            success: false
        });
    }
}

//Get all schedules
exports.allSchedules = async(req,res,next) =>{
    const schedules = await scheduleDetails.find().populate('busId');
        res.json(schedules);
}

exports.scheduleById = async(req,res) =>{
    try{
    const scheduleId = req.params.scheduleId;
    const schedule = await scheduleDetails.findById(scheduleId);
        if(!schedule) {
            console.log("Schedule is not found");
            return res.json({message: "failed to get schedule",success: false});
        }

        res.json({message: "Schedule fetched successfully",success:true,data:schedule});
    } catch(error) {
        console.log(error);
        res.json({message: "server error",success:false});
    }
}

exports.updateSchedule = async(req,res,next) =>{
    try{
         const scheduleId = req.params.scheduleId;

         const updateSchedule = await scheduleDetails.findByIdAndUpdate(
            scheduleId,req.body,{ new: true }
         );

         if(!updateSchedule){
            return res.json({message: "Schedule not found",success:false});
         }
         res.json({message: "Schedule updated successfully",success:true});
    }catch(error){

        res.json({message: "Update failed",success:false});
    }
}

exports.deleteSchedule = async(req,res,next) =>{
    try{
        const scheduleId = req.params.scheduleId;

        const deletePath = await scheduleDetails.findByIdAndDelete(scheduleId);
        if(!deletePath){
            res.json({message:"Schedule not found for deletion",success:false});
        }
        res.json({message: "Schedule deleted successfully",success:true});
    }catch(error){
        res.json({message: "error in deleting Schedule",success:false});
    }
}

exports.allOwnerSchedules = async (req,res,next) => {
    try{
            const ownerId = req.session.userId;
            const ownerSchedule = await scheduleDetails.find({ owner: ownerId})
            .populate('busId');
            res.json({message: "Owner schedules fetched successfully", success:true,data:ownerSchedule});
        }catch(error){
            console.log("Error: ",error);
            res.json({message: "Fetched owner schedules failed",success:false})
        }
}
exports.deleteOwnerSchedule = async (req,res,next) =>{
      try{
            const scheduleId = req.params.scheduleId;
    
            const deletedSchedule = await scheduleDetails.findByIdAndDelete({_id:scheduleId,owner:req.session.userId});
            if(!deletedSchedule){
                return res.json({message: "Schedule not found for deletion",success:false});
            }
            res.json({message: "schedule deleted successfully",success:true});
        }catch(error){
            res.json({message: "Deletion failed",success:false});
        }
}