import { randomBytes } from 'crypto'
import type { Page } from 'patchright'

import { URLs } from '../../../constants/urls'
import type { MicrosoftRewardsBot } from '../../../index'

const STATIC_SEED_URL = 'https://th.bing.com/th?id=OMR.VisualSearch.VNext.BackgroundImage.png&pid=Rewards'
const ARCHIVE_SIZE = 8

export interface VisualSearchCandidate {
    bcid: string
    query: string
    serpUrl: string
}

export interface VisualSearchReport {
    acknowledged: boolean
    ig: string | null
    balance: number | null
    previousBalance: number | null
    gained: number | null
    searchPointsEarned: number | null
    searchPointsLimit: number | null
}

interface ParsedReport {
    balance: number | null
    previousBalance: number | null
    searchPointsEarned: number | null
    searchPointsLimit: number | null
}

export class VisualSearchBrowser {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    public async report(candidate: VisualSearchCandidate): Promise<VisualSearchReport> {
        const sourcePage = this.bot.mainDesktopPage
        if (!sourcePage || sourcePage.isClosed()) {
            this.bot.logger.warn(
                this.bot.isMobile,
                'VISUAL-SEARCH-REPORT',
                'Desktop page is unavailable - cannot run the visual-search browser flow'
            )
            return this.emptyReport()
        }

        let visualPage: Page | null = null
        try {
            visualPage = await sourcePage.context().newPage()
            const responsePromise = visualPage
                .waitForResponse(
                    response => {
                        if (response.request().method() !== 'POST') return false
                        try {
                            const url = new URL(response.url())
                            const isReport =
                                url.origin === URLs.bing.origin &&
                                url.pathname.toLowerCase().includes('/rewardsapp/reportactivity')
                            if (!isReport) return false
                            const bcid = url.searchParams.get('bcid')
                            return (
                                !bcid ||
                                bcid === candidate.bcid ||
                                candidate.bcid.startsWith(bcid) ||
                                bcid.startsWith(candidate.bcid)
                            )
                        } catch {
                            return false
                        }
                    },
                    { timeout: 25000 }
                )
                .catch(() => null)

            await visualPage.goto(candidate.serpUrl, { waitUntil: 'load', timeout: 25000 }).catch(async () => {
                await visualPage?.goto(candidate.serpUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
            })

            const response = await responsePromise

            // Wait for visual search content elements to appear
            await visualPage
                .waitForSelector('#vs_results, .vs_content, .iusc, #b_results, .b_algo', { timeout: 6000 })
                .catch(() => {})

            // Simulate realistic scrolling on the result page
            await visualPage
                .evaluate(() => {
                    window.scrollBy({ top: 350 + Math.floor(Math.random() * 200), behavior: 'smooth' })
                })
                .catch(() => {})
            await this.bot.utils.wait(this.bot.utils.randomDelay(2000, 3500))

            // Hover on first visual result
            const firstResult = await visualPage.$('.vs_content a, #vs_results a, .iusc, .b_algo a').catch(() => null)
            if (firstResult) {
                await firstResult.hover().catch(() => {})
                await this.bot.utils.wait(this.bot.utils.randomDelay(1000, 2000))
            }

            // Scroll slightly more
            await visualPage
                .evaluate(() => {
                    window.scrollBy({ top: 250 + Math.floor(Math.random() * 200), behavior: 'smooth' })
                })
                .catch(() => {})
            await this.bot.utils.wait(this.bot.utils.randomDelay(2500, 4000))

            if (!response) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'VISUAL-SEARCH-REPORT',
                    `Bing did not issue reportActivity for "${candidate.query}" | bcid=${candidate.bcid.slice(0, 12)}`
                )
                return this.emptyReport()
            }

            const ig = new URL(response.url()).searchParams.get('IG')
            const acknowledged = response.ok()
            const parsed = this.parseReport(await response.text())
            const gained =
                parsed.balance !== null && parsed.previousBalance !== null
                    ? parsed.balance - parsed.previousBalance
                    : null

            this.bot.logger.debug(
                this.bot.isMobile,
                'VISUAL-SEARCH-REPORT',
                `Browser reported "${candidate.query}" | status=${response.status()}` +
                    ` | acknowledged=${acknowledged} | ig=${ig ?? 'n/a'} | bcid=${candidate.bcid.slice(0, 12)}` +
                    ` | pointsGained=${gained ?? 'n/a'} | currentBalance=${parsed.balance ?? 'n/a'}` +
                    ` | searchPts=${parsed.searchPointsEarned ?? 'n/a'}/${parsed.searchPointsLimit ?? 'n/a'}`
            )

