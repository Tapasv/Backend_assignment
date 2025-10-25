const express = require('express')
const router = express.Router()
const Voucher = require('../Schema/Voucher')
const User = require('../Schema/User')
const { authmiddlewhere, authorize } = require('../middlewhere/auth')

// Helper function to generate voucher code
const generateVoucherCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments = 3;
    const segmentLength = 3;

    let code = [];
    for (let i = 0; i < segments; i++) { // loop will run 3 times 
        let segment = ''; // it will empty the string
        for (let j = 0; j < segmentLength; j++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length)); // pick random character like "W" and it will pick like this until its length became 3 then push it into array(segment) so after this array(segment) look like this ['WQR', 'JHF', 'TUI']
        }
        code.push(segment);
    }

    return code.join('-');//Then it will joins the - in it like this WQR-JHF-TUI
};

// ADMIN: Generate voucher
router.post('/admin/generate', authmiddlewhere, authorize('admin'), async (req, res) => {
    try {
        const { userId, value, expiryDays, description } = req.body;

        if (!userId || !value || !expiryDays) {
            return res.status(400).json({
                'message': 'userId, value, and expiryDays are required'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                'message': 'User not found'
            });
        }

        let code;
        let isUnique = false;
        while (!isUnique) {
            code = generateVoucherCode();
            const existing = await Voucher.findOne({ code });
            if (!existing) isUnique = true;
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));

        const voucher = new Voucher({
            code,
            userId,
            value,
            expiryDate,
            description: description || `${value}% voucher`
        });

        await voucher.save();

        res.status(201).json({
            'message': 'Voucher generated successfully',
            voucher: {
                code: voucher.code,
                value: voucher.value,
                expiryDate: voucher.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                assignedTo: user.Username,
                createdAt: voucher.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// ADMIN: Get all vouchers
router.get('/admin/all', authmiddlewhere, authorize('admin'), async (req, res) => {
    try {
        const { status, userId } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (userId) filter.userId = userId;

        const vouchers = await Voucher.find(filter)
            .populate('userId', 'Username')
            .populate('redeemedBy', 'Username merchantDetails')
            .sort({ createdAt: -1 });

        res.status(200).json({
            'message': 'Vouchers retrieved successfully',
            count: vouchers.length,
            vouchers
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// CUSTOMER: Get my vouchers
router.get('/my-vouchers', authmiddlewhere, authorize('customer'), async (req, res) => {
    try {
        const userId = req.userID;
        const { status } = req.query;

        const filter = { userId };
        if (status) {
            filter.status = status;
        }

        const vouchers = await Voucher.find(filter).sort({ createdAt: -1 });

        const available = vouchers.filter(v => v.status === 'unused' && new Date(v.expiryDate) > new Date()).map(v => ({
            ...v.toObject(),
            expiryDate: v.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            createdAt: v.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            updatedAt: v.updatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        }));

        const expired = vouchers.filter(v => v.status === 'unused' && new Date(v.expiryDate) <= new Date()).map(v => ({
            ...v.toObject(),
            expiryDate: v.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            createdAt: v.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            updatedAt: v.updatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        }));

        const used = vouchers.filter(v => v.status === 'used').map(v => ({
            ...v.toObject(),
            expiryDate: v.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            createdAt: v.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            updatedAt: v.updatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            redeemedAt: v.redeemedAt ? v.redeemedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null
        }));

        res.status(200).json({
            'message': 'Vouchers retrieved successfully',
            vouchers: {
                available,
                expired,
                used,
                total: vouchers.length
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// MERCHANT: Validate voucher
router.post('/merchant/validate', authmiddlewhere, authorize('merchant'), async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                'message': 'Voucher code is required'
            });
        }

        const voucher = await Voucher.findOne({ code: code.toUpperCase() }).populate('userId', 'Username');

        if (!voucher) {
            return res.status(404).json({
                'message': 'Voucher not found',
                valid: false
            });
        }

        if (voucher.status === 'used') {
            return res.status(400).json({
                'message': 'Voucher already redeemed',
                valid: false,
                redeemedAt: voucher.redeemedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
        }

        if (new Date(voucher.expiryDate) < new Date()) {
            return res.status(400).json({
                'message': 'Voucher has expired',
                valid: false,
                expiryDate: voucher.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
        }

        res.status(200).json({
            'message': 'Voucher is valid',
            valid: true,
            voucher: {
                code: voucher.code,
                value: voucher.value,
                description: voucher.description,
                expiryDate: voucher.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                customerName: voucher.userId.Username,
                createdAt: voucher.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// MERCHANT: Redeem voucher (ATOMIC)
router.post('/merchant/redeem', authmiddlewhere, authorize('merchant'), async (req, res) => {
    try {
        const { code } = req.body;
        const merchantId = req.userID;

        if (!code) {
            return res.status(400).json({
                'message': 'Voucher code is required'
            });
        }

        const voucher = await Voucher.findOneAndUpdate(
            {
                code: code.toUpperCase(),
                status: 'unused',
                expiryDate: { $gt: new Date() }
            },
            {
                status: 'used',
                redeemedAt: new Date(),
                redeemedBy: merchantId
            },
            {
                new: true,
                runValidators: true
            }
        ).populate('userId', 'Username');

        if (!voucher) {
            const existingVoucher = await Voucher.findOne({ code: code.toUpperCase() });

            if (!existingVoucher) {
                return res.status(404).json({
                    'message': 'Voucher not found'
                });
            }

            if (existingVoucher.status === 'used') {
                return res.status(400).json({
                    'message': 'Voucher already redeemed',
                    redeemedAt: existingVoucher.redeemedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                });
            }

            if (new Date(voucher.expiryDate) < new Date()) {
                return res.status(400).json({
                    'message': 'Voucher has expired',
                    valid: false,
                    expiryDate: voucher.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                });
            }
        }

        res.status(200).json({
            'message': `Voucher redeemed successfully! You got ${voucher.value}% off!`,
            'discount': `${voucher.value}%`,
            voucher: {
                code: voucher.code,
                value: voucher.value,
                customerName: voucher.userId.Username,
                redeemedAt: voucher.redeemedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                expiryDate: voucher.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

module.exports = router