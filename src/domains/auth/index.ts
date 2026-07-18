export { LoginPage } from "./pages/login-page";
export { useLogoutMutation } from "./queries/mutations";

// api/, components/, and the login mutation stay internal — the router assembler
// only needs the page; the shell only needs the logout mutation (FTA §4, the
// front-door rule).
