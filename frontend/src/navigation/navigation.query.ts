import { generateQueryHook } from "@/api/api";

export const useNavigationQuery = generateQueryHook(
    "navigationQuery",
    generateQueryHook.api.path("/api/navigation/query").method("post")
);

export const useNavigationDirections = generateQueryHook(
    "navigationDirections",
    generateQueryHook.api.path("/api/navigation/directions").method("get")
);

export const useNavigationPlaces = generateQueryHook(
    "navigationPlaces",
    generateQueryHook.api.path("/api/navigation/places").method("get")
);

export const useNavigationGeocode = generateQueryHook(
    "navigationGeocode",
    generateQueryHook.api.path("/api/navigation/geocode").method("get")
);

export const useNavigationTraffic = generateQueryHook(
    "navigationTraffic",
    generateQueryHook.api.path("/api/navigation/traffic").method("get")
);

export const useNavigationWakeWord = generateQueryHook(
    "navigationWakeWord",
    generateQueryHook.api.path("/api/wake/detect").method("post")
);