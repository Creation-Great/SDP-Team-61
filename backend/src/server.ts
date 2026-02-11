import app from './app.js';

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`✓ API server listening on http://localhost:${port}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
});
