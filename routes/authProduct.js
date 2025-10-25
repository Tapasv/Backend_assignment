const express = require('express')
const router = express.Router()
const Product = require('../Schema/Product')
const { authmiddlewhere, authorize } = require('../middlewhere/auth')

// CREATE Product (Admin only)
router.post('/create', authmiddlewhere, authorize('admin'), async (req, res) => {
    try {
        const { name, description, price, category, stock } = req.body;

        if (!name || !price) {
            return res.status(400).json({
                'message': 'Name and price are required'
            });
        }

        const product = new Product({
            name,
            description,
            price,
            category,
            stock
        });

        await product.save();

        res.status(201).json({
            'message': 'Product created successfully',
            product
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// GET All Products (Public or authenticated users)
router.get('/all', async (req, res) => {
    try {
        const { category, isActive } = req.query;

        const filter = {};
        if (category) filter.category = category;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const products = await Product.find(filter).sort({ createdAt: -1 });

        res.status(200).json({
            'message': 'Products retrieved successfully',
            count: products.length,
            products
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// GET Single Product by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                'message': 'Product not found'
            });
        }

        res.status(200).json({
            'message': 'Product retrieved successfully',
            product
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// UPDATE Product (Admin only)
router.put('/update/:id', authmiddlewhere, authorize('admin'), async (req, res) => {
    try {
        const { name, description, price, category, stock, isActive } = req.body;

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { name, description, price, category, stock, isActive },
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({
                'message': 'Product not found'
            });
        }

        res.status(200).json({
            'message': 'Product updated successfully',
            product
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

// DELETE Product (Admin only)
router.delete('/delete/:id', authmiddlewhere, authorize('admin'), async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                'message': 'Product not found'
            });
        }

        res.status(200).json({
            'message': 'Product deleted successfully'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

module.exports = router