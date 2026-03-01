const Product = require('../models/Product');

exports.getAllProducts = async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = { isActive: true };
    if (type) query.type = type;

    const products = await Product.find(query);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { productCode, name, type, initialPrice, dailyIncomeRate, duration, icon } = req.body;
    const adminId = req.user._id;

    const totalIncome = initialPrice * (1 + dailyIncomeRate * duration);

    const product = new Product({
      productCode: productCode.toUpperCase(),
      name,
      type,
      initialPrice,
      dailyIncomeRate,
      duration,
      totalIncome,
      icon: icon || '📦',
      createdBy: adminId,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
