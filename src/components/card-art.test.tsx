// @vitest-environment jsdom

import type { ComponentProps } from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardArt } from "@/components/card-art";

vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img"> & { fill?: boolean }) => {
    const { fill, ...imageProps } = props;
    void fill;

    return (
      // The mock exposes Next Image props through a native image for interaction tests.
      // eslint-disable-next-line @next/next/no-img-element
      <img {...imageProps} alt={imageProps.alt ?? ""} />
    );
  },
}));

describe("CardArt", () => {
  it("falls back to the stored preview when the unprefixed image fails", () => {
    const previewUrl =
      "https://cardtrader.com/uploads/blueprints/image/400528/preview_400528-lux-crownguard.webp";

    render(
      <CardArt
        src={previewUrl}
        alt="Lux, Crownguard"
        sizes="300px"
        className="aspect-[0.716]"
      />,
    );

    const image = screen.getByRole("img", { name: "Lux, Crownguard" });

    expect(image).toHaveAttribute(
      "src",
      "https://cardtrader.com/uploads/blueprints/image/400528/400528-lux-crownguard.webp",
    );

    fireEvent.error(image);

    expect(image).toHaveAttribute("src", previewUrl);
  });
});
