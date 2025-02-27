import { Format, ProviderType, Result } from "../..";
import Http from "../request";

export default abstract class MetaProvider {
    abstract rateLimit: number;
    abstract id: string;
    abstract url: string;
    abstract formats: Format[];

    public providerType: ProviderType = ProviderType.META;
    public customProxy: string | undefined;

    async search(query: string, format?: Format, year?: number): Promise<Result[] | undefined> {
        return undefined;
    }

    async request(url: string, config: RequestInit = {}, proxyRequest = false): Promise<Response> {
        return Http.request(url, config, proxyRequest, 0, this.customProxy);
    }
}
