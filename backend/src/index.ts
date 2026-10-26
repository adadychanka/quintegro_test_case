import { App } from './app';
import { createContainer } from './container';

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  const app = await App.create(createContainer());
  app.listen(PORT);
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
