import type { Region, RegionRouteModel } from '../../../domain';

export interface RegionRouter {
  get(region: Region): RegionRouteModel;
}
