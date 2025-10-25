require('dotenv').config()
const express = require('express')
const app = express()
const DBcnnctn = require('./DBcnnctn')
const cors = require('cors')
const mongoose = require('mongoose')
const authUser = require('./routes/authUser')
const authVoucher = require('./routes/authVoucher')


const port = 5000

DBcnnctn();

app.use(express.json())
app.use(cors('http://localhost:5173'))

app.use('/api/auth', authUser)
app.use('/api/voucher', authVoucher)

mongoose.connection.once('open', () => {
    console.log("Connected to DB")
    app.listen(port, console.log(`Server is running on Port: ${port}`))
})