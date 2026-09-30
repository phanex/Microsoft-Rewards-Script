import * as fs from 'fs'
import path from 'path'

export interface ActivityQueryEntry {
    title: string
    queries: string[]
}

export interface AiModelOptions {
    aiBaseUrl?: string
    aiApiKey?: string
    aiModel?: string
    logger?: {
        warn: (msg: string) => void
        error: (msg: string) => void
        debug: (msg: string) => void
    }
}

/**
 * Generates targeted Bing search queries via LLM for a given Rewards activity.
 * Supports localized/non-English cards and avoids repeating failed queries.
 * Supports self-hosted Ollama/OpenAI-compatible endpoints or zero-config fallback.
 */
export async function generateAiQueries(
    title: string,
    description: string,
    failedQueries: string[] = [],
    options?: AiModelOptions
): Promise<string[]> {
    const cleanTitle = (title || '').trim()
    const cleanDesc = (description || '').trim()

    if (!cleanTitle && !cleanDesc) return []

    // Check for optional custom prompt template file
    const customPromptPath = [
        path.join(process.cwd(), 'config', 'ai-prompt.txt'),
        path.join(process.cwd(), 'ai-prompt.txt')
    ].find(p => fs.existsSync(p))

    let prompt = ''
    if (customPromptPath) {
        try {
            const template = fs.readFileSync(customPromptPath, 'utf8')
            prompt = template
                .replace(/\{\{title\}\}/g, cleanTitle)
                .replace(/\{\{description\}\}/g, cleanDesc)
                .replace(/\{\{failedQueries\}\}/g, JSON.stringify(failedQueries))
        } catch {}
    }

    if (!prompt) {
        prompt = `Generate 2 to 3 natural Bing search queries in the language of the task for this Microsoft Rewards activity:\n`
        prompt += `Title: "${cleanTitle}"\n`
        if (cleanDesc) {
            prompt += `Description: "${cleanDesc}"\n`
        }
        prompt += `\nGuidelines:\n`
        prompt += `- Do NOT simply rephrase or repeat the card title or description.\n`
        prompt += `- Produce realistic, concrete searches that a real human would type. If the task is about travel, food, recipes, flights, shopping, events, or outdoor activities, generate specific real-world entities, locations, destinations, or dish names (e.g. for flights -> "flights London to Rome", for recipes -> "authentic pasta carbonara recipe", for hiking -> "Bavarian Alps hiking trails", for shopping -> "wireless noise cancelling headphones").\n`
        if (failedQueries.length > 0) {
            prompt += `- The following queries already FAILED and must NOT be repeated: ${JSON.stringify(failedQueries)}\n`
        }
        prompt += `\nOutput format must be strictly a JSON array of strings (2 to 5 words each), for example:\n`
        prompt += `["query 1", "query 2"]\n`
        prompt += `Return ONLY the JSON array without any markdown formatting or extra text.`
    }

    const timeoutMs = options?.aiBaseUrl ? 60000 : 20000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        let rawText = ''
        const baseUrl = options?.aiBaseUrl?.trim()

        if (baseUrl) {
            let endpoint = baseUrl.replace(/\/+$/, '')
            if (!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`
            }
            const model = options?.aiModel?.trim() || 'llama3'
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/phanex/Microsoft-Rewards-Script',
                'X-Title': 'Microsoft Rewards Script'
            }
            if (options?.aiApiKey?.trim()) {
                headers['Authorization'] = `Bearer ${options.aiApiKey.trim()}`
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a concise assistant that generates Bing search queries in JSON format.'
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.5
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)
            if (!response.ok) {
                const errText = await response.text().catch(() => '')
                options?.logger?.warn(`AI API returned error ${response.status}: ${errText.slice(0, 200)}`)
                return []
            }
            const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
            rawText = data?.choices?.[0]?.message?.content ?? ''
        } else {
            const model = options?.aiModel?.trim() || 'openai'
            const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}`
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: controller.signal
            })

            clearTimeout(timeoutId)
            if (!response.ok) {
                const errText = await response.text().catch(() => '')
                options?.logger?.warn(`AI API returned error ${response.status}: ${errText.slice(0, 200)}`)
                return []
            }
            rawText = await response.text()
        }
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
    } catch (error) {
        clearTimeout(timeoutId)
        if (controller.signal.aborted) {
            options?.logger?.warn(`AI request timed out after ${timeoutMs / 1000}s`)
        } else {
            options?.logger?.warn(`AI request failed: ${error instanceof Error ? error.message : String(error)}`)
        }
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
