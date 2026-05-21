exports.isAuthenticated = (req,res,next) =>{
    if(!req.session.userId || !req.session){
        return res.status(401).json({message: "Please login first",success:false});
    }
    next();
}

exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.session.role || !roles.includes(req.session.role)) {
            return res.status(403).json({
                message: "Access denied",
                success: false
            });
        }
        next();
    };
};

