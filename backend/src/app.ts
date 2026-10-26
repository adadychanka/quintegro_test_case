import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger';
import { delayMiddleware } from './middleware/delayMiddleware';
import { createErrorTestMiddleware } from './middleware/errorTestMiddleware';
import { createApolloServer } from './graphql/server';
import { createAuthRoutes } from './routes/authRoutes';
import { createOrderRoutes } from './routes/orderRoutes';
import { createPromoRoutes } from './routes/promoRoutes';
import { createResetRoutes } from './routes/resetRoutes';
import { AuthController } from './controllers/authController';
import { OrderController } from './controllers/orderController';
import { PromoController } from './controllers/promoController';
import { Container } from './container';

export class App {
  public app: express.Application;

  private constructor(private container: Container) {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSwagger();
  }

  // Apollo must be started before the app accepts requests.
  static async create(container: Container): Promise<App> {
    const instance = new App(container);
    await instance.initializeGraphQL();
    return instance;
  }

  private initializeMiddlewares(): void {
    const { faultInjection } = this.container.config;
    this.app.use(helmet({ contentSecurityPolicy: (process.env.NODE_ENV === 'production') ? undefined : false }));
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Add delay to all API requests (skipped for bypassed paths and operations)
    this.app.use(delayMiddleware(1500, faultInjection));

    // Add error test middleware (returns 500 on every 5th request)
    this.app.use(createErrorTestMiddleware(faultInjection));

    // Serve static files for product images
    this.app.use('/productImg', express.static('public/productImg'));
  }

  private initializeRoutes(): void {
    const { services } = this.container;

    const authController = new AuthController(services.auth);
    const orderController = new OrderController(services.orders, services.auth);
    const promoController = new PromoController(services.promos);

    this.app.use('/api', createAuthRoutes(authController));
    this.app.use('/api/order', createOrderRoutes(orderController));
    this.app.use('/api/promo', createPromoRoutes(promoController));
    this.app.use('/reset/orders', createResetRoutes(this.container.reset));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Quintegro API',
        version: '1.0.0',
        endpoints: {
          docs: '/api-docs',
          health: '/health',
          login: '/api/login',
          orders: '/api/order',
          promos: '/api/promo'
        }
      });
    });
  }

  private initializeSwagger(): void {
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private async initializeGraphQL(): Promise<void> {
    const apolloServer = createApolloServer(this.container);
    await apolloServer.start();

    apolloServer.applyMiddleware({
      app: this.app,
      path: '/graphql',
      cors: false // We're already using CORS middleware
    });
  }

  public listen(port: number): void {
    this.app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
      console.log(`📚 API Documentation available at http://localhost:${port}/api-docs`);
      console.log(`🚀 GraphQL server ready at http://localhost:${port}/graphql`);
    });
  }
}
