const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            unique: true,
            required: true,
            uppercase: true,
            trim: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        value: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ['unused', 'used'],
            default: 'unused'
        },
        expiryDate: {
            type: Date,
            required: true
        },
        redeemedAt: {
            type: Date,
            default: null
        },
        redeemedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        description: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Voucher', VoucherSchema);