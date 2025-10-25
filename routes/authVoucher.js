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
        const { userId, value, expiryDays, description, applicableProducts, minPurchaseAmount, maxDiscountAmount } = req.body;

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
            description: description || `${value}% off voucher`,
            applicableProducts: applicableProducts || [],
            minPurchaseAmount: minPurchaseAmount || 0,
            maxDiscountAmount: maxDiscountAmount || null,
            originalOwner: userId,
            canBeShared: true
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

        // Add sharing info to available vouchers
        const availableWithSharing = available.map(v => {
            const voucherObj = typeof v.toObject === 'function' ? v : v;
            return {
                ...voucherObj,
                sharingInfo: {
                    isShared: v.isShared || false,
                    canBeShared: v.canBeShared !== undefined ? v.canBeShared : true,
                    timesShared: v.sharedWith ? v.sharedWith.length : 0
                }
            };
        });

        res.status(200).json({
            'message': 'Vouchers retrieved successfully',
            vouchers: {
                available: availableWithSharing,
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

// CUSTOMER: Share voucher with another user
router.post('/share-voucher', authmiddlewhere, authorize('customer'), async (req, res) => {
    try {
        const { code, recipientUsername } = req.body;//recipientUsername is username what we entered in thunderclient and after that my app will search in mongo db for that user name if it finds it will give us back its id from that database so that we can share vouchers
        const senderId = req.userID;

        if (!code || !recipientUsername) {
            return res.status(400).json({
                'message': 'Voucher code and recipient username are required'
            });
        }

        // Find the voucher
        const voucher = await Voucher.findOne({ code: code.toUpperCase() });

        if (!voucher) {
            return res.status(404).json({
                'message': 'Voucher not found'
            });
        }

        // Check if voucher belongs to sender
        if (voucher.userId.toString() !== senderId) {
            return res.status(403).json({
                'message': 'You can only share your own vouchers'
            });
        }

        // Check if voucher is already used
        if (voucher.status === 'used') {
            return res.status(400).json({
                'message': 'Cannot share a used voucher'
            });
        }

        // Check if voucher is expired
        if (new Date(voucher.expiryDate) < new Date()) {
            return res.status(400).json({
                'message': 'Cannot share an expired voucher'
            });
        }

        // Check if voucher can be shared
        if (!voucher.canBeShared) {
            return res.status(400).json({
                'message': 'This voucher cannot be shared'
            });
        }

        // Find recipient user
        const recipient = await User.findOne({ Username: recipientUsername });

        if (!recipient) {
            return res.status(404).json({
                'message': `User '${recipientUsername}' not found`
            });
        }

        // Check if recipient is the same as sender
        if (recipient._id.toString() === senderId) {
            return res.status(400).json({
                'message': 'You cannot share a voucher with yourself'
            });
        }

        // Check if already shared with this user
        const alreadyShared = voucher.sharedWith.some(
            share => share.userId.toString() === recipient._id.toString()
        );

        if (alreadyShared) {
            return res.status(400).json({
                'message': `Voucher already shared with ${recipientUsername}`
            });
        }

        // Update voucher ownership and add to shared history
        voucher.sharedWith.push({
            userId: voucher.userId,
            sharedAt: new Date()
        });
        voucher.userId = recipient._id;
        voucher.isShared = true;

        await voucher.save();

        res.status(200).json({
            'message': `Voucher successfully shared with ${recipientUsername}`,
            voucher: {
                code: voucher.code,
                value: voucher.value,
                sharedTo: recipientUsername,
                sharedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// CUSTOMER: View voucher sharing history
router.get('/sharing-history/:code', authmiddlewhere, authorize('customer'), async (req, res) => {
    try {
        const { code } = req.params;
        const userId = req.userID;

        const voucher = await Voucher.findOne({ code: code.toUpperCase() })
            .populate('originalOwner', 'Username')
            .populate('userId', 'Username')
            .populate('sharedWith.userId', 'Username');

        if (!voucher) {
            return res.status(404).json({
                'message': 'Voucher not found'
            });
        }

        // Check if user has access to this voucher
        const isOriginalOwner = voucher.originalOwner && voucher.originalOwner._id.toString() === userId;
        const isCurrentOwner = voucher.userId._id.toString() === userId;
        const wasSharedWithUser = voucher.sharedWith.some(
            share => share.userId._id.toString() === userId
        );

        if (!isOriginalOwner && !isCurrentOwner && !wasSharedWithUser) {
            return res.status(403).json({
                'message': 'You do not have access to this voucher history'
            });
        }

        const sharingHistory = voucher.sharedWith.map(share => ({
            sharedWith: share.userId.Username,
            sharedAt: share.sharedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        }));

        res.status(200).json({
            'message': 'Sharing history retrieved successfully',
            voucher: {
                code: voucher.code,
                value: voucher.value,
                originalOwner: voucher.originalOwner ? voucher.originalOwner.Username : 'N/A',
                currentOwner: voucher.userId.Username,
                isShared: voucher.isShared,
                sharingHistory
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
                createdAt: voucher.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                isShared: voucher.isShared || false,
                timesShared: voucher.sharedWith ? voucher.sharedWith.length : 0
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// MERCHANT: Validate voucher with cart items
router.post('/merchant/validate-with-cart', authmiddlewhere, authorize('merchant'), async (req, res) => {
    try {
        const { code, cartItems } = req.body;
        // cartItems format: [{ productId: "...", quantity: 2, price: 100 }, ...]

        if (!code || !cartItems || !Array.isArray(cartItems)) {
            return res.status(400).json({
                'message': 'Voucher code and cartItems are required'
            });
        }

        const voucher = await Voucher.findOne({ code: code.toUpperCase() })
            .populate('userId', 'Username')
            .populate('applicableProducts', 'name price');

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

        // Calculate total cart value
        const totalCartValue = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Check minimum purchase amount
        if (totalCartValue < voucher.minPurchaseAmount) {
            return res.status(400).json({
                'message': `Minimum purchase amount of ₹${voucher.minPurchaseAmount} required. Current cart: ₹${totalCartValue}`,
                valid: false,
                minPurchaseAmount: voucher.minPurchaseAmount,
                currentCartValue: totalCartValue
            });
        }

        // Check if voucher is product-specific
        let applicableCartValue = totalCartValue;
        let applicableItems = cartItems;

        if (voucher.applicableProducts && voucher.applicableProducts.length > 0) {
            const applicableProductIds = voucher.applicableProducts.map(p => p._id.toString());

            applicableItems = cartItems.filter(item =>
                applicableProductIds.includes(item.productId.toString())
            );

            if (applicableItems.length === 0) {
                return res.status(400).json({
                    'message': 'This voucher is not applicable to any items in your cart',
                    valid: false,
                    applicableProducts: voucher.applicableProducts.map(p => p.name)
                });
            }

            applicableCartValue = applicableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }

        // Calculate discount
        let discountAmount = (applicableCartValue * voucher.value) / 100;

        // Apply max discount limit if set
        if (voucher.maxDiscountAmount && discountAmount > voucher.maxDiscountAmount) {
            discountAmount = voucher.maxDiscountAmount;
        }

        const finalAmount = totalCartValue - discountAmount;

        res.status(200).json({
            'message': 'Voucher is valid',
            valid: true,
            voucher: {
                code: voucher.code,
                value: voucher.value,
                description: voucher.description,
                expiryDate: voucher.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                customerName: voucher.userId.Username,
                minPurchaseAmount: voucher.minPurchaseAmount,
                maxDiscountAmount: voucher.maxDiscountAmount,
                applicableProducts: voucher.applicableProducts.length > 0
                    ? voucher.applicableProducts.map(p => p.name)
                    : 'All Products'
            },
            calculation: {
                totalCartValue,
                applicableCartValue,
                discountPercentage: voucher.value,
                discountAmount,
                finalAmount
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