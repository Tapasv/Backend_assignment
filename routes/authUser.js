const express = require('express')
const router = express.Router()
const User = require('../Schema/User')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

router.post('/register', async (req, res) => {

    try {
        const { Username, Password } = req.body

        const dupli = await User.findOne({ Username })
        if (dupli) {
            return res.status(403).json({ 'message': 'Username already taken!' })
        }

        const hashedpwd = await bcrypt.hash(Password, 10)

        const { role, merchantDetails } = req.body
        const newUser = await User.create({
            Username,
            Password: hashedpwd,
            role: role || 'customer',
            merchantDetails: role === 'merchant' ? merchantDetails : undefined
        })    
        await newUser.save();

        res.status(201).json({ 'message': `User: ${Username} Created` })
    }
    catch (err) {
        console.error(err)
    }
})

router.post('/login', async (req, res) => {

    try {
        const { Username, Password } = req.body

        const user = await User.findOne({ Username })
        if (!user) {
            return res.status(403).json({ 'message': `User ${Username} not found!` })
        }

        const invalid = await bcrypt.compare(Password, user.Password)
        if (!invalid) {
            return res.status(409).json({ 'message': "Invalid Credentails" })
        }

        const Accesstoken = jwt.sign(
            { userID: user._id, role: user.role},
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '30d' }
        )
        const Refreshtoken = jwt.sign(
            { userID: user._id, role: user.role},
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '30d' }
        )

        user.refreshToken = Refreshtoken
        await user.save();

        res.json({
            "message": `User: ${Username} logged In`,
            token: Accesstoken,
            refreshToken: Refreshtoken
        })
    }
    catch (err) {
        console.error(err)
    }
})

router.post('/refresh', async (req, res) => {

    try {
        const { refreshToken } = req.body

        const user = await User.findOne({ refreshToken })
        if (!user) {
            return res.sendStatus(401)
        }

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
            if (!refreshToken) return res.sendStatus(401)

            const Accesstoken = jwt.sign(
                { userID: user._id, role: user.role },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '30d' }
            )

            res.json({ Accesstoken })
        })
    }
    catch (err) {
        console.error(err)
    }
})

router.post('/logout', async (req, res) => {

    try {
        const { refreshToken, Username } = req.body

        const user = await User.findOne({ refreshToken })
        if (!user) {
            return res.sendStatus(401)
        }

        user.refreshToken = null
        await user.save();

        return res.status(201).json({ 'message': `User: ${Username} logged Out` })
    }
    catch (err) {
        console.error(err)
    }
})

module.exports = router