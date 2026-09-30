import * as fs from 'fs'
import path from 'path'

import { URLs } from '../../../constants/urls'
import type { BasePromotion, Dashboard } from '../../../interface/DashboardData'
import type { MicrosoftRewardsBot } from '../../../index'
import { generateAiQueries } from './AiSearchQueryGenerator'

interface ActivityQueries {
    title: string
    queries: string[]
}

export async function activateSearchOnBing(bot: MicrosoftRewardsBot, promotion: BasePromotion): Promise<boolean> {
    const offerId = promotion.offerId
    const actionId = bot.nextActions.reportActivity

    if (!actionId) {
        bot.logger.warn(
            bot.isMobile,
            'SEARCH-ON-BING-ACTIVATE',
            `Skipping ${offerId}: "reportActivity" not discovered in bundle`
        )
        return false
    }

    const live = await bot.browser.func.ensureOffer(offerId)
    const hash = live?.hash ?? promotion.hash ?? null
    if (!hash) {
        bot.logger.warn(
            bot.isMobile,
            'SEARCH-ON-BING-ACTIVATE',
            `Skipping ${offerId}: no live hash for the activation offer`
        )
        return false
    }

    try {
        const { status, acknowledged } = await bot.browser.func.reportServerAction(actionId, [
            hash,
            11,
            {
                offerid: offerId,
                isPromotional: '$undefined',
                timezoneOffset: bot.userData.timezoneOffset
            }
        ])

        bot.logger.info(
            bot.isMobile,
            'SEARCH-ON-BING-ACTIVATE',
            `Activated activity | offerId=${offerId} | status=${status} | acknowledged=${acknowledged}`
        )
        return acknowledged
    } catch (error) {
        bot.logger.error(
            bot.isMobile,
            'SEARCH-ON-BING-ACTIVATE',
            `Activation failed | offerId=${offerId} | message=${error instanceof Error ? error.message : String(error)}`
        )
        return false
    }
}

export function findSearchOnBingOffer(dashboard: Dashboard, offerId: string): BasePromotion | undefined {
    const offers = [
        ...Object.values(dashboard.dailySetPromotions ?? {}).flat(),
        ...(dashboard.morePromotions ?? []),
        ...(dashboard.promotionalItems ?? []),
        ...(dashboard.promotionalItem ? [dashboard.promotionalItem] : [])
    ]
    return offers.find(offer => offer.offerId === offerId)
}

