import { REGION_ROUTES, type Region, type RegionRouteModel } from '../../../domain';
import type { RegionRouter } from './region-router';

export class StaticRegionRouter implements RegionRouter {
  get(region: Region): RegionRouteModel {
    return REGION_ROUTES[region];
  }
}
