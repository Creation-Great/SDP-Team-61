import app from './app.js';

const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';

app.listen(Number(port), host, () => {
  console.log(`✓ API server listening on http://${host}:${port}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  LAN access: http://<your-ip>:${port}`);
});
