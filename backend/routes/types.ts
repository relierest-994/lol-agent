import type { BackendAppContext } from '../app-context';
import type { RequestContext } from '../http/http-utils';

export type RouteServices = BackendAppContext;
export type RouteHandler = (context: RequestContext, services: RouteServices) => Promise<boolean>;

