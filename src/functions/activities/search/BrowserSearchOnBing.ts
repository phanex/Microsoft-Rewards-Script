import type { Page } from 'patchright'
import { BaseActivity } from '../BaseActivity'
import {
    activateSearchOnBing,
    findSearchOnBingOffer,
    getSearchOnBingQueries,
    recordFailedSearchOnBing
} from './SearchOnBingShared'
import { saveSuccessfulQuery } from './AiSearchQueryGenerator'
import { URLs } from '../../../constants/urls'

import type { BasePromotion } from '../../../interface/DashboardData'

export class SearchOnBing extends BaseActivity {
    private gainedPoints = 0
    private success = false
    private oldBalance = 0

    public async doSearchOnBing(promotion: BasePromotion, page: Page) {
        const offerId = promotion.offerId
        this.oldBalance = Number(this.bot.userData.currentPoints ?? 0)
        this.gainedPoints = 0
        this.success = false

        this.bot.logger.info(
            this.bot.isMobile,
            'SEARCH-ON-BING',
            `Starting SearchOnBing | offerId=${offerId} | title="${promotion.title}" | currentBalance=${this.oldBalance}`
        )

        let queries: string[] = []

        try {
            const activated = await activateSearchOnBing(this.bot, promotion)
            if (!activated) {
                recordFailedSearchOnBing(promotion, 'Activation failed or not acknowledged by server')
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'SEARCH-ON-BING',
                    `Search activity couldn't be activated, aborting | offerId=${offerId}`
                )
                return
            }

            queries = await getSearchOnBingQueries(this.bot, promotion)
            await this.searchBing(page, queries, promotion)

            // If not completed and AI query generator is enabled, attempt 1 retry with alternative AI queries
            if (!this.success && this.bot.config.experimental.aiQueryGenerator) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'SEARCH-ON-BING-AI',
                    `Initial queries did not complete offer ${offerId}, requesting alternative AI queries...`
                )
                const retryQueries = await getSearchOnBingQueries(this.bot, promotion, queries)
                const newQueries = retryQueries.filter(q => !queries.includes(q))
                if (newQueries.length > 0) {
                    await this.searchBing(page, newQueries, promotion)
                    queries = [...queries, ...newQueries]
                }
            }

            if (this.success) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'SEARCH-ON-BING',
                    `Completed SearchOnBing | offerId=${offerId} | pointsGained=${this.gainedPoints} | currentBalance=${this.bot.userData.currentPoints} | previousBalance=${this.oldBalance}`,
                    'green'
                )
            } else {
                recordFailedSearchOnBing(
                    promotion,
                    `Queries exhausted without completion (tried ${queries.length} queries)`,
                    queries
                )
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'SEARCH-ON-BING',
                    `Failed SearchOnBing | offerId=${offerId} | pointsGained=${this.gainedPoints} | currentBalance=${this.bot.userData.currentPoints} | previousBalance=${this.oldBalance}`
                )
            }
        } catch (error) {
            recordFailedSearchOnBing(promotion, error instanceof Error ? error.message : String(error), queries ?? [])
            this.bot.logger.error(
                this.bot.isMobile,
                'SEARCH-ON-BING',
                `Error in doSearchOnBing | offerId=${offerId} | message=${error instanceof Error ? error.message : String(error)}`
            )
        } finally {
            await page.goto(URLs.rewards.earn).catch(() => {})
        }
    }

    private async searchBing(page: Page, queries: string[], promotion: BasePromotion) {
        queries = [...new Set(queries)]
        const offerId = promotion.offerId

        this.bot.logger.debug(
            this.bot.isMobile,
            'SEARCH-ON-BING-SEARCH',
            `Starting search loop | queriesCount=${queries.length} | targetPoints=${promotion.pointProgressMax} | currentBalance=${this.oldBalance}`
        )

        await this.bot.browser.func.synchronizeActiveBrowserCookies('SEARCH-ON-BING-COOKIE-SEED', true)

        const isRewardsApp =
            promotion.exclusiveLockedFeatureCategory?.toLowerCase() === 'rewardsapp' ||
            offerId.toLowerCase().includes('rewardsapp')

        if (isRewardsApp && promotion.destinationUrl) {
            const destUrl = promotion.destinationUrl.includes('pc=')
                ? promotion.destinationUrl
                : `${promotion.destinationUrl}&pc=R010`
            await page.setExtraHTTPHeaders({ 'X-Rewards-Source': 'msrewards-desktop' }).catch(() => {})
            this.bot.logger.info(
                this.bot.isMobile,
                'SEARCH-ON-BING-SEARCH',
                `Navigating directly to destinationUrl for RewardsApp activity | url=${destUrl}`
            )
            await page.goto(destUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 8000))

            const dashboard = (await this.bot.browser.func.getDashboardData()).dashboard
            const newBalance = dashboard.userStatus.availablePoints
            const offer = findSearchOnBingOffer(dashboard, offerId)
            const offerComplete =
                !!offer &&
                (offer.complete || (offer.pointProgressMax > 0 && offer.pointProgress >= offer.pointProgressMax))

            if (offerComplete || newBalance > this.oldBalance) {
                this.success = true
                const delta = newBalance - this.oldBalance
                if (delta > 0) {
                    this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + delta
                    this.gainedPoints = delta
                }
                this.bot.userData.currentPoints = newBalance
                this.bot.logger.info(
                    this.bot.isMobile,
                    'SEARCH-ON-BING-SEARCH',
                    `RewardsApp activity completed via direct destinationUrl | pointsGained=${this.gainedPoints} | currentBalance=${newBalance}`,
                    'green'
                )
                if (this.bot.config.experimental.aiQueryGenerator && queries[0]) {
                    saveSuccessfulQuery(offerId, promotion.title ?? '', queries[0])
                }
                return
            }
        }

        await this.ensureSearchReady(page)

        let lastBalance = this.oldBalance

        for (const [index, query] of queries.entries()) {
            try {
                this.bot.logger.debug(this.bot.isMobile, 'SEARCH-ON-BING-SEARCH', `Processing query | query="${query}"`)

                await this.bot.browser.func.synchronizeActiveBrowserCookies('SEARCH-ON-BING-COOKIE-SEED', true)
                await this.typeSearch(page, query)

                await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 7000))

                await this.bot.browser.func.synchronizeActiveBrowserCookies('SEARCH-ON-BING-COOKIE-CAPTURE')
                const dashboard = (await this.bot.browser.func.getDashboardData()).dashboard
                const newBalance = dashboard.userStatus.availablePoints
                const offer = findSearchOnBingOffer(dashboard, offerId)

                const delta = newBalance - lastBalance
                if (delta > 0) {
                    this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + delta
                    lastBalance = newBalance
                }
                this.bot.userData.currentPoints = newBalance
                this.gainedPoints = newBalance - this.oldBalance

                const offerProgress = offer ? `${offer.pointProgress}/${offer.pointProgressMax}` : 'unknown'
                const offerComplete =
                    !!offer &&
                    (offer.complete || (offer.pointProgressMax > 0 && offer.pointProgress >= offer.pointProgressMax))

                this.bot.logger.debug(
                    this.bot.isMobile,
                    'SEARCH-ON-BING-SEARCH',
                    `Progress check | query="${query}" | offerProgress=${offerProgress} | offerComplete=${offerComplete} | currentBalance=${newBalance}`
                )

                if (offerComplete) {
                    this.success = true
                    this.bot.logger.info(
                        this.bot.isMobile,
                        'SEARCH-ON-BING-SEARCH',
                        `SearchOnBing activity completed | pointsGained=${this.gainedPoints} | currentBalance=${newBalance} | query="${query}" | offerProgress=${offerProgress}`,
                        'green'
                    )
                    if (this.bot.config.experimental.aiQueryGenerator) {
                        saveSuccessfulQuery(offerId, promotion.title ?? '', query)
                        this.bot.logger.info(
                            this.bot.isMobile,
                            'SEARCH-ON-BING-AI',
                            `Persisted verified working query "${query}" to custom.json for ${offerId}`,
                            'cyan'
                        )
                    }
                    return
                }

                this.bot.logger.warn(
                    this.bot.isMobile,
                    'SEARCH-ON-BING-SEARCH',
                    `${index + 1}/${queries.length} | activity not complete | offerProgress=${offerProgress} | query="${query}"`
                )
            } catch (error) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'SEARCH-ON-BING-SEARCH',
                    `Error during search loop | query="${query}" | message=${error instanceof Error ? error.message : String(error)}`
                )
            } finally {
                if (!this.success && index < queries.length - 1) {
                    await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 15000))
                }
            }
        }

        this.bot.logger.warn(
            this.bot.isMobile,
            'SEARCH-ON-BING-SEARCH',
            `Finished all queries without completing the activity | queriesTried=${queries.length} | offerId=${offerId} | pointsGained=${this.gainedPoints} | currentBalance=${this.bot.userData.currentPoints} | previousBalance=${this.oldBalance}`
        )
    }

    private async ensureSearchReady(page: Page) {
        const searchBox = page.locator('#sb_form_q')
        if (await searchBox.isVisible().catch(() => false)) return

        await page.goto(URLs.bing.origin)
        await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
        await this.bot.browser.utils.tryDismissAllMessages(page)
    }

    private async typeSearch(page: Page, query: string) {
        await this.ensureSearchReady(page)

        const selector = '#sb_form_q'
        const searchBox = page.locator(selector)
        await searchBox.waitFor({ state: 'visible', timeout: 15000 })

        await this.bot.utils.wait(500)
        await this.bot.browser.utils.ghostClick(page, selector, { clickCount: 3 })
        await searchBox.fill('')

        await page.keyboard.type(query, { delay: this.bot.utils.randomDelay(45, 90) })
        await page.keyboard.press('Enter')
        await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
    }
}
