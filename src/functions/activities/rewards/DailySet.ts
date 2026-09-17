import { BaseActivity } from '../BaseActivity'
import type { BasePromotion, DashboardData } from '../../../interface/DashboardData'
import { PromotionActivityRunner } from './PromotionActivityRunner'
import { toBasePromotion } from './offerAdapter'

export class DailySet extends BaseActivity {
    public async run(data: DashboardData): Promise<void> {
        const today = this.bot.utils.getFormattedDate()
        let pending: BasePromotion[] =
            data.dashboard.dailySetPromotions[today]?.filter(item => !item.complete && item.pointProgressMax > 0) ?? []

        // Fallback: dashboard API may return an empty daily set while the
        // RSC payload still contains the offers keyed by offerId.
        if (!pending.length && this.bot.reactSnapshot?.offers) {
            const fromRsc = this.bot.reactSnapshot.offers.filter(
                o => o.offerId.toLowerCase().includes('dailyset') && !o.isCompleted && o.points > 0 && o.reportable
            )
            if (fromRsc.length) {
                pending = fromRsc.map(toBasePromotion)
            }
        }

        if (!pending.length) {
            this.bot.logger.info(this.bot.isMobile, 'DAILY-SET', 'All "Daily Set" items have already been completed')
            return
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'DAILY-SET',
            `Started solving "Daily Set" items | remaining=${pending.length}`
        )
        await new PromotionActivityRunner(this.bot).run(pending)
        this.bot.logger.info(this.bot.isMobile, 'DAILY-SET', 'Finished processing "Daily Set" items')
    }
}
