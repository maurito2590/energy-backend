const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1h',
  });
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { valid: true, userId: decoded.userId };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

module.exports = { generateToken, verifyToken };
