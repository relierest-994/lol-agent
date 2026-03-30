import type { RouteHandler } from './types';
import { handleAccountMatchRoutes } from './account-match-routes';
import { handleEntitlementPaymentRoutes } from './entitlement-payment-routes';
import { handleHealthRoutes } from './health-routes';
import { handleReviewRoutes } from './review-routes';
import { handleVideoRoutes } from './video-routes';

export const routeHandlers: RouteHandler[] = [
  handleHealthRoutes,
  handleReviewRoutes,
  handleAccountMatchRoutes,
  handleVideoRoutes,
  handleEntitlementPaymentRoutes,
];

