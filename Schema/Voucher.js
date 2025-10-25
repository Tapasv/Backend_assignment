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

        ,
        originalOwner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        sharedWith: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            sharedAt: {
                type: Date,
                default: Date.now
            }
        }],
        isShared: {
            type: Boolean,
            default: false
        },
        canBeShared: {
            type: Boolean,
            default: true
        }
        ,
        applicableProducts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        }],
        minPurchaseAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        maxDiscountAmount: {
            type: Number,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Voucher', VoucherSchema);