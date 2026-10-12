const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.errors.map(err => ({
        path: err.path[0],
        message: err.message
      }))
    });
  }
};

module.exports = validate;
