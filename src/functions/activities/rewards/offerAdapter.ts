import type { ParsedOffer } from '../../../browser/ReactFunc'
import type { BasePromotion } from '../../../interface/DashboardData'

/**
 * Convert a RSC-parsed offer into the BasePromotion shape expected by
 * PromotionActivityRunner.  Provides safe defaults for every field that
 * downstream consumers (isActionable, UrlReward, SearchOnBing) inspect.
 *
 * BasePromotion has 80+ fields; only the subset actually read at runtime
 * is populated here, so the double cast is intentional.
 */
export function toBasePromotion(offer: ParsedOffer): BasePromotion {
    return {
        offerId: offer.offerId,
        name: offer.offerId,
        title: offer.title || offer.offerId,
        description: offer.description,
        complete: offer.isCompleted,
        pointProgressMax: offer.points,
        pointProgress: 0,
        promotionType: 'urlreward',
        promotionSubtype: offer.promotionSubtype ?? '',
        destinationUrl: offer.destination,
        hash: offer.hash ?? '',
        activityType: String(offer.activityType ?? 11),
        priority: 1,
        attributes: null,
        exclusiveLockedFeatureStatus: '',
    } as unknown as BasePromotion
}
