import { paths } from "@/api/schemas";
import { Fetcher, TypedFetch } from "openapi-typescript-fetch";
import { OpenapiPaths } from "openapi-typescript-fetch/types";
import { useQuery } from "@tanstack/react-query";

export type ResponseModel<APICall extends (...args: any) => any> = NonNullable<Awaited<ReturnType<APICall>>["data"]>;
export type RequestModel<APICall extends (...args: any) => any> = Parameters<APICall>[0];

const apiFactory = <T extends OpenapiPaths<T>>(baseUrl: string) => {
    const apiCentral = Fetcher.for<T>();
    apiCentral.configure({
        baseUrl: baseUrl,
    });

    return apiCentral;
};

const generateQueryHookFactory = <T extends ReturnType<typeof apiFactory>>(api: T) => {
    const generateQueryHook = <T>(
        queryKey: string,
        apiCallFactory: { create: () => TypedFetch<T>; },
        refetchOnWindowFocus?: boolean
    ) => {
        const apiCall = apiCallFactory.create();

        type apiCallParameters = Parameters<typeof apiCall>;
        type apiCallArgParameter = apiCallParameters[0];
        type apiCallInitParameter = apiCallParameters[1];

        type useQueryAPIParameters = [
            arg: apiCallArgParameter,
            init?: apiCallInitParameter,
            config?: {
                excludeQueryKey?: (keyof apiCallArgParameter)[] | undefined;
                doNotCallAPI?: boolean;
            }
        ];

        const useQueryAPI = (...args: useQueryAPIParameters) => {
            const [arg, init, config] = args;

            const _arg = Object.assign({}, arg);
            for (const key of config?.excludeQueryKey ?? []) {
                delete _arg[key];
            }

            const _queryKey = [queryKey, _arg];
            return useQuery({
                queryKey: _queryKey,
                queryFn: async () => {
                    if (config?.doNotCallAPI) {
                        throw new Error("doNotCallAPI is true");
                    } else {
                        const res = await apiCall(arg, init);
                        return res.data;
                    }
                },
                refetchOnWindowFocus
            });
        };

        useQueryAPI.apiCall = apiCall;
        useQueryAPI.queryKey = queryKey;
        useQueryAPI.Error = apiCall.Error;

        return useQueryAPI;
    };

    generateQueryHook.api = api;
    return generateQueryHook;
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/fallback-api-error";
const api = apiFactory<paths>(API_URL);
export const generateQueryHook = generateQueryHookFactory(api);