const { response } = require('express');
const jwt = require('jsonwebtoken')

const authmiddlewhere = (req, res, next) => {
    const authHeaders = req.headers['authorization']
    const token = authHeaders && authHeaders.split(" ")[1]

    if (!token) return res.sendStatus(403);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.error(err)
            return res.sendStatus(403)
        }

        req.userID = decoded.userID
        req.role = decoded.role
        next();
    })
}

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.role) {
            return res.status(401).json({
                'message': 'Unauthorized access.'
            });
        }

        if (!roles.includes(req.role)) {
            return res.status(403).json({
                'message': `Access denied. Required role: ${roles.join(' or ')}`
            });
        }

        next();
    };
}

module.exports = { authmiddlewhere, authorize }