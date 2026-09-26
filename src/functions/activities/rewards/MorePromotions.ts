import { BaseActivity } from '../BaseActivity'
import type { BasePromotion, DashboardData } from '../../../interface/DashboardData'
import { PromotionActivityRunner } from './PromotionActivityRunner'
import { toBasePromotion } from './offerAdapter'

export class MorePromotions extends BaseActivity {
    public async run(data: DashboardData): Promise<void> {
        const promotions = [
            ...new Map(
                [
                    ...(data.dashboard.morePromotions ?? []),
                    ...(data.dashboard.morePromotionsWithoutPromotionalItems ?? [])
                ]
                    .filter(Boolean)
                    .map(promotion => [promotion.offerId, promotion as BasePromotion] as const)
            ).values()
        ]

        // Append RSC-only offers (e.g. Explore on Bing) that the dashboard
        // API did not return.  Skip dailyset items — handled by DailySet.
        const existingIds = new Set(promotions.map(p => p.offerId))
        for (const offer of this.bot.reactSnapshot?.reportable ?? []) {
            if (offer.offerId.toLowerCase().includes('dailyset') || existingIds.has(offer.offerId)) continue
            promotions.push(toBasePromotion(offer))
            existingIds.add(offer.offerId)
        }

        const pending = promotions.filter(promotion => this.isActionable(promotion))
        if (!pending.length) {
            this.bot.logger.info(
                this.bot.isMobile,
                'MORE-PROMOTIONS',
                'All "More Promotions" items have already been completed'
            )
            return
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'MORE-PROMOTIONS',
            `Started solving "More Promotions" items | remaining=${pending.length}`
        )
        await new PromotionActivityRunner(this.bot).run(pending)
        this.bot.logger.info(this.bot.isMobile, 'MORE-PROMOTIONS', 'Finished processing "More Promotions" items')
    }

    private isActionable(promotion: BasePromotion): boolean {
        if (promotion.complete || promotion.pointProgressMax <= 0) return false
        const isRewardsApp =
            promotion.exclusiveLockedFeatureCategory?.toLowerCase() === 'rewardsapp' ||
            promotion.offerId?.toLowerCase().includes('rewardsapp')
        if (promotion.exclusiveLockedFeatureStatus === 'locked' && !isRewardsApp) return false
        if (!promotion.promotionType) return false
        if (promotion.priority < 0 && promotion.exclusiveLockedFeatureStatus !== 'unlocked' && !isRewardsApp) return false
        return this.getAttribute(promotion, 'promotional') !== 'True'
    }

    private getAttribute(promotion: BasePromotion, key: string): unknown {
        const attributes = promotion.attributes
        if (!attributes || typeof attributes !== 'object') return undefined
        return (attributes as Record<string, unknown>)[key]
    }
}
