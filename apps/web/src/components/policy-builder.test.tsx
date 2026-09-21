import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PolicyBuilder } from "./policy-builder.js";

const WALLET = "0x218b80d3bCDaB79C66ee24AA15A3c8e2527f5E21";
const VAULT = "0xa70344cEeA5598B836B148B0d83b19eE988b4599";

describe("policy builder", () => {
  it("compiles bounded form values into a deterministic preview", () => {
    render(<PolicyBuilder beneficiary={WALLET} vault={VAULT} />);

    fireEvent.change(screen.getByLabelText("Position size in USDC"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Maximum downside percentage"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review protection" }));

    expect(screen.getByText("Exit at or below", { exact: false }).textContent).toContain(
      "1.9 USDC",
    );
    expect(screen.getByText("2.01 USDC")).not.toBeNull();
  });

  it("rejects amounts above the deployed testnet cap", () => {
    render(<PolicyBuilder beneficiary={WALLET} vault={VAULT} />);
    fireEvent.change(screen.getByLabelText("Position size in USDC"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review protection" }));

    expect(screen.getByRole("alert")).not.toBeNull();
  });
});
