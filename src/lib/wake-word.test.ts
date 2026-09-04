import { describe, expect, it } from "vitest";
import { containsWakeWord } from "./wake-word";

describe("wake word matching", () => {
  it.each(["Hello Radian", "hey, RADIAN!", "Radian, render the scene", "could you help, Radian?"])("matches %s", (phrase) => {
    expect(containsWakeWord(phrase)).toBe(true);
  });

  it.each(["radiant light", "ready when you are", "render the scene"])("ignores %s", (phrase) => {
    expect(containsWakeWord(phrase)).toBe(false);
  });
});
