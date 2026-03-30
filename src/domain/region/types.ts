export type Region = 'INTERNATIONAL' | 'CN';

export type RegionType = 'GLOBAL' | 'MAINLAND_CHINA';
export type AccountSystem = 'RIOT' | 'WEGAME_TENCENT';
export type DataSourceType = 'RIOT_API_MOCK' | 'WEGAME_API_MOCK';

export interface RegionRouteModel {
  regionType: RegionType;
  regionKey: Region;
  accountSystem: AccountSystem;
  dataSourceType: DataSourceType;
  availableCapabilities: string[];
}

export const REGION_ROUTES: Record<Region, RegionRouteModel> = {
  INTERNATIONAL: {
    regionType: 'GLOBAL',
    regionKey: 'INTERNATIONAL',
    accountSystem: 'RIOT',
    dataSourceType: 'RIOT_API_MOCK',
    availableCapabilities: [
      'account.link_status',
      'account.link_mock',
      'match.list_recent',
      'match.select_target',
      'review.generate_basic',
    ],
  },
  CN: {
    regionType: 'MAINLAND_CHINA',
    regionKey: 'CN',
    accountSystem: 'WEGAME_TENCENT',
    dataSourceType: 'WEGAME_API_MOCK',
    availableCapabilities: [
      'account.link_status',
      'account.link_mock',
      'match.list_recent',
      'match.select_target',
      'review.generate_basic',
    ],
  },
};
