import * as fs from 'fs'
import path from 'path'

export interface ActivityQueryEntry {
    title: string
    queries: string[]
}

/**
 * Generates targeted Bing search queries via LLM for a given Rewards activity.
 * Supports localized/non-English cards and avoids repeating failed queries.
 */
export async function generateAiQueries(
    title: string,
    description: string,
    failedQueries: string[] = []
): Promise<string[]> {
    const cleanTitle = (title || '').trim()
    const cleanDesc = (description || '').trim()

    if (!cleanTitle && !cleanDesc) return []

    let prompt = `Generate 2 to 3 short Bing search queries in the task's language for the following Microsoft Rewards activity:\n`
    prompt += `Title: "${cleanTitle}"\n`
    if (cleanDesc) {
        prompt += `Description: "${cleanDesc}"\n`
    }
    if (failedQueries.length > 0) {
        prompt += `The following queries FAILED and must NOT be repeated: ${JSON.stringify(failedQueries)}\n`
    }
    prompt += `\nOutput format must be strictly a JSON array of strings (2 to 4 words each), for example:\n`
    prompt += `["query 1", "query 2"]\n`
    prompt += `Return ONLY the JSON array without any markdown formatting or extra text.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
        const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            return []
        }

        const rawText = await response.text()
        let queries: string[] = []

        // Extract JSON array via regex
        const jsonMatch = rawText.match(/\[[\s\S]*?\]/)
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0])
                if (Array.isArray(parsed)) {
                    queries = parsed.map(item => String(item).trim()).filter(Boolean)
                }
            } catch {
                // Ignore parse errors, continue to fallbacks
            }
        }

        // If regex parsing failed, attempt line-by-line fallback
        if (queries.length === 0) {
            queries = rawText
                .split('\n')
                .map(l => l.replace(/^[-*0-9.)"'\s]+|["'\s]+$/g, '').trim())
                .filter(l => l.length > 2 && l.length < 50 && !l.includes('{') && !l.includes('}'))
        }

        const failedSet = new Set(failedQueries.map(q => q.trim().toLowerCase()))
        return [...new Set(queries)].filter(q => q.length > 0 && !failedSet.has(q.toLowerCase()))
    } catch {
        clearTimeout(timeoutId)
        return []
    }
}

/**
 * Persists a verified working query to custom.json so subsequent runs
 * resolve the activity instantly and locally without external calls.
 */
export function saveSuccessfulQuery(offerId: string, title: string, query: string): void {
    try {
        const trimmedQuery = (query || '').trim()
        if (!trimmedQuery) return

        const configDir = path.join(process.cwd(), 'config')
        const targetDir = fs.existsSync(configDir) ? configDir : process.cwd()
        const customPath = path.join(targetDir, 'custom.json')

        let entries: ActivityQueryEntry[] = []

        if (fs.existsSync(customPath)) {
            try {
                entries = JSON.parse(fs.readFileSync(customPath, 'utf8')) as ActivityQueryEntry[]
            } catch {
                entries = []
            }
        } else {
            // Seed from built-in custom.json if available
            const seedCandidates = [
                path.join(__dirname, '../../custom.json'),
                path.join(process.cwd(), 'src/functions/custom.json'),
                path.join(process.cwd(), 'dist/functions/custom.json')
            ]
            for (const cand of seedCandidates) {
                if (fs.existsSync(cand)) {
                    try {
                        entries = JSON.parse(fs.readFileSync(cand, 'utf8')) as ActivityQueryEntry[]
                        break
                    } catch {
                        // Continue to next candidate
                    }
                }
            }
        }

        // Look for matching entry by offerId or title
        const cleanOfferId = (offerId || '').trim()
        const cleanTitle = (title || '').trim()

        let entry = entries.find(e => {
            const t = (e.title || '').trim()
            return (cleanOfferId && t === cleanOfferId) || (cleanTitle && t === cleanTitle)
        })

        if (!entry) {
            const entryKey = cleanOfferId || cleanTitle
            if (!entryKey) return

            entry = {
                title: entryKey,
                queries: [trimmedQuery]
            }
            entries.push(entry)
        } else {
            // Put the working query at the very front
            entry.queries = [trimmedQuery, ...entry.queries.filter(q => q.trim().toLowerCase() !== trimmedQuery.toLowerCase())]
        }

        // Write atomically
        const tmpPath = `${customPath}.${process.pid}.tmp`
        fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 4), 'utf8')
        fs.renameSync(tmpPath, customPath)

        // Enforce ownership if PUID/PGID are defined in Docker environment
        if (process.env.PUID && process.env.PGID) {
            try {
                fs.chownSync(customPath, Number(process.env.PUID), Number(process.env.PGID))
                fs.chmodSync(customPath, 0o666)
            } catch {
                // Ignore if not supported (e.g. Windows)
            }
        }
    } catch {
        // Silently ignore disk write errors to prevent interrupting bot operations
    }
}