export async function getSearchOnBingQueries(
    bot: MicrosoftRewardsBot,
    promotion: BasePromotion,
    failedQueries?: string[]
): Promise<string[]> {
    try {
        let activities: ActivityQueries[]

        if (bot.config.searchOnBingLocalQueries) {
            bot.logger.debug(bot.isMobile, 'SEARCH-ON-BING-QUERY', 'Using local queries config file')
            activities = JSON.parse(
                fs.readFileSync(path.join(__dirname, '../../bing-search-activity-queries.json'), 'utf8')
            ) as ActivityQueries[]
        } else {
            bot.logger.debug(bot.isMobile, 'SEARCH-ON-BING-QUERY', 'Fetching queries config from remote repository')
            activities = (
                await bot.http.request<ActivityQueries[]>({
                    method: 'GET',
                    url: URLs.github.searchOnBingQueries
                })
            ).data
        }

        // Load custom local queries if present (e.g. localized/user-defined activities)
        const customCandidates = [
            path.join(process.cwd(), 'config/custom.json'),
            path.join(__dirname, '../../custom.json'),
            path.join(process.cwd(), 'custom.json'),
            path.join(process.cwd(), 'src/functions/custom.json')
        ]
        let customActivities: ActivityQueries[] = []
        for (const candidate of customCandidates) {
            if (fs.existsSync(candidate)) {
                try {
                    customActivities = JSON.parse(fs.readFileSync(candidate, 'utf8')) as ActivityQueries[]
                    bot.logger.debug(
                        bot.isMobile,
                        'SEARCH-ON-BING-QUERY',
                        `Loaded ${customActivities.length} custom activity queries from ${candidate}`
                    )
                    break
                } catch (e) {
                    bot.logger.warn(
                        bot.isMobile,
                        'SEARCH-ON-BING-QUERY',
                        `Failed reading custom queries file ${candidate} | ${e instanceof Error ? e.message : String(e)}`
                    )
                }
            }
        }

        // Helper to check if an activity entry matches the promotion
        const isMatch = (activityTitle: string): boolean => {
            const normActivity = bot.utils.normalizeString(activityTitle)
            const normPromotionTitle = bot.utils.normalizeString(promotion.title ?? '')
            const normOfferId = bot.utils.normalizeString(promotion.offerId ?? '')

            if (!normActivity) return false

            // 1. Exact match on title (localized or English)
            if (normPromotionTitle && normActivity === normPromotionTitle) return true

            // 2. Exact match on offerId
            if (normOfferId && normActivity === normOfferId) return true

            // 3. Keyword match in offerId (e.g. activityTitle "recipe" in offerId "ENUS_recipe_exploreonbing...")
            if (normOfferId && normOfferId.includes(normActivity)) return true

            return false
        }

        // 0. Extract query directly from destinationUrl if present (e.g. RewardsApp search offers)
        if (!failedQueries?.length && promotion.destinationUrl) {
            try {
                const targetUrl = new URL(promotion.destinationUrl, URLs.bing.origin)
                const urlQuery = targetUrl.searchParams.get('q')
                if (urlQuery && urlQuery.trim()) {
                    bot.logger.info(
                        bot.isMobile,
                        'SEARCH-ON-BING-QUERY',
                        `Extracted target query "${urlQuery.trim()}" directly from destinationUrl | offerId=${promotion.offerId}`
                    )
                    return [urlQuery.trim()]
                }
            } catch {}
        }

        // 1. Check custom dictionary first (prioritizes local offerId / localized overrides)
        // If failedQueries were provided, this is a retry and custom match shouldn't loop indefinitely
        if (!failedQueries?.length) {
            const customMatch = customActivities.find(activity => isMatch(activity.title))
            if (customMatch?.queries.length) {
                const shuffled = bot.utils.shuffleArray(customMatch.queries)
                bot.logger.info(
                    bot.isMobile,
                    'SEARCH-ON-BING-QUERY',
                    `Found ${shuffled.length} queries for "${promotion.title}" (${promotion.offerId}) | source=custom`
                )
                return shuffled
            }
        }

        // 2. Check stock/remote dictionary
        if (!failedQueries?.length) {
            const match = activities.find(activity => isMatch(activity.title))
            if (match?.queries.length) {
                const shuffled = bot.utils.shuffleArray(match.queries)
                bot.logger.info(
                    bot.isMobile,
                    'SEARCH-ON-BING-QUERY',
                    `Found ${shuffled.length} queries for "${promotion.title}" (${promotion.offerId}) | source=${bot.config.searchOnBingLocalQueries ? 'local' : 'remote'}`
                )
                return shuffled
            }
        }

        // 3. Optional AI query generator for localized/unhandled tasks
        if (bot.config.experimental.aiQueryGenerator) {
            bot.logger.info(
                bot.isMobile,
                'SEARCH-ON-BING-AI',
                `Generating AI queries for "${promotion.title}" (${promotion.offerId})${failedQueries?.length ? ` | retrying without ${failedQueries.length} failed queries` : ''}`
            )
            const aiQueries = await generateAiQueries(
                promotion.title ?? '',
                promotion.description ?? '',
                failedQueries,
                {
                    aiBaseUrl: bot.config.experimental.aiBaseUrl,
                    aiApiKey: bot.config.experimental.aiApiKey,
                    aiModel: bot.config.experimental.aiModel
                }
            )
            const validAiQueries = aiQueries.filter(isValidBingQuery)
            if (validAiQueries.length > 0) {
                bot.logger.info(
                    bot.isMobile,
                    'SEARCH-ON-BING-AI',
                    `Received ${validAiQueries.length} AI queries for "${promotion.title}" | queries=${JSON.stringify(validAiQueries)}`,
                    'cyan'
                )
                return validAiQueries
            }
            bot.logger.warn(
                bot.isMobile,
                'SEARCH-ON-BING-AI',
                `AI query generator returned 0 queries, falling back to heuristics`
            )
        }

        // 4. No curated/AI match — fall back safely to the activity description and title
        const fallback = fallbackQueries(promotion)
        bot.logger.info(
            bot.isMobile,
            'SEARCH-ON-BING-QUERY',
            `No curated queries for "${promotion.title}" (${promotion.offerId}), falling back to activity description/title | queriesCount=${fallback.length}`
        )
        return fallback
    } catch (error) {
        bot.logger.error(
            bot.isMobile,
            'SEARCH-ON-BING-QUERY',
            `Error resolving search queries | title="${promotion.title}" | message=${error instanceof Error ? error.message : String(error)} | fallback=titleAndDescription`
        )
        return fallbackQueries(promotion)
    }
}

/**
 * Validates that a string is a sane, human search query and not a URL,
 * markup, SVG code, or system token.
 */
export function isValidBingQuery(query: string): boolean {
    if (!query) return false
    const q = query.trim()
    if (q.length < 2 || q.length > 100) return false
    // Reject URLs and protocol fragments
    if (/^(?:https?:\/\/|www\.)/i.test(q)) return false
    if (/https\s+www/i.test(q)) return false
    // Reject technical markup / SVG code / CSS tokens
    if (/\b(?:svg|path|currentColor|xmlns|viewBox|className|data-testid|div)\b/i.test(q)) return false
    if (/^M\d+[a-z0-9\s,\-]+$/i.test(q)) return false
    // Reject excessive word count (search queries are rarely > 10 words)
    const words = q.split(/\s+/).filter(Boolean)
    if (words.length > 10) return false
    return true
}

