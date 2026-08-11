// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionForm,
  ActionSubmitButton,
  ActionToasts,
} from "@/components/action-feedback";
import type { ActionResult } from "@/lib/actions/types";

afterEach(cleanup);

describe("action feedback", () => {
  it("shows in-button progress and returns confirmation through the toast viewport", async () => {
    let finish!: (result: ActionResult) => void;
    const action = vi.fn(
      () =>
        new Promise<ActionResult>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <>
        <ActionForm action={action}>
          <ActionSubmitButton pendingLabel="Saving…">Save</ActionSubmitButton>
        </ActionForm>
        <ActionToasts />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await act(async () => finish({ ok: true, message: "Changes saved" }));

    expect(await screen.findByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Changes saved");
    expect(screen.getByTestId("action-toast-viewport")).toHaveClass(
      "fixed",
      "right-4",
      "bottom-4",
    );
  });

  it("keeps a failed action retryable and announces the safe error", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, message: "Watch quota exceeded" });
    render(
      <>
        <ActionForm action={action}>
          <ActionSubmitButton>Add</ActionSubmitButton>
        </ActionForm>
        <ActionToasts />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("button", { name: "Add" })).toBeEnabled();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Watch quota exceeded",
      ),
    );
  });
});
