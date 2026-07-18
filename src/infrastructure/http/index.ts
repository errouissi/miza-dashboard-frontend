export { httpClient } from "./http-client";
export { REQUEST_ID_HEADER } from "./correlation";
export { fromLaravelPage } from "./paginated";
export type { LaravelPageEnvelope, Paginated } from "./paginated";

// `interceptors` and the correlation internals are not exported: the pipeline is
// an implementation detail of the client, not a surface anyone composes with.
