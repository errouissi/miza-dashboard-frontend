export { httpClient } from "./http-client";
export { REQUEST_ID_HEADER } from "./correlation";

// `interceptors` and the correlation internals are not exported: the pipeline is
// an implementation detail of the client, not a surface anyone composes with.