/**
 * Extracts a human-readable topic from Explore on Bing offer IDs
 * (e.g. ENUS_bankaccounts_exploreonbing_activation_Evergreen -> "bank accounts")
 */
export function extractExploreOnBingTopic(offerId?: string): string | null {
    if (!offerId) return null
    const match = offerId.match(/(?:^|_)([a-z0-9]+)_exploreonbing/i)
    if (!match || !match[1]) return null
    const keyword = match[1].toLowerCase()
    const knownMappings: Record<string, string> = {
        bankaccounts: 'bank accounts',
        rentalcars: 'rental cars',
        airlinetickets: 'airline tickets',
        airportparking: 'airport parking',
        flowerdelivery: 'flower delivery',
        streamingservices: 'streaming services',
        creditreport: 'credit report',
        financemarket: 'finance market',
        videogames: 'video games',
        timezonedates: 'time zone dates',
        recipe: 'recipes',
        dictionary: 'dictionary',
        mattress: 'mattress',
        health: 'health'
    }
    return knownMappings[keyword] || keyword
}

function fallbackQueries(promotion: BasePromotion): string[] {
    const rawCandidates: string[] = []

    const topic = extractExploreOnBingTopic(promotion.offerId)
    if (topic) {
        rawCandidates.push(topic)
    }

    const title = (promotion.title ?? '').trim()
    const description = (promotion.description ?? '').trim()
    const derived = extractSearchTerm(description)

    if (derived) rawCandidates.push(derived)
    if (title && title !== promotion.offerId) rawCandidates.push(title)
    if (description) rawCandidates.push(description)

    const valid = rawCandidates
        .map(value => value.trim())
        .filter(isValidBingQuery)

    const unique = [...new Set(valid)]
    if (unique.length > 0) return unique

    if (topic) return [topic]

    const safeTitle = (promotion.title || '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !/^(?:https?|www|com|svg|path|div)$/i.test(w))
        .slice(0, 5)
        .join(' ')
        .trim()

    return safeTitle ? [safeTitle] : []
}

// Microsoft currently supplies English instruction prefixes for this fallback path.
function extractSearchTerm(description: string): string {
    if (!description) return ''

    return description
        .trim()
        .replace(
            /^\s*(?:search(?:\s+on\s+bing|\s+bing|\s+the\s+web)?\s+for|look\s+up|find|explore|discover|suchen\s+sie\s+nach|suche\s+nach)\b[\s:]+/i,
            ''
        )
        .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
        .replace(/[.!?]+$/g, '')
        .trim()
}

interface FailedActivityEntry {
    title: string
    cardTitle?: string
    description?: string
    destinationUrl?: string
    reason: string
    queries: string[]
}

export function recordFailedSearchOnBing(
    promotion: BasePromotion,
    reason: string,
    attemptedQueries: string[] = []
): void {
    try {
        const configDir = path.join(process.cwd(), 'config')
        const filePath = fs.existsSync(configDir)
            ? path.join(configDir, 'failed.json')
            : path.join(process.cwd(), 'failed.json')
        let entries: FailedActivityEntry[] = []

        if (fs.existsSync(filePath)) {
            try {
                entries = JSON.parse(fs.readFileSync(filePath, 'utf8')) as FailedActivityEntry[]
            } catch {
                entries = []
            }
        }

        const offerId = promotion.offerId
        const existingIndex = entries.findIndex(e => e.title === offerId)

        const uniqueQueries = [...new Set(attemptedQueries.map(q => q.trim()).filter(Boolean))]
        const entry: FailedActivityEntry = {
            title: offerId,
            ...(promotion.title && promotion.title !== offerId ? { cardTitle: promotion.title } : {}),
            ...(promotion.description ? { description: promotion.description } : {}),
            ...(promotion.destinationUrl ? { destinationUrl: promotion.destinationUrl } : {}),
            reason,
            queries: uniqueQueries.length > 0 ? uniqueQueries : ['']
        }

        if (existingIndex >= 0) {
            entries[existingIndex] = entry
        } else {
            entries.push(entry)
        }

        fs.writeFileSync(filePath, JSON.stringify(entries, null, 4), 'utf8')

        if (process.env.PUID && process.env.PGID) {
            try {
                fs.chownSync(filePath, Number(process.env.PUID), Number(process.env.PGID))
                fs.chmodSync(filePath, 0o666)
            } catch {
                // Ignore if not supported on the host OS
            }
        }
    } catch {
        // Silently ignore disk write issues so bot execution is never disrupted
    }
}
