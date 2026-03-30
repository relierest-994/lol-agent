import { accountLinkMockCapability, accountLinkStatusCapability, regionSelectCapability } from './account-region.capability';
import {
  billingUnlockCapability,
  entitlementCheckCapability,
  entitlementExplainCapability,
  unlockConfirmCapability,
  unlockCreateCapability,
  usageConsumeCapability,
} from './entitlement-billing.capability';
import { matchListRecentCapability, matchSelectTargetCapability } from './match.capability';
import {
  assetVideoUploadCapability,
  diagnosisVideoCreateCapability,
  diagnosisVideoGetCapability,
  diagnosisVideoStatusCapability,
} from './video-diagnosis.capability';
import {
  reviewAskMatchCapability,
  reviewAskSuggestedPromptsCapability,
  reviewAnalyzeClipCapability,
  reviewAskFollowupCapability,
  reviewDeepGenerateCapability,
  reviewDeepGetCapability,
  reviewDeepStatusCapability,
  reviewGenerateBasicCapability,
  reviewGenerateDeepCapability,
} from './review.capability';

export const capabilityDefinitions = [
  accountLinkStatusCapability,
  accountLinkMockCapability,
  regionSelectCapability,
  matchListRecentCapability,
  matchSelectTargetCapability,
  assetVideoUploadCapability,
  diagnosisVideoCreateCapability,
  diagnosisVideoStatusCapability,
  diagnosisVideoGetCapability,
  reviewGenerateBasicCapability,
  entitlementCheckCapability,
  entitlementExplainCapability,
  usageConsumeCapability,
  reviewDeepGenerateCapability,
  reviewDeepGetCapability,
  reviewDeepStatusCapability,
  reviewGenerateDeepCapability,
  reviewAskMatchCapability,
  reviewAskSuggestedPromptsCapability,
  reviewAskFollowupCapability,
  reviewAnalyzeClipCapability,
  unlockCreateCapability,
  unlockConfirmCapability,
  billingUnlockCapability,
] as const;
