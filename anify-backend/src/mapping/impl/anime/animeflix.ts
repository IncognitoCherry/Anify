import AnimeProvider, { Episode, Source, StreamingServers, SubType } from ".";
import { Format, Result } from "../..";
import Extractor from "@/src/helper/extractor";

export default class AnimeFlix extends AnimeProvider {
    override rateLimit = 250;
    override id = "animeflix";
    override url = "https://animeflix.live";

    private api = "https://api.animeflix.live";
    private userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.5790.171 Safari/537.36";

    override formats: Format[] = [Format.MOVIE, Format.ONA, Format.OVA, Format.SPECIAL, Format.TV, Format.TV_SHORT];

    override get subTypes(): SubType[] {
        return [SubType.SUB, SubType.DUB];
    }

    override get headers(): Record<string, string> | undefined {
        return {
            Referer: this.api,
        };
    }

    override async search(query: string, format?: Format, year?: number): Promise<Result[] | undefined> {
        const request = await this.request(`${this.api}/info?query=${encodeURIComponent(query)}&limit=20`, {
            headers: {
                "User-Agent": this.userAgent,
            },
        });
        if (!request.ok) {
            return [];
        }
        const data = await request.json();
        const results: Result[] = data.map((res) => ({
            id: res.slug,
            title: res.title.userPreferred || res.title.english || res.title.romaji || res.title.native,
            altTitles: [res.title.english, res.title.romaji, res.title.native, res.title.userPreferred].filter(Boolean),
            format: res.type,
            img: res.images.large || res.images.medium || res.images.small,
            providerId: this.id,
            year: res.startDate?.year || 0,
        }));

        return results;
    }

    override async fetchEpisodes(id: string): Promise<Episode[] | undefined> {
        const queryParams = new URLSearchParams({
            id,
            dub: "false",
        });

        const [dataResponse, dubResponse] = await Promise.all([
            this.request(`${this.api}/episodes?${queryParams}&dub=false`, {
                headers: {
                    "User-Agent": this.userAgent,
                },
            }),
            this.request(`${this.api}/episodes?${queryParams}&dub=true`, {
                headers: {
                    "User-Agent": this.userAgent,
                },
            }),
        ]);

        if (!dataResponse.ok || !dubResponse.ok) {
            return [];
        }

        const [data, dubData] = await Promise.all([dataResponse.json(), dubResponse.json()]);

        const dubNumbers = new Set((dubData?.episodes ?? []).map((dub) => dub.number));

        const results: Episode[] = data.episodes.map((res) => ({
            id: `/watch/${id}-episode-${res.number}?server=`,
            img: res.image ?? null,
            isFiller: false,
            number: res.number,
            title: res.title ?? "Episode " + res.number,
            hasDub: res.dub ?? dubNumbers.has(res.number),
        }));

        return results;
    }

    override async fetchSources(id: string, subType: SubType | undefined, server: StreamingServers = StreamingServers.AnimeFlix): Promise<Source | undefined> {
        const splitId = id.split("-episode-");
        const episodeNumber = splitId[1].split("?")[0];
        const watchId = splitId[0].split("/watch/")[1];

        if (subType === SubType.DUB) {
            id = `/watch/${watchId}-dub-episode-${episodeNumber}?server=`;
        }

        const headers = {
            "User-Agent": this.userAgent,
        };

        const response = await fetch(`${this.api}${id}`, { headers });
        const data = await response.json();

        const result: Source = {
            sources: [],
            subtitles: [],
            intro: {
                start: 0,
                end: 0,
            },
            outro: {
                start: 0,
                end: 0,
            },
            headers: this.headers ?? {},
        };

        if (!data.source) return result;

        return await new Extractor(data.source, result).extract(server);
    }
}