            return { acknowledged, ig, ...parsed, gained }
        } catch (error) {
            this.bot.logger.warn(
                this.bot.isMobile,
                'VISUAL-SEARCH-REPORT',
                `Browser flow failed for "${candidate.query}" | ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
            return this.emptyReport()
        } finally {
            await visualPage?.close().catch(() => {})
        }
    }

    public async acquire(imageUrl?: string): Promise<VisualSearchCandidate | null> {
        try {
            const page = this.bot.mainDesktopPage
            if (!page || page.isClosed()) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'VISUAL-SEARCH-BCID',
                    'Desktop page is unavailable - cannot acquire a visual search'
                )
                return null
            }

            const seed = imageUrl ?? (await this.getSeedUrls())[0] ?? STATIC_SEED_URL
            const cookies = await page.context().cookies(URLs.bing.origin).catch(() => [])
            const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

            const headers: Record<string, string> = {
                ...(this.bot.fingerprint?.headers ?? {}),
                Accept: 'application/json',
                'Content-Type': `multipart/form-data; boundary=----WebKitFormBoundary`,
                Referer: `${URLs.bing.origin}/`,
                Origin: URLs.bing.origin,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                ...(cookieHeader ? { Cookie: cookieHeader } : {})
            }
            delete headers['cookie']

            const encodedSeed = encodeURIComponent(seed)
            const url =
                `${URLs.bing.origin}/images/kblob` +
                `?iss=sbi&form=SBIHMP&sbisrc=UrlPaste&vsimg=${encodedSeed}&imgurl=${encodedSeed}`
            const boundary = `----WebKitFormBoundary${randomBytes(8).toString('hex')}`
            headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`

            const response = await page.request.post(url, {
                headers,
                data: this.buildMultipart(boundary),
                timeout: 20000
            })

            const responseData = await response.text()
            const redirectUrl = this.parseRedirect(responseData)
            if (!redirectUrl) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'VISUAL-SEARCH-BCID',
                    `kblob returned no redirectUrl | status=${response.status()} - endpoint shape may have changed`
                )
                this.bot.logger.debug(
                    this.bot.isMobile,
                    'VISUAL-SEARCH-BCID',
                    `kblob response: ${responseData.slice(0, 400)}`
                )
                return null
            }

            const redirect = new URL(redirectUrl, URLs.bing.origin)
            const bcid = redirect.searchParams.get('bcid')
            if (!bcid) {
                this.bot.logger.warn(this.bot.isMobile, 'VISUAL-SEARCH-BCID', `Redirect had no bcid | ${redirectUrl}`)
                return null
            }

