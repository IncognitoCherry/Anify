import { wait } from "@/src/helper";
import MangaProvider, { Chapter, Page } from ".";
import { Format, Formats, Result } from "../..";

export default class MangaDex extends MangaProvider {
    override rateLimit = 250;
    override id = "mangadex";
    override url = "https://mangadex.org";

    override formats: Format[] = [Format.MANGA, Format.ONE_SHOT];

    private api = "https://api.mangadex.org";

    override async search(query: string, format?: Format, year?: number): Promise<Result[] | undefined> {
        const results: Result[] = [];

        let mangaList: any[] = [];

        for (let page = 0; page <= 1; page += 1) {
            const uri = new URL("/manga", this.api);
            uri.searchParams.set("title", query);
            uri.searchParams.set("limit", "25");
            uri.searchParams.set("offset", String(25 * page).toString());
            uri.searchParams.set("order[relevance]", "desc");
            uri.searchParams.append("contentRating[]", "safe");
            uri.searchParams.append("contentRating[]", "suggestive");
            uri.searchParams.append("contentRating[]", "erotica");
            uri.searchParams.append("contentRating[]", "pornographic");
            uri.searchParams.append("includes[]", "cover_art");

            const data = await (await this.request(uri.href)).json();
            // API rate limit
            await wait(250);

            mangaList = [...mangaList, ...data.data];
        }

        for (let i = 0; i < mangaList.length; i++) {
            const manga = mangaList[i];
            const attributes = manga.attributes;
            const relationships = manga.relationships;

            const title = attributes.title["en"] ?? attributes.title["ja"] ?? attributes.title["ja-ro"] ?? attributes.title["ko"];

            const altTitles: string[] = [];

            attributes.altTitles.map((element, index) => {
                const temp = element;
                if (temp["ja-ro"] != undefined) {
                    altTitles.push(temp["ja-ro"]);
                }
                if (temp["ja"] != undefined) {
                    altTitles.push(temp["ja"]);
                }
                if (temp["ko"] != undefined) {
                    altTitles.push(temp["ko"]);
                }
                if (temp["en"] != undefined) {
                    altTitles.push(temp["en"]);
                }
            });

            const id = manga.id;
            let img = "";
            relationships.map((element) => {
                if (element.type === "cover_art") {
                    img = `${this.url}/covers/${id}/${element.id}.jpg.512.jpg`;
                }
            });

            const formatString: string = manga.type.toUpperCase();
            const format: Format = Formats.includes(formatString as Format) ? (formatString as Format) : Format.UNKNOWN;

            results.push({
                id,
                title: title,
                altTitles: altTitles,
                img: img,
                format,
                year: attributes.year,
                providerId: this.id,
            });
        }
        return results;
    }

    override async fetchChapters(id: string): Promise<Chapter[] | undefined> {
        const chapterList: Chapter[] = [];

        for (let page = 0, run = true; run; page++) {
            const request = await this.request(`${this.api}/manga/${id}/feed?limit=500&translatedLanguage%5B%5D=en&includes[]=scanlation_group&includes[]=user&order[volume]=desc&order[chapter]=desc&offset=${500 * page}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`).catch((err) => {
                return null;
            });
            if (!request) {
                run = false;
                break;
            }

            await wait(250);

            const data = await request.json();

            if (!data || !data.result) {
                run = false;
                break;
            }

            if (data.result === "error") {
                const error = data.errors[0];
                throw new Error(error.detail);
            }

            const chapters: Chapter[] = [];
            Object.keys(data.data).map((chapter) => {
                const curChapter = data.data[chapter];
                const id = curChapter.id;
                let title = "";

                if (curChapter.attributes.volume) {
                    title += "Vol. " + this.padNum(curChapter.attributes.volume, 2) + " ";
                }
                if (curChapter.attributes.chapter) {
                    title += "Ch. " + this.padNum(curChapter.attributes.chapter, 2) + " ";
                }

                let canPush = true;
                for (let i = 0; i < chapters.length; i++) {
                    if (chapters[i].title === title) {
                        canPush = false;
                    }
                }

                if (canPush) {
                    chapters.push({
                        id,
                        title,
                        number: curChapter.attributes.chapter,
                        updatedAt: new Date(curChapter.attributes.updatedAt ?? 0).getTime(),
                    });
                }
            });

            chapters.length > 0 ? chapterList.push(...chapters) : (run = false);
        }

        return chapterList;
    }

    override async fetchPages(id: string): Promise<Page[] | string | undefined> {
        const req = await this.request(`${this.api}/at-home/server/${id}`).catch((err) => {
            return null;
        });

        if (!req) {
            return [];
        }

        await wait(250);

        const data = await req.json();

        const baseUrl = data.baseUrl;
        const hash = data.chapter.hash;

        const pages: Page[] = [];
        for (let i = 0; i < data.chapter.data.length; i++) {
            const url = `${baseUrl}/data/${hash}/${data.chapter.data[i]}`;
            pages.push({
                url: url,
                index: i,
                headers: {
                    Referer: this.url,
                },
            });
        }
        return pages;
    }

    private padNum(number, places): string {
        // Credit to https://stackoverflow.com/a/10073788
        /*
         * '17'
         * '17.5'
         * '17-17.5'
         * '17 - 17.5'
         * '17-123456789'
         */
        let range = number.split("-");
        range = range.map((chapter) => {
            chapter = chapter.trim();
            const digits = chapter.split(".")[0].length;
            return "0".repeat(Math.max(0, places - digits)) + chapter;
        });
        return range.join("-");
    }
}
