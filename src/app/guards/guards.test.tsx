import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { sessionManager } from "@/infrastructure/auth";
import { RequireAuth } from "./require-auth";
import { RequirePermission } from "./require-permission";

const session = {
  token: "tok",
  user: {
    id: 1,
    name: "A",
    email: "a@x.com",
    roles: ["admin"],
    permissions: ["villes.view"],
  },
};

beforeEach(() => {
  window.localStorage.clear();
  sessionManager.__resetForTests();
});

describe("RequireAuth", () => {
  it("renders the fallback with no session", () => {
    render(
      <RequireAuth fallback={<p>login</p>}>
        <p>protected</p>
      </RequireAuth>,
    );
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("renders children once a session exists, without a Provider", () => {
    // Decision 2 in action: the guard reads the external store directly. There is no
    // SessionProvider anywhere in this tree — and that is the point.
    render(
      <RequireAuth fallback={<p>login</p>}>
        <p>protected</p>
      </RequireAuth>,
    );

    act(() => sessionManager.start(session));

    expect(screen.getByText("protected")).toBeInTheDocument();
  });
});

describe("RequirePermission", () => {
  beforeEach(() => {
    act(() => sessionManager.start(session));
  });

  it("renders children when the permission is held", () => {
    render(
      <RequirePermission permission="villes.view">
        <button>Create</button>
      </RequirePermission>,
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("renders NOTHING when the permission is absent", () => {
    // Absent-by-permission means absent, not disabled: "you lack the permission" is
    // not an explanation an operator can act on (Design System §10).
    render(
      <RequirePermission permission="villes.delete">
        <button>Delete</button>
      </RequirePermission>,
    );
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("re-renders when the session is terminated", () => {
    render(
      <RequirePermission permission="villes.view">
        <button>Create</button>
      </RequirePermission>,
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();

    act(() => sessionManager.terminate());

    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
  });
});
