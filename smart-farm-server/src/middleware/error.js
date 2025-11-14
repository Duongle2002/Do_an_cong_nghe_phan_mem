function notFound(req, res, next) {
  res.status(404);
  res.json({ message: 'Not Found' });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  const status = res.statusCode >= 400 ? res.statusCode : 500;
  res.status(status).json({ message: err.message || 'Server Error' });
}

module.exports = { notFound, errorHandler };
