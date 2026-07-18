import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { LoginPage } from "./login-page";

const API = "http://localhost/api/v1";

function renderLoginPage(returnTo = "/") {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage returnTo={returnTo} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

beforeEach(() => {
  window.localStorage.clear();
  sessionManager.__resetForTests();
});

describe("LoginPage", () => {
  it("establishes a session on success", async () => {
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        // Decision 3: must send app: "admin", never "dashboard".
        expect(body.app).toBe("admin");
        return HttpResponse.json({
          success: true,
          token: "tok",
          user: {
            id: 1,
            name: "Ahmed Errouissi",
            email: "ahmed@example.com",
            roles: ["admin"],
            permissions: [],
          },
        });
      }),
    );

    renderLoginPage();
    await fillAndSubmit("ahmed@example.com", "correct-password");

    await waitFor(() => {
      expect(sessionManager.getSnapshot()?.token).toBe("tok");
    });
  });

  it("shows an error and creates no session on bad credentials", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { success: false, message: "Invalid credentials" },
          { status: 401 },
        ),
      ),
    );

    renderLoginPage();
    await fillAndSubmit("ahmed@example.com", "wrong-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid email or password/i,
    );
    expect(sessionManager.getSnapshot()).toBeNull();
  });

  it("shows the blocked-account message and creates no session on 403", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { success: false, message: "Your account has been blocked" },
          { status: 403 },
        ),
      ),
    );

    renderLoginPage();
    await fillAndSubmit("ahmed@example.com", "correct-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(/blocked/i);
    expect(sessionManager.getSnapshot()).toBeNull();
  });

  it("redirects immediately when a session already exists", () => {
    sessionManager.start({
      token: "tok",
      user: {
        id: 1,
        name: "Ahmed Errouissi",
        email: "ahmed@example.com",
        roles: ["admin"],
        permissions: [],
      },
    });

    renderLoginPage();

    // No form rendered — the guard redirects before it. See app/router/routes.tsx
    // for the wrapper that supplies `returnTo`; here it's asserted at the unit
    // level via absence of the form, not via router state.
    expect(screen.queryByRole("heading", { name: /sign in/i })).not.toBeInTheDocument();
  });
});