            const query = redirect.searchParams.get('q') ?? ''
            this.bot.logger.info(
                this.bot.isMobile,
                'VISUAL-SEARCH-BCID',
                `Acquired bcid=${bcid.slice(0, 14)} | q="${query}" | status=${response.status()}` +
                    ` | seed=${seed.slice(0, 80)}`,
                'green'
            )
            return { bcid, query, serpUrl: redirect.toString() }
        } catch (error) {
            this.bot.logger.warn(
                this.bot.isMobile,
                'VISUAL-SEARCH-BCID',
                `Failed to acquire visual search | ${error instanceof Error ? error.message : String(error)}`
            )
            return null
        }
    }

    public async getSeedUrls(): Promise<string[]> {
        const page = this.bot.mainDesktopPage
        const flickrSeeds: string[] = []

        // 1. Try Flickr public feed (real high-quality user photos, avoiding flagged Bing wallpapers)
        try {
            const flickrUrl =
                'https://www.flickr.com/services/feeds/photos_public.gne?tags=nature,landscape,travel,city&tagmode=any&format=json&nojsoncallback=1'
            interface FlickrFeed {
                items?: { media?: { m?: string } }[]
            }
            let flickrJson: FlickrFeed | null = null

            if (page && !page.isClosed()) {
                const response = await page.request.get(flickrUrl, { timeout: 10000 })
                if (response.ok()) {
                    flickrJson = (await response.json()) as FlickrFeed
                }
            }
            if (!flickrJson) {
                const res = await fetch(flickrUrl, { signal: AbortSignal.timeout(10000) })
                if (res.ok) {
                    flickrJson = (await res.json()) as FlickrFeed
                }
            }

            const items = flickrJson?.items
            if (Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                    const m = item.media?.m
                    if (typeof m === 'string' && m.startsWith('http')) {
                        // Use larger size _b.jpg (1024px) for better visual search feature detection
                        flickrSeeds.push(m.replace('_m.jpg', '_b.jpg'))
                    }
                }
            }
        } catch (error) {
            this.bot.logger.debug(
                this.bot.isMobile,
                'VISUAL-SEARCH-BCID',
                `Flickr feed lookup failed | ${error instanceof Error ? error.message : String(error)}`
            )
        }

        if (flickrSeeds.length > 0) {
            this.bot.utils.shuffleArray(flickrSeeds)
            this.bot.logger.info(
                this.bot.isMobile,
                'VISUAL-SEARCH-BCID',
                `Prepared ${flickrSeeds.length} external photo seed(s) from Flickr feed`,
                'blue'
            )
            return flickrSeeds
        }

        // 2. Fallback to Bing HPImageArchive
        if (!page || page.isClosed()) {
            this.bot.logger.warn(
                this.bot.isMobile,
                'VISUAL-SEARCH-BCID',
                'Desktop page is unavailable - using the static visual-search seed'
            )
            return [STATIC_SEED_URL]
        }

        try {
            const response = await page.request.get(
                `${URLs.bing.origin}/HPImageArchive.aspx?format=js&idx=0&n=${ARCHIVE_SIZE}` +
                    `&mkt=${encodeURIComponent(this.bot.accountLocale.locale)}`,
                { timeout: 10000 }
            )
            if (response.ok()) {
                const payload = (await response.json()) as { images?: { url?: unknown }[] }
                const seeds = (payload.images ?? []).flatMap(image => {
                    if (typeof image.url !== 'string' || !image.url) return []
                    try {
                        return [new URL(image.url, URLs.bing.origin).toString()]
                    } catch {
                        return []
                    }
                })
                const uniqueSeeds = [...new Set(seeds)]
                if (uniqueSeeds.length) {
                    this.bot.utils.shuffleArray(uniqueSeeds)
                    this.bot.logger.debug(
                        this.bot.isMobile,
                        'VISUAL-SEARCH-BCID',
                        `Prepared ${uniqueSeeds.length} randomized Bing wallpaper seed(s)`
                    )
                    return uniqueSeeds
                }
            }

            this.bot.logger.debug(
                this.bot.isMobile,
                'VISUAL-SEARCH-BCID',
                `HPImageArchive returned no usable urls | status=${response.status()} - using the static seed`
            )
        } catch (error) {
            this.bot.logger.debug(
                this.bot.isMobile,
                'VISUAL-SEARCH-BCID',
                `HPImageArchive lookup failed | ${error instanceof Error ? error.message : String(error)}` +
                    ' - using the static seed'
            )
        }

        return [STATIC_SEED_URL]
    }

    private buildMultipart(boundary: string): Buffer {
        const fields = [
            { name: 'cbir', value: 'sbi' },
            { name: 'imageBin', value: '' },
            { name: 'imgurl', value: '' }
        ]
        const parts = fields.map(field =>
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
                'utf8'
            )
        )
        parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'))
        return Buffer.concat(parts)
    }

    private parseRedirect(data: unknown): string | null {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data
            const url = (parsed as { redirectUrl?: unknown })?.redirectUrl
            if (typeof url === 'string' && url.includes('bcid=')) return url
        } catch {}

        if (typeof data !== 'string') return null
        const raw = data.match(/"redirectUrl"\s*:\s*"([^"]+)"/)?.[1]
        return raw?.includes('bcid=') ? raw.replace(/\\u002f/gi, '/').replace(/\\\//g, '/') : null
    }

    private parseReport(data: unknown): ParsedReport {
        if (typeof data !== 'string') return this.emptyParsedReport()

        let rawObj: Record<string, unknown> | null = null

        const match = data.match(/ModernRewards\.ReportActivity\((\{[\s\S]*?\})\)\s*;/)
        if (match && match[1]) {
            try {
                rawObj = JSON.parse(match[1]) as Record<string, unknown>
            } catch {}
        }

        if (!rawObj) {
            try {
                rawObj = JSON.parse(data) as Record<string, unknown>
            } catch {}
        }

        if (!rawObj) return this.emptyParsedReport()

        try {
            const session = (rawObj.RewardsSessionData ?? rawObj.rewardsSessionData ?? rawObj) as Record<string, unknown>
            const numberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null)
            return {
                balance: numberOrNull(session.Balance ?? session.balance ?? session.CurrentPoints ?? session.currentPoints),
                previousBalance: numberOrNull(session.PreviousBalance ?? session.previousBalance),
                searchPointsEarned: numberOrNull(session.DailySearchPointsEarned ?? session.dailySearchPointsEarned),
                searchPointsLimit: numberOrNull(session.DailySearchPointsLimit ?? session.dailySearchPointsLimit)
            }
        } catch {
            return this.emptyParsedReport()
        }
    }

    private emptyReport(): VisualSearchReport {
        return {
            acknowledged: false,
            ig: null,
            ...this.emptyParsedReport(),
            gained: null
        }
    }

    private emptyParsedReport(): ParsedReport {
        return {
            balance: null,
            previousBalance: null,
            searchPointsEarned: null,
            searchPointsLimit: null
        }
    }
}
