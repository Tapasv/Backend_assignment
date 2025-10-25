// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
    {
        Username: {
            type: String,
            unique: true,
            required: true
        },
        Password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['customer', 'merchant', 'admin'],
            default: 'customer'
        },
        merchantDetails: {
            storeName: String,
            storeLocation: String,
            storeId: String
        },
        isActive: {
            type: Boolean,
            default: true
        },
        refreshToken: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('User', UserSchema);