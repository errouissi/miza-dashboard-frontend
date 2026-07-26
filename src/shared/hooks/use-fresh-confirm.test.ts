import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFreshConfirm, type FreshConfirmQuery } from "./use-fresh-confirm";

type Fixture = { id: number; status: string };

function makeQuery(
  data: Fixture | undefined,
  refetch: () => Promise<{ data: Fixture | undefined; isError: boolean }>,
): FreshConfirmQuery<Fixture> {
  return { data, isError: false, refetch };
}

/** Never resolves — used to inspect the "checking" phase before settlement. */
function pendingRefetch() {
  return new Promise<{ data: Fixture | undefined; isError: boolean }>(() => {});
}

describe("closed", () => {
  it("is idle — not checking, not stale, not unavailable, not blocked", () => {
    const query = makeQuery({ id: 1, status: "pending" }, pendingRefetch);
    const { result } = renderHook(() =>
      useFreshConfirm({
        open: false,
        current: { id: 1, status: "pending" },
        query,
        hasChanged: (fresh, snap) => fresh.status !== snap.status,
      }),
    );

    expect(result.current).toMatchObject({
      isChecking: false,
      isStale: false,
      isUnavailable: false,
      blocked: false,
    });
  });
});

describe("opening", () => {
  it("enters checking immediately, before the refetch settles, and blocks", () => {
    const query = makeQuery({ id: 1, status: "pending" }, pendingRefetch);
    const { result } = renderHook(() =>
      useFreshConfirm({
        open: true,
        current: { id: 1, status: "pending" },
        query,
        hasChanged: (fresh, snap) => fresh.status !== snap.status,
      }),
    );

    expect(result.current.isChecking).toBe(true);
    expect(result.current.blocked).toBe(true);
  });

  it("calls refetch exactly once per open", () => {
    const refetch = vi.fn(pendingRefetch);
    const query = makeQuery({ id: 1, status: "pending" }, refetch);
    renderHook(() =>
      useFreshConfirm({
        open: true,
        current: { id: 1, status: "pending" },
        query,
        hasChanged: () => false,
      }),
    );

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("settlement — unchanged", () => {
  it("resolves to fresh (unblocked) when the refetched value matches the snapshot", async () => {
    const refetch = vi
      .fn()
      .mockResolvedValue({ data: { id: 1, status: "pending" }, isError: false });
    const query = makeQuery({ id: 1, status: "pending" }, refetch);
    const { result } = renderHook(() =>
      useFreshConfirm({
        open: true,
        current: { id: 1, status: "pending" },
        query,
        hasChanged: (fresh, snap) => fresh.status !== snap.status,
      }),
    );

    await waitFor(() => expect(result.current.isChecking).toBe(false));

    expect(result.current).toMatchObject({
      isChecking: false,
      isStale: false,
      isUnavailable: false,
      blocked: false,
    });
  });
});

describe("settlement — changed underneath the operator", () => {
  it("resolves to stale (blocked) when the refetched value differs from the snapshot", async () => {
    const refetch = vi
      .fn()
      .mockResolvedValue({ data: { id: 1, status: "rejected" }, isError: false });
    const query = makeQuery({ id: 1, status: "pending" }, refetch);
    const { result } = renderHook(() =>
      useFreshConfirm({
        open: true,
        current: { id: 1, status: "pending" },
        query,
        hasChanged: (fresh, snap) => fresh.status !== snap.status,
      }),
    );

    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.blocked).toBe(true);
    expect(result.current.isUnavailable).toBe(false);
  });

  it("compares against the FROZEN snapshot, not a live-updating current prop", async () => {
    let resolveRefetch:
      ((value: { data: Fixture; isError: boolean }) => void) | undefined;
    const refetch = vi.fn(
      () =>
        new Promise<{ data: Fixture | undefined; isError: boolean }>((resolve) => {
          resolveRefetch = resolve;
        }),
    );
    const query = makeQuery({ id: 1, status: "pending" }, refetch);
    const hasChanged = vi.fn(
      (fresh: Fixture, snap: Fixture) => fresh.status !== snap.status,
    );

    const { result, rerender } = renderHook(
      (props: { current: Fixture }) =>
        useFreshConfirm({ open: true, current: props.current, query, hasChanged }),
      { initialProps: { current: { id: 1, status: "pending" } } },
    );

    // The prop the caller passes changes WHILE the check is still in
    // flight — the snapshot must not silently track this.
    rerender({ current: { id: 1, status: "rejected" } });

    act(() => {
      resolveRefetch?.({ data: { id: 1, status: "pending" }, isError: false });
    });

    await waitFor(() => expect(result.current.isChecking).toBe(false));

    // Fresh read ("pending") matches the ORIGINAL snapshot ("pending"),
    // not the later, live "rejected" prop — proves the comparison used
    // the frozen value.
    expect(hasChanged).toHaveBeenCalledWith(
      { id: 1, status: "pending" },
      { id: 1, status: "pending" },
    );
    expect(result.current.isStale).toBe(false);
  });
});

describe("settlement — verification failure", () => {
  it("blocks and reports unavailable when the query resolves with isError", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: undefined, isError: true });
    const query = makeQuery({ id: 1, status: "pending" }, refetch);
    const { result } = renderHook(() =>
      useFreshConfirm({
        open: true,
        current: { id: 1, status: "pending" },
        query,
        hasChanged: () => false,
      }),
    );

    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    expect(result.current.blocked).toBe(true);
    expect(result.current.isStale).toBe(false);
  });

  it("blocks and reports unavailable when refetch() itself rejects", async () => {
    const refetch = vi.fn().mockRejectedValue(new Error("network"));
    const query = makeQuery({ id: 1, status: "pending" }, refetch);
    const { result } = renderHook(() =>
      useFreshConfirm({
        open: true,
        current: { id: 1, status: "pending" },
        query,
        hasChanged: () => false,
      }),
    );

    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    expect(result.current.blocked).toBe(true);
  });

  it("retry() re-attempts the check without requiring a close/reopen", async () => {
    const refetch = vi
      .fn()
      .mockResolvedValueOnce({ data: undefined, isError: true })
      .mockResolvedValueOnce({ data: { id: 1, status: "pending" }, isError: false });
    const query = makeQuery({ id: 1, status: "pending" }, refetch);
    const { result } = renderHook(() =>
      useFreshConfirm({
        open: true,
        current: { id: 1, status: "pending" },
        query,
        hasChanged: (fresh, snap) => fresh.status !== snap.status,
      }),
    );

    await waitFor(() => expect(result.current.isUnavailable).toBe(true));

    act(() => result.current.retry());

    expect(result.current.isChecking).toBe(true);
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.isUnavailable).toBe(false);
    expect(result.current.blocked).toBe(false);
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});

describe("reopening", () => {
  it("re-snapshots and re-checks on a fresh open, after having closed", async () => {
    const refetch = vi
      .fn()
      .mockResolvedValue({ data: { id: 1, status: "pending" }, isError: false });
    const query = makeQuery({ id: 1, status: "pending" }, refetch);

    const { result, rerender } = renderHook(
      (props: { open: boolean }) =>
        useFreshConfirm({
          open: props.open,
          current: { id: 1, status: "pending" },
          query,
          hasChanged: (fresh, snap) => fresh.status !== snap.status,
        }),
      { initialProps: { open: true } },
    );

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender({ open: false });
    expect(result.current.blocked).toBe(false);

    rerender({ open: true });
    expect(result.current.isChecking).toBe(true);
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});
