const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) {
    return res.status(401).send({ success: false, error: 'Access denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.id = decoded.id;
    req.email = decoded.email;

    next();
  } catch (error) {
    return res.status(400).send({ success: false, error: 'Invalid token' });
  }
};

module.exports = auth;
